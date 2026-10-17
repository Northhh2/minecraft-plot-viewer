import { state } from './state.js';
import { getColorForType, escapeHtml } from './utils.js';

// Everything that reaches innerHTML below that did not originate in this file goes through esc().
const esc = escapeHtml;
import { setViewBox, highlightPlots, clearHighlight } from './map.js';
import { API_BASE } from './config.js';
import { apiLogin, apiLogout, apiCurrentUser } from './auth.js';
import { initializeEditor, refreshEditorUI, editorButtonsHTML, wireEditorButtons } from './editor.js';

let appData;
let dom;
let isAnimatingModal = false;

// --- Helper Functions ---
function getPlotStatusInfo(plot) {
    if (plot.status === 'pending') {
        return { text: 'W trakcie zmiany własności', color: 'text-yellow-400', isOwned: true };
    }
    const hasHistory = plot.history && plot.history.length > 0;
    if (hasHistory) {
        return { text: 'Zajęta', color: 'text-red-400', isOwned: true };
    }
    return { text: 'Wolna', color: 'text-green-400', isOwned: false };
}

export function initializeUI(data) {
    appData = data;
    dom = {
        modal: document.getElementById('modal'),
        modalTitle: document.getElementById('modal-title'),
        modalContent: document.getElementById('modal-content'),
        closeModalBtn: document.getElementById('close-modal'),
        backModalBtn: document.getElementById('back-modal'),
        loginButton: document.getElementById('login-button'),
        profileButton: document.getElementById('profile-button'),
        profilePic: document.getElementById('profile-pic'),
        loginModal: document.getElementById('login-modal'),
        closeLoginModalButton: document.getElementById('close-login-modal'),
        loginForm: document.getElementById('login-form'),
        loginError: document.getElementById('login-error'),
        lotteryButton: document.getElementById('lottery-button'),
        lotteryOverlay: document.getElementById('lottery-overlay'),
        closeLotteryButton: document.getElementById('close-lottery-button'),
        wheelCanvas: document.getElementById('wheelCanvas'),
        spinButton: document.getElementById('spin-button'),
        lotteryResult: document.getElementById('lottery-result'),
        tooltip: document.getElementById('tooltip'),
        nextWinnerInfo: document.getElementById('next-winner-info'),
        lotteryPlotsCount: document.getElementById('lottery-plots-count'),
        searchInput: document.getElementById('search-input'),
        searchButton: document.getElementById('search-button'),
        searchSuggestions: document.getElementById('search-suggestions'),
    };
    
    setupEventListeners();
    setupSearch();
    setupLottery();
    initializeEditor(data);
    attemptAutoLogin();
}

export function openNewModal(stateData) {
    state.modalHistory = [];
    navigateToModal(stateData);
}

export function navigateToModal(stateData) {
    state.modalHistory.push(stateData);
    renderCurrentModal();
}

export function goBackModal() {
    if (state.modalHistory.length > 1) {
        state.modalHistory.pop();
        renderCurrentModal(true);
    }
}

export function closeModal() {
    state.modalHistory = [];
    dom.modal.classList.remove('show');
    const mapModule = import('./map.js');
    mapModule.then(map => {
        map.dimOtherPlots();
        map.clearHighlight();
    });
}

export function showSimpleTooltip(e, plot) {
    const status = getPlotStatusInfo(plot);
    dom.tooltip.innerHTML = `<div class="font-bold">${esc(plot.name || `Działka ${plot.id}`)}</div><div class="text-xs ${status.color}">${status.text}</div>`;
    dom.tooltip.classList.remove('hidden');
    moveTooltip(e);
}

export function hideTooltip() { 
    dom.tooltip.classList.add('hidden'); 
}

export function moveTooltip(e) {
    const PADDING = 20; let x = e.clientX + PADDING; let y = e.clientY + PADDING;
    if (x + dom.tooltip.offsetWidth > window.innerWidth) x = e.clientX - dom.tooltip.offsetWidth - PADDING;
    if (y + dom.tooltip.offsetHeight > window.innerHeight) y = e.clientY - dom.tooltip.offsetHeight - PADDING;
    dom.tooltip.style.left = `${x}px`; 
    dom.tooltip.style.top = `${y}px`;
}


function setupEventListeners() {
    dom.closeModalBtn.addEventListener('click', closeModal);
    dom.backModalBtn.addEventListener('click', goBackModal);
    
    dom.loginButton.addEventListener('click', () => dom.loginModal.classList.remove('hidden'));
    dom.profileButton.addEventListener('click', () => {
        if (state.currentUser) openNewModal({ type: 'owner', data: state.currentUser.name });
    });
    dom.closeLoginModalButton.addEventListener('click', () => {
        dom.loginModal.classList.add('hidden');
        dom.loginError.classList.add('hidden');
    });
    dom.loginForm.addEventListener('submit', handleLogin);
    
    dom.lotteryButton.addEventListener('click', openLottery);
    dom.closeLotteryButton.addEventListener('click', () => {
        dom.lotteryOverlay.classList.add('hidden');
        dom.wheelCanvas.classList.remove('wheel-idle-spin');
    });
    dom.spinButton.addEventListener('click', spinWheel);

    dom.wheelCanvas.addEventListener('mouseenter', () => {
        dom.wheelCanvas.classList.remove('wheel-idle-spin');
    });
    dom.wheelCanvas.addEventListener('mouseleave', () => {
        if (!dom.spinButton.disabled) {
            dom.wheelCanvas.classList.add('wheel-idle-spin');
        }
        hideTooltip();
    });

    dom.wheelCanvas.addEventListener('mousemove', (e) => {
        if (state.eligibleForLottery.length <= 10) return;

        const canvasRect = dom.wheelCanvas.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;
        const radius = dom.wheelCanvas.width / 2;
        
        const dx = x - radius;
        const dy = y - radius;
        
        if (dx * dx + dy * dy > (radius-5) * (radius-5)) {
            hideTooltip();
            return;
        }

        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI;

        const numOptions = state.eligibleForLottery.length;
        const arcSize = 2 * Math.PI / numOptions;
        const segmentIndex = Math.floor(angle / arcSize);
        
        const plot = state.eligibleForLottery[segmentIndex];
        if (plot) {
            dom.tooltip.innerHTML = `<div class="font-semibold">${esc(plot.name)}</div>`;
            dom.tooltip.classList.remove('hidden');
            moveTooltip(e);
        }
    });
}

function renderCurrentModal() {
    if (state.modalHistory.length === 0 || isAnimatingModal) return;
    isAnimatingModal = true;
    
    const currentState = state.modalHistory[state.modalHistory.length - 1];
    dom.modalContent.classList.add('fade-out');

    setTimeout(() => {
        const { type, data } = currentState;
        let contentHTML = '', title = '';
        let plotsToHighlight = [];
        const { allPlots } = appData;

        switch (type) {
            case 'plot': title = `Działka: ${data.name}`; contentHTML = renderPlotContent(data); plotsToHighlight = [data]; break;
            case 'merged': title = 'Połączone działki'; contentHTML = renderMergedContent(data); plotsToHighlight = data.plots.map(name => allPlots.find(p => p.name === name)).filter(Boolean); break;
            case 'local': title = `Lokal #${data.klatka ? data.klatka + '/' : ''}${data.localNum}`; contentHTML = renderLocalContent(data); const parentPlot = allPlots.find(p => p.name === data.plotName); if (parentPlot) plotsToHighlight = [parentPlot]; break;
            case 'owner': title = `Aktywa: ${data}`; contentHTML = renderOwnerContent(data); plotsToHighlight = allPlots.filter(p => p.owner === data); break;
            case 'district': title = `Dzielnica: ${data.name}`; contentHTML = renderDistrictContent(data.name, data.plots); plotsToHighlight = data.plots; break;
            case 'street': title = `Ulica: ${data}`; contentHTML = renderStreetContent(data); plotsToHighlight = allPlots.filter(p => p.street === data); break;
            case 'plotType': title = `Typ: ${data}`; contentHTML = renderPlotTypeContent(data); plotsToHighlight = allPlots.filter(p => p.type === data); break;
            case 'metroLine': { const line = metroLineById(data); title = line ? `Linia ${line.name}` : 'Linia'; contentHTML = renderMetroLineContent(line); break; }
            case 'metroStation': { const station = metroStationById(data); title = station ? `Stacja: ${station.name}` : 'Stacja'; contentHTML = renderMetroStationContent(station); break; }
        }

        dom.modalTitle.textContent = title;
        dom.modalContent.innerHTML = contentHTML;
        addModalEventListeners();

        import('./map.js').then(map => map.dimOtherPlots(plotsToHighlight));

        dom.backModalBtn.classList.toggle('hidden', state.modalHistory.length <= 1);
        dom.modal.classList.add('show');
        dom.modalContent.classList.remove('fade-out');
        isAnimatingModal = false;
    }, 150);
}

const metroLineById = id => appData.metro?.lines.find(l => l.id === id) ?? null;
const metroStationById = id => appData.metro?.stations.find(s => s.id === id) ?? null;

function metroLineChip(line) {
    return `<span data-metro-line="${line.id}" class="inline-flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 rounded-full px-3 py-1 text-sm cursor-pointer">
        <span class="inline-block w-3 h-3 rounded-full" style="background-color:${escapeHtml(line.hex)}"></span>${escapeHtml(line.name)}</span>`;
}

function renderMetroLineContent(line) {
    if (!line) return '<p>Nie znaleziono linii.</p>';
    const kind = line.shuttle ? 'Wahadło' : line.circular ? 'Okrężna' : 'Zwykła';
    const stops = line.stationIds.map((id, i) => {
        const s = metroStationById(id);
        return s ? `<div data-metro-station="${s.id}" class="bg-gray-700 hover:bg-gray-600 p-2 rounded-md cursor-pointer transition-colors flex items-center">
            <span class="text-gray-400 w-6 text-sm">${i + 1}.</span><span class="font-medium">${escapeHtml(s.name)}</span></div>` : '';
    }).join('');
    const pending = line.edited && isEditorUser() ? '<p class="text-xs text-yellow-300">Zmieniono w portalu — czeka na zastosowanie w grze.</p>' : '';
    return `<div><h3 class="text-2xl font-bold flex items-center"><span class="inline-block w-4 h-4 rounded-full mr-3" style="background-color:${escapeHtml(line.hex)}"></span>${escapeHtml(line.name)}</h3>
            <p class="text-sm ${line.running ? 'text-green-400' : 'text-gray-400'}">${line.running ? 'Kursuje' : 'Nieczynna'}</p></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b border-gray-700 pb-3 mb-3 mt-3">
            <span class="text-gray-400">Rodzaj:</span><span class="font-medium">${kind}${line.throughLoops ? ' (przez pętle)' : ''}</span>
            <span class="text-gray-400">Prędkość:</span><span class="font-medium">${line.speed} m/s</span>
            <span class="text-gray-400">Postój:</span><span class="font-medium">${line.dwellSeconds} s</span>
            <span class="text-gray-400">Pociągi:</span><span class="font-medium">${line.shuttle ? 1 : line.trainCount}</span>
        </div>
        ${pending}
        <h4 class="text-md font-semibold mb-2">Przystanki (${line.stationIds.length})</h4>
        <div class="space-y-2 mb-4">${stops || '<p class="text-sm text-gray-400">Brak przystanków.</p>'}</div>
        ${editorButtonsHTML('metroLine', line.id)}`;
}

function renderMetroStationContent(station) {
    if (!station) return '<p>Nie znaleziono stacji.</p>';
    const serving = (appData.metro?.lines ?? []).filter(l => l.stationIds.includes(station.id));
    const position = station.x === null ? 'brak platformy' : `X: ${station.x}, Z: ${station.z}`;
    const pending = station.edited && isEditorUser() ? '<p class="text-xs text-yellow-300">Nazwę zmieniono w portalu — czeka na zastosowanie w grze.</p>' : '';
    return `<div><h3 class="text-2xl font-bold">${escapeHtml(station.name)}</h3></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b border-gray-700 pb-3 mb-3 mt-3">
            <span class="text-gray-400">Położenie:</span><span class="font-medium">${position}</span>
            <span class="text-gray-400">Perony:</span><span class="font-medium">${station.platformCount}</span>
        </div>
        ${pending}
        <h4 class="text-md font-semibold mb-2">Linie</h4>
        <div class="flex flex-wrap gap-2 mb-4">${serving.map(metroLineChip).join('') || '<span class="text-sm text-gray-400">Żadna linia nie obsługuje tej stacji.</span>'}</div>
        ${editorButtonsHTML('metroStation', station.id)}`;
}

const isEditorUser = () => state.currentUser && (state.currentUser.role === 'clerk' || state.currentUser.role === 'admin');

function renderPlotContent(plot) {
    const { allLocals, lotteryHistory } = appData;
    const status = getPlotStatusInfo(plot);
    const ownerInfo = plot.owner || 'Skarb Miasta';
    
    const localsOnPlot = allLocals.filter(l => l.plotName === plot.name);
    let localsHTML = '';

    if (localsOnPlot.length === 1) {
        const singleLocal = localsOnPlot[0];
        const localTitle = esc(`Lokal #${singleLocal.klatka ? singleLocal.klatka + '/' : ''}${singleLocal.localNum}`);
        localsHTML = `<div class="border-t border-gray-700 pt-3 mt-3">
            <h4 class="text-md font-semibold">${localTitle}</h4>
            <div class="space-y-3 mt-2">
               <div><span class="text-gray-400 text-sm">Najemca:</span>${createOwnerCardHTML(singleLocal.tenant || 'Brak')}</div>
               <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-3 border-t border-gray-700">
                   <span class="text-gray-400">Powierzchnia:</span><span class="font-medium">${esc(singleLocal.area)} m²</span>
                   <span class="text-gray-400">Piętro:</span><span class="font-medium">${esc(singleLocal.floor)}</span>
                   <span class="text-gray-400">Miejsca pracy:</span><span class="font-medium">${esc(singleLocal.workplaces)}</span>
                   <span class="text-gray-400">Ilość łóżek:</span><span class="font-medium">${esc(singleLocal.beds)}</span>
               </div>
            </div>
        </div>`;

    } else if (localsOnPlot.length > 1) {
        const localDetailsList = localsOnPlot.map(l => {
            const localTitle = esc(`Lokal #${l.klatka ? l.klatka + '/' : ''}${l.localNum}`);
            return `<div data-local-id="${esc(l.id)}" class="bg-gray-700 p-2 rounded-md hover:bg-gray-600 cursor-pointer transition-colors">
                <div class="font-semibold text-purple-400">${localTitle} (${esc(l.area)} m²)</div>
                <div class="text-xs text-gray-400">Najemca: <span class="font-medium text-gray-200">${esc(l.tenant || 'Brak')}</span></div></div>`
        }).join('');
        localsHTML = `<div class="border-t border-gray-700 pt-3 mt-3"><h4 class="text-md font-semibold mb-3">Lokale w budynku (${localsOnPlot.length})</h4><div class="space-y-2">${localDetailsList}</div></div>`;
    }

    let address = '';
    if (plot.street && plot.buildingNumber) {
        address += `<span data-street-name="${esc(plot.street)}" class="clickable">${esc(plot.street)}</span> ${esc(plot.buildingNumber)}, `;
    }
    if (plot.district) {
        address += `<span data-district-name="${esc(plot.district)}" class="clickable">${esc(plot.district)}</span>`;
    }
    
    const typeColorDot = `<span class="inline-block w-2.5 h-2.5 rounded-full mr-2" style="background-color: ${getColorForType(plot.type, 1)}"></span>`;
    
    let historyHTML = '';
    if(plot.history && plot.history.length > 0) {
        const reversedHistory = [...plot.history].reverse();
        const historyList = reversedHistory.map((t, index) => {
            let durationText = '';
            const nextTransaction = reversedHistory[index - 1];
            if (nextTransaction) {
                const duration = parseInt(nextTransaction.date, 10) - parseInt(t.date, 10);
                durationText = `${duration} dni`;
            } else {
                durationText = 'Obecnie';
            }

            let confidentialInfo = '';
            if (state.currentUser && (t.newOwner === state.currentUser.name || (index > 0 && reversedHistory[index - 1].newOwner === state.currentUser.name) )) {
                 confidentialInfo = `
                    <div class="text-xs text-gray-400 mt-1">Wartość: ${esc(t.transactionValue || 'Brak')} | Czek: #${esc(t.checkNumber || 'Brak')}</div>
                 `;
            }

            return `
            <div class="bg-gray-700 p-2 rounded-md">
                <div class="flex justify-between items-center">
                    <div class="text-xs text-gray-400">${esc(t.type)}</div>
                    <div class="text-xs text-gray-300">${durationText}</div>
                </div>
                ${createOwnerCardHTML(t.newOwner)}
                ${confidentialInfo}
            </div>`;
        }).join('');

        historyHTML = `<div class="border-t border-gray-700 pt-3 mt-3">
            <h4 class="text-md font-semibold mb-3">Historia własności</h4>
            <div class="space-y-2">${historyList}</div>
        </div>`;
    }

    const lotteryWin = lotteryHistory.find(l => l.plotName === plot.name && l.paid);
    let lotteryBadgeHTML = '';
    if (lotteryWin) {
        lotteryBadgeHTML = createDonorBadgeHTML(lotteryWin.winner);
    }

    return `<div><h3 class="text-2xl font-bold ${status.isOwned ? 'text-red-400' : 'text-green-400'}">${esc(plot.name)}</h3><p class="text-gray-400 text-sm">${address}</p></div>
        <div class="space-y-3">
            ${createOwnerCardHTML(ownerInfo)}
            ${lotteryBadgeHTML}
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-3 border-t border-gray-700">
                <span class="text-gray-400">Typ:</span><span class="font-medium flex items-center clickable" data-plot-type="${esc(plot.type)}">${typeColorDot} ${esc(plot.type || 'Brak')}</span>
                <span class="text-gray-400">Wartość:</span><span class="font-medium flex items-center">${esc(plot.value || '0')} <img src="minecoin.webp" class="inline w-4 h-4 ml-1" alt="MC"></span>
                <span class="text-gray-400">Powierzchnia:</span><span class="font-medium">${esc(plot.area || 'Brak')} m²</span>
                <span class="text-gray-400">Rozmiar:</span><span class="font-medium">${esc(plot.width)}x${esc(plot.height)} m</span>
            </div></div>
        ${historyHTML}
        ${localsHTML}
        ${editorButtonsHTML('plot', plot)}`;
}

function renderMergedContent(mergedPlot) {
    const { allPlots } = appData;
    const plotsDetails = mergedPlot.plots.map(name => allPlots.find(p => p.name === name)).filter(Boolean).map(p => createPlotListItemHTML(p)).join('');
    return `<div><h3 class="text-2xl font-bold text-amber-400">Połączone Działki</h3><p class="text-gray-400">Grupa ${mergedPlot.plots.length} działek</p></div>
        <div class="space-y-3"><div><span class="text-gray-400 block mb-2">Działki wchodzące w skład:</span><div class="font-medium space-y-2">${plotsDetails}</div></div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-gray-700 text-sm">
                <span class="text-gray-400">Pow. oryginalna:</span><span class="font-medium">${mergedPlot.originalArea} m²</span>
                <span class="text-gray-400">Pow. połączona:</span><span class="font-medium">${mergedPlot.mergedArea} m²</span>
            </div></div>`;
}

function renderLocalContent(local) {
    const { allPlots } = appData;
    const plot = allPlots.find(p => p.name === local.plotName);
    let address = '';
    if (local.street && local.building) {
        const buildingPart = local.building + (local.klatka || '');
        address += `<span data-street-name="${esc(local.street)}" class="clickable">${esc(local.street)}</span> ${esc(buildingPart)}/${esc(local.localNum)}, `;
    }
    if (plot?.district) {
        address += `<span data-district-name="${esc(plot.district)}" class="clickable">${esc(plot.district)}</span>`;
    }
    
    const localTitle = esc(`Lokal #${local.klatka ? local.klatka + '/' : ''}${local.localNum}`);
    return `<div><h3 class="text-2xl font-bold text-cyan-400">${localTitle}</h3><p class="text-gray-400 text-sm">${address}</p></div>
         <div class="space-y-3">
            <div><span class="text-gray-400 text-sm">Najemca:</span>${createOwnerCardHTML(local.tenant || 'Brak')}</div>
            <div><span class="text-gray-400 text-sm">Właściciel budynku:</span>${createOwnerCardHTML(plot?.owner)}</div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-3 border-t border-gray-700">
                <span class="text-gray-400">Powierzchnia:</span><span class="font-medium">${esc(local.area)} m²</span>
                <span class="text-gray-400">Piętro:</span><span class="font-medium">${esc(local.floor)}</span>
                <span class="text-gray-400">Miejsca pracy:</span><span class="font-medium">${esc(local.workplaces)}</span>
                <span class="text-gray-400">Ilość łóżek:</span><span class="font-medium">${esc(local.beds)}</span>
            </div></div>`;
}

function renderOwnerContent(ownerName) {
    const { allOwners, allPlots, allLocals, lotteryHistory } = appData;
    const owner = allOwners.find(o => o.name === ownerName);
    const ownedPlots = allPlots.filter(p => p.owner === ownerName);
    const rentedLocals = allLocals.filter(l => l.tenant === ownerName);
    const totalPlotArea = ownedPlots.reduce((sum, p) => sum + (parseInt(p.area) || 0), 0);
    let ownerDetailsHTML = '';
    if(owner) {
        ownerDetailsHTML += `<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm"><span class="text-gray-400">NIO:</span><span>${esc(owner.nio || 'Brak')}</span>`;
        if(owner.type === 'fizyczna') ownerDetailsHTML += `<span class="text-gray-400">Wiek:</span><span>${esc(owner.age || 'Brak')}</span><span class="text-gray-400">Zawód:</span><span>${esc(owner.profession || 'Brak')}</span>`;
        else if(owner.type === 'prawna') ownerDetailsHTML += `<span class="text-gray-400">Forma Prawna:</span><span>${esc(owner.legalForm || 'Brak')}</span>`;
        ownerDetailsHTML += '</div>';
    }
    const rentedLocalsHTML = rentedLocals.map(l => `<div class="bg-gray-700 p-2 rounded-md"><div data-local-id="${esc(l.id)}" class="cursor-pointer">
        <div class="font-semibold text-purple-400">${esc(`Lokal #${l.klatka ? l.klatka + '/' : ''}${l.localNum} w ${l.plotName}`)}</div><div class="text-xs text-gray-400">Powierzchnia: ${esc(l.area)} m²</div></div>
        <div class="mt-2 text-xs text-gray-400">Wynajmowane od:</div>${createOwnerCardHTML(allPlots.find(p=>p.name===l.plotName)?.owner)}</div>`).join('');
    
    let wonPlotsHTML = '';
    const wonAndPaidPlots = lotteryHistory.filter(l => l.winner === ownerName && l.paid);
    if (wonAndPaidPlots.length > 0) {
        const wonList = wonAndPaidPlots.map(l => {
            return `<div class="bg-gray-700 p-2 rounded-md">
                <div data-plot-name="${esc(l.plotName)}" class="font-semibold text-purple-400 cursor-pointer hover:underline">${esc(l.plotName)}</div>
            </div>`;
        }).join('');
        wonPlotsHTML = `<div class="border-t border-gray-700 pt-3"><h4 class="font-semibold text-md mb-2">Działki zdobyte w Loterii (${wonAndPaidPlots.length})</h4><div class="space-y-2">${wonList}</div></div>`;
    }

    const logoutButtonHTML = (state.currentUser && state.currentUser.name === ownerName) ? 
        `<button id="modal-logout-button" class="w-full mt-4 bg-red-800 text-white px-4 py-2 rounded-lg border border-red-600 hover:bg-red-700 transition-colors">Wyloguj się</button>` : '';

    return `<div class="space-y-4">${createOwnerCardHTML(ownerName, true)}
        ${ownerDetailsHTML ? `<div class="pt-3 border-t border-gray-700">${ownerDetailsHTML}</div>` : ''}
        <div><h4 class="font-semibold text-md mb-2">Posiadane Działki (${ownedPlots.length})</h4>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm"><span class="text-gray-400">Łączna pow.:</span><span>${totalPlotArea.toLocaleString()} m²</span></div>
            ${ownedPlots.length > 0 ? `<div class="space-y-2 mt-2">${ownedPlots.map(p => createPlotListItemHTML(p)).join('')}</div>` : ''}</div>
        <div class="border-t border-gray-700 pt-3"><h4 class="font-semibold text-md mb-1">Wynajmowane Lokale (${rentedLocals.length})</h4>
            ${rentedLocals.length > 0 ? `<div class="space-y-2 mt-2">${rentedLocalsHTML}</div>` : '<p class="text-gray-500 text-sm">Brak</p>'}</div>
        ${wonPlotsHTML}
        ${logoutButtonHTML}
        </div>`;
}

function renderDistrictContent(districtName, plotsInDistrict) {
    const totalArea = plotsInDistrict.reduce((sum, p) => sum + (parseInt(p.area) || 0), 0);
    return `<div><h3 class="text-2xl font-bold text-purple-400">${esc(districtName)}</h3></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b border-gray-700 pb-3 mb-3">
            <span>Liczba działek:</span><span class="font-medium">${plotsInDistrict.length}</span>
            <span>Łączna powierzchnia:</span><span class="font-medium">${totalArea.toLocaleString()} m²</span></div>
        <div class="space-y-2 mb-4">${plotsInDistrict.map(p => createPlotListItemHTML(p)).join('')}</div>
        ${editorButtonsHTML('district', districtName)}`;
}

function renderStreetContent(streetName) {
    const { streets, allPlots } = appData;
    const street = streets.find(s => s.name === streetName);
    if (!street) return '<p>Nie znaleziono ulicy.</p>';
    const plotsOnStreet = allPlots.filter(p => p.street === streetName);
    const length = street.width > street.height ? street.width : street.height;
    return `<div><h3 class="text-2xl font-bold text-blue-400">${esc(streetName)}</h3></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b border-gray-700 pb-3 mb-3">
            <span>Długość:</span><span class="font-medium">${length} m</span>
            <span>Liczba działek:</span><span class="font-medium">${plotsOnStreet.length}</span></div>
        <div class="space-y-2 mb-4">${plotsOnStreet.map(p => createPlotListItemHTML(p)).join('')}</div>
        ${editorButtonsHTML('street', streetName)}`;
}

function renderPlotTypeContent(typeName) {
    const { allPlots, allLocals } = appData;
    const plotsOfType = allPlots.filter(p => p.type === typeName);
    const plotNames = new Set(plotsOfType.map(p => p.name));
    const localsOnPlots = allLocals.filter(l => plotNames.has(l.plotName));
    const totalArea = plotsOfType.reduce((s, p) => s + (parseInt(p.area) || 0), 0);
    const totalLocals = localsOnPlots.length;
    const totalWorkplaces = localsOnPlots.reduce((s, l) => s + l.workplaces, 0);
    const totalBeds = localsOnPlots.reduce((s, l) => s + l.beds, 0);
    const typeColorDot = `<span class="inline-block w-3 h-3 rounded-full mr-2" style="background-color: ${getColorForType(typeName, 1)}"></span>`;

    return `<div><h3 class="text-2xl font-bold flex items-center">${typeColorDot} ${esc(typeName)}</h3></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b border-gray-700 pb-3 mb-3">
            <span>Liczba działek:</span><span class="font-medium">${plotsOfType.length}</span>
            <span>Łączna powierzchnia:</span><span class="font-medium">${totalArea.toLocaleString()} m²</span>
            <span>Liczba lokali:</span><span class="font-medium">${totalLocals}</span>
            <span>Miejsca pracy:</span><span class="font-medium">${totalWorkplaces}</span>
            <span>Ilość łóżek:</span><span class="font-medium">${totalBeds}</span>
        </div>
        <div class="space-y-2 mb-4">${plotsOfType.map(p => createPlotListItemHTML(p)).join('')}</div>`;
}



function createPlotListItemHTML(plot) {
    const status = getPlotStatusInfo(plot);
    return `<div data-plot-name="${esc(plot.name)}" class="bg-gray-700 p-2 rounded-md hover:bg-gray-600 cursor-pointer transition-colors">
        <div class="font-semibold text-purple-400">${esc(plot.name)} (${esc(plot.area)} m²)</div>
        <div class="text-xs text-gray-400">Właściciel: <span class="font-medium text-gray-200">${esc(plot.owner || 'Brak')}</span></div>
        <div class="text-xs ${status.color}">${status.text}</div></div>`;
}

function createOwnerCardHTML(ownerName, isSelf = false) {
    if (!ownerName) return '';
    const { allOwners } = appData;
    const owner = allOwners.find(o => o.name === ownerName);
    const isClickable = !isSelf && !ownerName.toLowerCase().includes('skarb miasta');
    const photo = owner?.photo || 'placeholder.webp';
    const type = owner?.type ? (owner.type.charAt(0).toUpperCase() + owner.type.slice(1)) : '';
    return `<div class="flex items-center bg-gray-700 p-2 rounded-md transition-colors ${isClickable ? 'clickable hover:bg-gray-600' : ''}" ${isClickable ? `data-owner-name="${esc(ownerName)}"` : ''}>
        <img src="${esc(photo)}" onerror="this.onerror=null;this.src='placeholder.webp';" class="w-10 h-10 rounded-full mr-3 object-cover">
        <div><div class="font-semibold text-white">${esc(ownerName)}</div><div class="text-xs text-gray-400">${esc(type)}</div></div></div>`;
}

function createDonorBadgeHTML(donorName) {
    if (!donorName) return '';
    const { allOwners } = appData;
    const owner = allOwners.find(o => o.name === donorName);
    const photo = owner?.photo || 'placeholder.webp';
    const isClickable = !donorName.toLowerCase().includes('skarb miasta');
    return `<div class="mt-2">
        <div class="text-xs text-yellow-300 mb-1">Hojny Darczyńca Loterii Działkowej</div>
        <div class="flex items-center p-2 rounded-md donor-badge ${isClickable ? 'clickable' : ''}" ${isClickable ? `data-owner-name="${esc(donorName)}"` : ''}>
            <img src="${esc(photo)}" onerror="this.onerror=null;this.src='placeholder.webp';" class="w-8 h-8 rounded-full mr-3 object-cover border-2 border-yellow-600">
            <div>
                <div class="font-semibold text-yellow-900">${esc(donorName)}</div>
            </div>
        </div>
    </div>`;
}

function addModalEventListeners() {
    dom.modalContent.querySelectorAll('[data-plot-name]').forEach(el => el.addEventListener('click', e => { 
        e.preventDefault(); 
        const plot = appData.allPlots.find(p => p.name === e.currentTarget.dataset.plotName);
        if(plot) navigateToModal({type: 'plot', data: plot});
    }));
    dom.modalContent.querySelectorAll('[data-local-id]').forEach(el => el.addEventListener('click', e => { 
        e.preventDefault(); 
        const local = appData.allLocals.find(l => l.id === e.currentTarget.dataset.localId);
        if(local) navigateToModal({type: 'local', data: local});
    }));
    dom.modalContent.querySelectorAll('[data-owner-name]').forEach(el => el.addEventListener('click', e => { 
        e.preventDefault(); 
        const ownerName = e.currentTarget.dataset.ownerName;
        if (ownerName && !ownerName.toLowerCase().includes('skarb miasta') && ownerName.toLowerCase() !== 'brak') {
            navigateToModal({type: 'owner', data: ownerName});
        }
    }));
    dom.modalContent.querySelectorAll('[data-district-name]').forEach(el => el.addEventListener('click', e => {
        e.preventDefault();
        const districtName = e.currentTarget.dataset.districtName;
        if (!districtName) return;
        const plotsInDistrict = appData.allPlots.filter(p => p.district === districtName);
        if(plotsInDistrict.length > 0) navigateToModal({type: 'district', data: {name: districtName, plots: plotsInDistrict}});
    }));
     dom.modalContent.querySelectorAll('[data-street-name]').forEach(el => el.addEventListener('click', e => {
        e.preventDefault();
        navigateToModal({type: 'street', data: e.currentTarget.dataset.streetName});
    }));
    dom.modalContent.querySelectorAll('[data-plot-type]').forEach(el => el.addEventListener('click', e => {
        e.preventDefault();
        navigateToModal({type: 'plotType', data: e.currentTarget.dataset.plotType});
    }));
    dom.modalContent.querySelectorAll('[data-metro-line]').forEach(el => el.addEventListener('click', e => {
        e.preventDefault();
        navigateToModal({ type: 'metroLine', data: Number(e.currentTarget.dataset.metroLine) });
    }));
    dom.modalContent.querySelectorAll('[data-metro-station]').forEach(el => el.addEventListener('click', e => {
        e.preventDefault();
        navigateToModal({ type: 'metroStation', data: Number(e.currentTarget.dataset.metroStation) });
    }));
    wireEditorButtons(dom.modalContent);
    const modalLogoutButton = document.getElementById('modal-logout-button');
    if (modalLogoutButton) {
        modalLogoutButton.addEventListener('click', () => {
            closeModal();
            logoutUser();
        });
    }
}

// --- Search Functions ---
function setupSearch() {
    dom.searchInput.addEventListener('input', () => {
        const query = dom.searchInput.value.trim().toLowerCase();
        dom.searchSuggestions.innerHTML = '';
        if (!query) {
            dom.searchSuggestions.classList.add('hidden');
            return;
        }

        const suggestions = [];
        const { allPlots, allOwners, streets, allLocals } = appData;
        
        // Działki
        allPlots.filter(p => p.name.toLowerCase().includes(query) || p.id.includes(query)).slice(0, 3)
            .forEach(p => suggestions.push({ type: 'plot', label: `Działka: ${p.name}`, value: p.name }));
        // Właściciele
        [...new Set(allPlots.map(p => p.owner))].filter(o => o && o.toLowerCase().includes(query)).slice(0, 2)
            .forEach(o => suggestions.push({ type: 'owner', label: `Właściciel: ${o}`, value: o }));
        // Ulice
        [...new Set(streets.map(s => s.name))].filter(s => s && s.toLowerCase().includes(query)).slice(0, 2)
            .forEach(s => suggestions.push({ type: 'street', label: `Ulica: ${s}`, value: s }));
        // Adresy Lokali
        allLocals.filter(l => {
            const fullAddress = `${l.street.toLowerCase()} ${l.building}${l.klatka || ''}/${l.localNum}`;
            return l.street && l.building && l.localNum && fullAddress.includes(query);
        }).slice(0, 3)
            .forEach(l => {
                const address = `${l.street} ${l.building}${l.klatka || ''}/${l.localNum}`;
                suggestions.push({ type: 'local_address', label: `Lokal: ${address}`, value: address});
            });
        // Metro
        (appData.metro?.lines ?? []).filter(l => l.name.toLowerCase().includes(query)).slice(0, 3)
            .forEach(l => suggestions.push({ type: 'metroLine', label: `Linia: ${l.name}`, value: l.id }));
        (appData.metro?.stations ?? []).filter(s => s.name.toLowerCase().includes(query)).slice(0, 3)
            .forEach(s => suggestions.push({ type: 'metroStation', label: `Stacja: ${s.name}`, value: s.id }));
        // Adresy
        allPlots.filter(p => p.street && p.buildingNumber && `${p.street.toLowerCase()} ${p.buildingNumber}`.includes(query)).slice(0, 3)
            .forEach(p => {
                const address = `${p.street} ${p.buildingNumber}`;
                suggestions.push({ type: 'address', label: `Adres: ${address}`, value: address});
            });
        
        if (suggestions.length > 0) {
            suggestions.forEach(s => {
                const div = document.createElement('div');
                div.className = 'p-2 hover:bg-purple-600 cursor-pointer';
                div.textContent = s.label;
                div.addEventListener('click', () => findAndCenter(s));
                dom.searchSuggestions.appendChild(div);
            });
            dom.searchSuggestions.classList.remove('hidden');
        } else {
            dom.searchSuggestions.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => { if (!dom.searchInput.parentElement.contains(e.target)) dom.searchSuggestions.classList.add('hidden'); });
    dom.searchButton.addEventListener('click', () => dom.searchInput.dispatchEvent(new KeyboardEvent('keyup', {'key': 'Enter'})));
    dom.searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { const first = dom.searchSuggestions.querySelector('div'); if (first) first.click(); } });
}

/** Opens a metro line/station modal and frames it on the map. */
function centerOnMetro(item) {
    const metro = appData.metro;
    if (!metro) return;
    const stations = item.type === 'metroStation'
        ? metro.stations.filter(s => s.id === item.value)
        : (metro.lines.find(l => l.id === item.value)?.stationIds ?? []).map(id => metro.stations.find(s => s.id === id)).filter(Boolean);
    openNewModal({ type: item.type, data: item.value });
    const placed = stations.filter(s => s.x !== null);
    if (placed.length === 0) return;
    const minX = Math.min(...placed.map(s => s.x)), maxX = Math.max(...placed.map(s => s.x));
    const minZ = Math.min(...placed.map(s => s.z)), maxZ = Math.max(...placed.map(s => s.z));
    const { initialViewBox } = state;
    const width = Math.max(300, (maxX - minX) * 1.4), height = (width / initialViewBox.w) * initialViewBox.h;
    setViewBox((minX + maxX) / 2 - width / 2, (minZ + maxZ) / 2 - height / 2, width, height);
}

function findAndCenter(item) {
    clearHighlight();
    let targetPlots = [];
    const { allPlots, allLocals } = appData;

    if (item.type === 'metroLine' || item.type === 'metroStation') {
        centerOnMetro(item);
        dom.searchInput.value = '';
        dom.searchSuggestions.classList.add('hidden');
        return;
    }

    if (item.type === 'plot') {
        const plot = allPlots.find(p => p.name === item.value);
        if (plot) { targetPlots.push(plot); openNewModal({type: 'plot', data: plot}); }
    } else if (item.type === 'owner') {
        targetPlots = allPlots.filter(p => p.owner === item.value);
        openNewModal({type: 'owner', data: item.value});
    } else if (item.type === 'street') {
        targetPlots = allPlots.filter(p => p.street === item.value);
        openNewModal({type: 'street', data: item.value});
    } else if (item.type === 'address' || item.type === 'local_address') {
        const [addressPart, localNum] = item.value.split('/');
        const lastSpaceIndex = addressPart.lastIndexOf(' ');
        const street = addressPart.substring(0, lastSpaceIndex);
        const buildingAndStaircase = addressPart.substring(lastSpaceIndex + 1);

        if(item.type === 'local_address') {
            const local = allLocals.find(l => l.street === street && (l.building + (l.klatka || '')) === buildingAndStaircase && l.localNum === localNum);
            if (local) {
                const plot = allPlots.find(p => p.name === local.plotName);
                if(plot) {
                    targetPlots.push(plot);
                    openNewModal({type: 'plot', data: plot});
                    navigateToModal({type: 'local', data: local});
                }
            }
        } else { // address
            const plot = allPlots.find(p => p.street === street && p.buildingNumber === buildingAndStaircase);
            if (plot) {
                targetPlots.push(plot);
                openNewModal({type: 'plot', data: plot});
            }
        }
    }

    if(targetPlots.length > 0) {
        const { initialViewBox } = state;
        const minX = Math.min(...targetPlots.map(p => p.x1)), maxX = Math.max(...targetPlots.map(p => p.x2));
        const minZ = Math.min(...targetPlots.map(p => p.z1)), maxZ = Math.max(...targetPlots.map(p => p.z2));
        const centerX = minX + (maxX - minX) / 2, centerZ = minZ + (maxZ - minZ) / 2;
        const contentWidth = Math.max(300, (maxX - minX) * 1.5), newH = (contentWidth / initialViewBox.w) * initialViewBox.h;
        setViewBox(centerX - contentWidth / 2, centerZ - newH / 2, contentWidth, newH);
        highlightPlots(targetPlots.map(p => p.id));
    }
    dom.searchInput.value = '';
    dom.searchSuggestions.classList.add('hidden');
}

// --- Auth Functions ---
// With API_BASE set, login goes through the Worker (identity number + PIN generated in-game, bearer
// session). Without it, the legacy sheet-based lookup below is used.
function showLoggedIn(user) {
    state.currentUser = user;
    dom.loginModal.classList.add('hidden');
    dom.loginButton.classList.add('hidden');
    dom.profilePic.src = user.photo || 'placeholder.webp';
    dom.profileButton.classList.remove('hidden');
    dom.loginError.classList.add('hidden');
    dom.loginForm.reset();
    refreshEditorUI();
    if (state.modalHistory.length > 0) renderCurrentModal();
}

function apiUserToCurrentUser(u) {
    return { name: u.name, photo: u.photoUrl, nio: u.nio, role: u.role, number: u.number, staff: u.role !== 'citizen' };
}

async function attemptAutoLogin() {
    if (API_BASE) {
        const user = await apiCurrentUser();
        if (user) showLoggedIn(apiUserToCurrentUser(user));
        return;
    }
    const savedIdentifier = localStorage.getItem('userIdentifier');
    const savedPIN = localStorage.getItem('userPIN');
    if (savedIdentifier && savedPIN) {
        loginUser(savedIdentifier, savedPIN, true);
    }
}
function loginUser(identifier, pin, isAutoLogin = false) {
    const { allOwners } = appData;
    const identifierLower = identifier.toLowerCase();
    const user = allOwners.find(o => o.pin === pin && o.type === 'fizyczna' && (o.nio === identifier || o.name.toLowerCase() === identifierLower));
    
    if (user) {
        localStorage.setItem('userIdentifier', user.nio || user.name);
        localStorage.setItem('userPIN', user.pin);
        showLoggedIn(user);
    } else if (!isAutoLogin) {
        dom.loginError.textContent = 'Nieprawidłowe dane logowania.';
        dom.loginError.classList.remove('hidden');
    }
}
async function logoutUser() {
    if (API_BASE) {
        await apiLogout();
        // Confidential transaction fields were delivered for this user: reload to drop them.
        location.reload();
        return;
    }
    state.currentUser = null;
    localStorage.removeItem('userIdentifier');
    localStorage.removeItem('userPIN');
    dom.loginButton.classList.remove('hidden');
    dom.profileButton.classList.add('hidden');
    dom.profilePic.src = 'placeholder.webp';
    if (state.modalHistory.length > 0) renderCurrentModal();
}
async function handleLogin(e) {
    e.preventDefault();
    const identifier = e.target.loginIdentifier.value.trim();
    const pin = e.target.pin.value.trim();
    if (!API_BASE) { loginUser(identifier, pin); return; }

    const submit = e.target.querySelector('button[type="submit"]');
    submit.disabled = true;
    const { user, error } = await apiLogin(identifier, pin);
    submit.disabled = false;
    if (error) {
        dom.loginError.textContent = error;
        dom.loginError.classList.remove('hidden');
        return;
    }
    // Reload so the snapshot is fetched with the new session (it includes this user's transaction details).
    location.reload();
}

// --- Lottery Functions ---
function setupLottery() {
    const { settings, allOwners, allPlots, lotteryHistory } = appData;
    if (!settings.plot_lottery_enabled) return;
    state.physicalPersons = allOwners.filter(o => o.type === 'fizyczna');
    const lotteryHistoryPlots = new Set(lotteryHistory.map(l => l.plotName));
    const legalEntityOwners = new Set(allOwners.filter(o => o.type === 'prawna' && !o.name.toLowerCase().includes('skarb miasta')).map(o => o.name));
    
    state.eligibleForLottery = allPlots.filter(plot => {
        if (lotteryHistoryPlots.has(plot.name)) return false;
        
        const lastPaidTransaction = [...plot.history].reverse().find(t => t.paid);
        if (!lastPaidTransaction || lastPaidTransaction.type !== 'Darowizna') return false;
        
        return legalEntityOwners.has(plot.owner);
    });
    
    if (state.eligibleForLottery.length > 0) {
        dom.lotteryButton.classList.remove('hidden');
    }
}
function openLottery() {
    dom.lotteryOverlay.classList.remove('hidden');
    dom.wheelCanvas.classList.add('wheel-idle-spin');
    dom.lotteryPlotsCount.textContent = `Działek w puli: ${state.eligibleForLottery.length}`;
    
    if(state.physicalPersons.length > 0) {
        const winner = state.physicalPersons[state.nextWinnerIndex % state.physicalPersons.length];
        dom.nextWinnerInfo.textContent = `Następne losowanie dla: ${winner.name}`;
    } else {
        dom.nextWinnerInfo.textContent = 'Brak graczy do losowania.';
    }

    drawWheel();
    dom.spinButton.disabled = !(state.currentUser && state.currentUser.staff);
}
function drawWheel() {
    const ctx = dom.wheelCanvas.getContext('2d');
    const numOptions = state.eligibleForLottery.length;
    if (numOptions === 0) {
        ctx.clearRect(0, 0, dom.wheelCanvas.width, dom.wheelCanvas.height);
        ctx.fillStyle = '#4B5563';
        ctx.beginPath();
        ctx.arc(250, 250, 245, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '24px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Brak działek w loterii', 250, 250);
        return;
    };
    const arcSize = 2 * Math.PI / numOptions;
    const radius = dom.wheelCanvas.width / 2;
    ctx.clearRect(0, 0, dom.wheelCanvas.width, dom.wheelCanvas.height);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    for (let i = 0; i < numOptions; i++) {
        const plot = state.eligibleForLottery[i];
        const angle = i * arcSize;
        ctx.beginPath();
        ctx.fillStyle = getColorForType(plot.type);
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius - 5, angle, angle + arcSize);
        ctx.lineTo(radius, radius);
        ctx.fill();
        ctx.stroke();

        if (numOptions <= 10) {
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.font = '14px Inter';
            ctx.translate(radius + Math.cos(angle + arcSize / 2) * (radius * 0.7), radius + Math.sin(angle + arcSize / 2) * (radius * 0.7));
            ctx.rotate(angle + arcSize / 2 + Math.PI / 2);
            ctx.fillText(plot.name, -ctx.measureText(plot.name).width / 2, 0);
            ctx.restore();
        }
    }
}
function spinWheel() {
    if (state.eligibleForLottery.length === 0) return;
    dom.spinButton.disabled = true;
    dom.wheelCanvas.classList.remove('wheel-idle-spin');
    const numOptions = state.eligibleForLottery.length;
    const degrees = Math.random() * 360 + 360 * 5;
    const currentRotation = parseFloat(dom.wheelCanvas.style.transform.replace(/[^0-9.-]/g, '')) || 0;

    // Force reflow
    setTimeout(() => {
        dom.wheelCanvas.style.transition = 'transform 5s cubic-bezier(.24,.99,.43,1)';
        dom.wheelCanvas.style.transform = `rotate(${currentRotation + degrees}deg)`;
    }, 0);
    
    setTimeout(() => {
        const finalAngle = (currentRotation + degrees) % 360;
        const winningIndex = Math.floor(numOptions - (finalAngle / (360 / numOptions))) % numOptions;
        const winningPlot = state.eligibleForLottery[winningIndex];
        const winner = state.physicalPersons[state.nextWinnerIndex % state.physicalPersons.length];
        state.nextWinnerIndex++;
        
        showLotteryResult(winningPlot, winner, winningIndex);
    }, 5100);
}
function showLotteryResult(plot, winner, winningIndex) {
    dom.lotteryResult.innerHTML = `
        <div class="space-y-4">
            <h2 class="text-4xl font-bold text-yellow-400">Gratulacje!</h2>
            <p class="text-2xl">${esc(winner.name)}</p>
            <p class="text-lg">wygrywa działkę</p>
            <p class="text-3xl font-bold text-purple-400">${esc(plot.name)}</p>
            <button id="close-result-button" class="mt-8 bg-purple-600 text-white font-bold py-2 px-6 rounded-lg">OK</button>
        </div>
    `;
    dom.lotteryResult.classList.remove('hidden');
    for(let i=0; i<100; i++) { createConfetti(); }
    document.getElementById('close-result-button').addEventListener('click', () => {
        dom.lotteryResult.classList.add('hidden');
        
        state.eligibleForLottery.splice(winningIndex, 1);
        
        if (state.eligibleForLottery.length > 0) {
            openLottery();
        } else {
            dom.lotteryOverlay.classList.add('hidden');
        }
    });
}
function createConfetti() {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${Math.random() * 100}vw`;
    confetti.style.animationDuration = `${Math.random() * 1 + 1}s`;
    confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
    dom.lotteryResult.appendChild(confetti);
    setTimeout(() => confetti.remove(), 2000);
}

