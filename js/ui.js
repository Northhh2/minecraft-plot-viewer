import { state } from './state.js';
import { getColorForType } from './utils.js';

let appData;
let dom;
let isAnimatingModal = false;

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
    };
    
    setupEventListeners();
    setupLottery();
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
    let statusText = '', statusColor = '';
    if (plot.status === 'pending') {
        statusText = 'W trakcie zmiany własności';
        statusColor = 'text-yellow-400';
    } else {
        const isOwned = plot.owner && plot.owner.trim() !== '' && !plot.owner.toLowerCase().includes('skarb miasta');
        statusText = isOwned ? 'Zajęta' : 'Wolna';
        statusColor = isOwned ? 'text-red-400' : 'text-green-400';
    }
    dom.tooltip.innerHTML = `<div class="font-bold">${plot.name || `Działka ${plot.id}`}</div><div class="text-xs ${statusColor}">${statusText}</div>`;
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
            dom.tooltip.innerHTML = `<div class="font-semibold">${plot.name}</div>`;
            dom.tooltip.classList.remove('hidden');
            moveTooltip(e);
        }
    });

    dom.wheelCanvas.addEventListener('mouseleave', hideTooltip);
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

function renderPlotContent(plot) {
    const { allLocals, lotteryHistory } = appData;
    const isOwned = plot.owner && plot.owner.trim() !== '' && !plot.owner.toLowerCase().includes('skarb miasta');
    const ownerInfo = plot.owner || 'Skarb Miasta';
    
    const localsOnPlot = allLocals.filter(l => l.plotName === plot.name);
    let localsHTML = '';

    if (localsOnPlot.length === 1) {
        const singleLocal = localsOnPlot[0];
        const localTitle = `Lokal #${singleLocal.klatka ? singleLocal.klatka + '/' : ''}${singleLocal.localNum}`;
        localsHTML = `<div class="border-t border-gray-700 pt-3 mt-3">
            <h4 class="text-md font-semibold">${localTitle}</h4>
            <div class="space-y-3 mt-2">
               <div><span class="text-gray-400 text-sm">Najemca:</span>${createOwnerCardHTML(singleLocal.tenant || 'Brak')}</div>
               <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-3 border-t border-gray-700">
                   <span class="text-gray-400">Powierzchnia:</span><span class="font-medium">${singleLocal.area} m²</span>
                   <span class="text-gray-400">Piętro:</span><span class="font-medium">${singleLocal.floor}</span>
                   <span class="text-gray-400">Miejsca pracy:</span><span class="font-medium">${singleLocal.workplaces}</span>
                   <span class="text-gray-400">Ilość łóżek:</span><span class="font-medium">${singleLocal.beds}</span>
               </div>
            </div>
        </div>`;

    } else if (localsOnPlot.length > 1) {
        const localDetailsList = localsOnPlot.map(l => {
            const localTitle = `Lokal #${l.klatka ? l.klatka + '/' : ''}${l.localNum}`;
            return `<div data-local-id="${l.id}" class="bg-gray-700 p-2 rounded-md hover:bg-gray-600 cursor-pointer transition-colors">
                <div class="font-semibold text-purple-400">${localTitle} (${l.area} m²)</div>
                <div class="text-xs text-gray-400">Najemca: <span class="font-medium text-gray-200">${l.tenant || 'Brak'}</span></div></div>`
        }).join('');
        localsHTML = `<div class="border-t border-gray-700 pt-3 mt-3"><h4 class="text-md font-semibold mb-3">Lokale w budynku (${localsOnPlot.length})</h4><div class="space-y-2">${localDetailsList}</div></div>`;
    }

    let address = '';
    if (plot.street && plot.buildingNumber) {
        address += `<span data-street-name="${plot.street}" class="clickable">${plot.street}</span> ${plot.buildingNumber}, `;
    }
    if (plot.district) {
        address += `<span data-district-name="${plot.district}" class="clickable">${plot.district}</span>`;
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
                    <div class="text-xs text-gray-400 mt-1">Wartość: ${t.transactionValue || 'Brak'} | Czek: #${t.checkNumber || 'Brak'}</div>
                 `;
            }

            return `
            <div class="bg-gray-700 p-2 rounded-md">
                <div class="flex justify-between items-center">
                    <div class="text-xs text-gray-400">${t.type}</div>
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
        const lastPaidTransaction = [...plot.history].reverse().find(t => t.paid);
        const transactionIndex = plot.history.findIndex(h => h.date === lastPaidTransaction.date && h.newOwner === lastPaidTransaction.newOwner);
        const donorName = (transactionIndex > 0) ? plot.history[transactionIndex - 1].newOwner : 'Skarb Miasta';
        lotteryBadgeHTML = createDonorBadgeHTML(donorName);
    }

    return `<div><h3 class="text-2xl font-bold ${isOwned ? 'text-red-400' : 'text-green-400'}">${plot.name}</h3><p class="text-gray-400 text-sm">${address}</p></div>
        <div class="space-y-3">
            ${createOwnerCardHTML(ownerInfo)}
            ${lotteryBadgeHTML}
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-3 border-t border-gray-700">
                <span class="text-gray-400">Typ:</span><span class="font-medium flex items-center clickable" data-plot-type="${plot.type}">${typeColorDot} ${plot.type || 'Brak'}</span>
                <span class="text-gray-400">Wartość:</span><span class="font-medium flex items-center">${plot.value || '0'} <img src="minecoin.webp" class="inline w-4 h-4 ml-1" alt="MC"></span>
                <span class="text-gray-400">Powierzchnia:</span><span class="font-medium">${plot.area || 'Brak'} m²</span>
                <span class="text-gray-400">Rozmiar:</span><span class="font-medium">${plot.width}x${plot.height} m</span>
            </div></div>
        ${historyHTML}
        ${localsHTML}`;
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
        address += `<span data-street-name="${local.street}" class="clickable">${local.street}</span> ${buildingPart}/${local.localNum}, `;
    }
    if (plot?.district) {
        address += `<span data-district-name="${plot.district}" class="clickable">${plot.district}</span>`;
    }
    
    const localTitle = `Lokal #${local.klatka ? local.klatka + '/' : ''}${local.localNum}`;
    return `<div><h3 class="text-2xl font-bold text-cyan-400">${localTitle}</h3><p class="text-gray-400 text-sm">${address}</p></div>
         <div class="space-y-3">
            <div><span class="text-gray-400 text-sm">Najemca:</span>${createOwnerCardHTML(local.tenant || 'Brak')}</div>
            <div><span class="text-gray-400 text-sm">Właściciel budynku:</span>${createOwnerCardHTML(plot?.owner)}</div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-3 border-t border-gray-700">
                <span class="text-gray-400">Powierzchnia:</span><span class="font-medium">${local.area} m²</span>
                <span class="text-gray-400">Piętro:</span><span class="font-medium">${local.floor}</span>
                <span class="text-gray-400">Miejsca pracy:</span><span class="font-medium">${local.workplaces}</span>
                <span class="text-gray-400">Ilość łóżek:</span><span class="font-medium">${local.beds}</span>
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
        ownerDetailsHTML += `<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm"><span class="text-gray-400">NIO:</span><span>${owner.nio || 'Brak'}</span>`;
        if(owner.type === 'fizyczna') ownerDetailsHTML += `<span class="text-gray-400">Wiek:</span><span>${owner.age || 'Brak'}</span><span class="text-gray-400">Zawód:</span><span>${owner.profession || 'Brak'}</span>`;
        else if(owner.type === 'prawna') ownerDetailsHTML += `<span class="text-gray-400">Forma Prawna:</span><span>${owner.legalForm || 'Brak'}</span>`;
        ownerDetailsHTML += '</div>';
    }
    const rentedLocalsHTML = rentedLocals.map(l => `<div class="bg-gray-700 p-2 rounded-md"><div data-local-id="${l.id}" class="cursor-pointer">
        <div class="font-semibold text-purple-400">Lokal #${l.klatka ? l.klatka + '/' : ''}${l.localNum} w ${l.plotName}</div><div class="text-xs text-gray-400">Powierzchnia: ${l.area} m²</div></div>
        <div class="mt-2 text-xs text-gray-400">Wynajmowane od:</div>${createOwnerCardHTML(allPlots.find(p=>p.name===l.plotName)?.owner)}</div>`).join('');
    
    let sponsoredPlotsHTML = '';
    const wonAndPaidPlots = lotteryHistory.filter(l => l.winner === ownerName && l.paid);

    if (wonAndPaidPlots.length > 0) {
        const wonList = wonAndPaidPlots.map(l => {
            const plot = allPlots.find(p => p.name === l.plotName);
            if (!plot) return '';

            const lastPaidTransaction = [...plot.history].reverse().find(t => t.paid);
            if(!lastPaidTransaction) return '';
            const transactionIndex = plot.history.findIndex(h => h.date === lastPaidTransaction.date && h.newOwner === lastPaidTransaction.newOwner);
            const donorName = (transactionIndex > 0) ? plot.history[transactionIndex - 1].newOwner : 'Skarb Miasta';
            
            return `<div class="bg-gray-700 p-2 rounded-md">
                <div data-plot-name="${l.plotName}" class="font-semibold text-purple-400 cursor-pointer hover:underline">${l.plotName}</div>
                <div class="text-xs text-gray-400">Otrzymano od: <span class="font-medium text-gray-200">${donorName}</span></div>
            </div>`;
        }).join('');
        sponsoredPlotsHTML = `<div class="border-t border-gray-700 pt-3"><h4 class="font-semibold text-md mb-2">Działki zdobyte w Loterii (${wonAndPaidPlots.length})</h4><div class="space-y-2">${wonList}</div></div>`;
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
        ${sponsoredPlotsHTML}
        ${logoutButtonHTML}
        </div>`;
}

function renderDistrictContent(districtName, plotsInDistrict) {
    const totalArea = plotsInDistrict.reduce((sum, p) => sum + (parseInt(p.area) || 0), 0);
    return `<div><h3 class="text-2xl font-bold text-purple-400">${districtName}</h3></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b border-gray-700 pb-3 mb-3">
            <span>Liczba działek:</span><span class="font-medium">${plotsInDistrict.length}</span>
            <span>Łączna powierzchnia:</span><span class="font-medium">${totalArea.toLocaleString()} m²</span></div>
        <div class="space-y-2 mb-4">${plotsInDistrict.map(p => createPlotListItemHTML(p)).join('')}</div>`;
}

function renderStreetContent(streetName) {
    const { streets, allPlots } = appData;
    const street = streets.find(s => s.name === streetName);
    if (!street) return '<p>Nie znaleziono ulicy.</p>';
    const plotsOnStreet = allPlots.filter(p => p.street === streetName);
    const length = street.width > street.height ? street.width : street.height;
    return `<div><h3 class="text-2xl font-bold text-blue-400">${streetName}</h3></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b border-gray-700 pb-3 mb-3">
            <span>Długość:</span><span class="font-medium">${length} m</span>
            <span>Liczba działek:</span><span class="font-medium">${plotsOnStreet.length}</span></div>
        <div class="space-y-2 mb-4">${plotsOnStreet.map(p => createPlotListItemHTML(p)).join('')}</div>`;
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

    return `<div><h3 class="text-2xl font-bold flex items-center">${typeColorDot} ${typeName}</h3></div>
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
    let statusText = '', statusColor = '';
    if (plot.status === 'pending') {
        statusText = 'W trakcie zmiany własności';
        statusColor = 'text-yellow-400';
    } else {
        const isOwned = plot.owner && plot.owner.trim() !== '' && !plot.owner.toLowerCase().includes('skarb miasta');
        statusText = isOwned ? 'Zajęta' : 'Wolna';
        statusColor = isOwned ? 'text-red-400' : 'text-green-400';
    }
    return `<div data-plot-name="${plot.name}" class="bg-gray-700 p-2 rounded-md hover:bg-gray-600 cursor-pointer transition-colors">
        <div class="font-semibold text-purple-400">${plot.name} (${plot.area} m²)</div>
        <div class="text-xs text-gray-400">Właściciel: <span class="font-medium text-gray-200">${plot.owner || 'Brak'}</span></div>
        <div class="text-xs ${statusColor}">${statusText}</div></div>`;
}

function createOwnerCardHTML(ownerName, isSelf = false) {
    if (!ownerName) return '';
    const { allOwners } = appData;
    const owner = allOwners.find(o => o.name === ownerName);
    const isClickable = !isSelf && !ownerName.toLowerCase().includes('skarb miasta');
    const photo = owner?.photo || 'placeholder.webp';
    const type = owner?.type ? (owner.type.charAt(0).toUpperCase() + owner.type.slice(1)) : '';
    return `<div class="flex items-center bg-gray-700 p-2 rounded-md transition-colors ${isClickable ? 'clickable hover:bg-gray-600' : ''}" ${isClickable ? `data-owner-name="${ownerName}"` : ''}>
        <img src="${photo}" onerror="this.onerror=null;this.src='placeholder.webp';" class="w-10 h-10 rounded-full mr-3 object-cover">
        <div><div class="font-semibold text-white">${ownerName}</div><div class="text-xs text-gray-400">${type}</div></div></div>`;
}

function createDonorBadgeHTML(donorName) {
    if (!donorName) return '';
    const { allOwners } = appData;
    const owner = allOwners.find(o => o.name === donorName);
    const photo = owner?.photo || 'placeholder.webp';
    return `<div class="mt-2">
        <div class="text-xs text-yellow-300 mb-1">Hojny Darczyńca Loterii Działkowej</div>
        <div class="flex items-center p-2 rounded-md donor-badge">
            <img src="${photo}" onerror="this.onerror=null;this.src='placeholder.webp';" class="w-8 h-8 rounded-full mr-3 object-cover border-2 border-yellow-600">
            <div>
                <div class="font-semibold text-yellow-900">${donorName}</div>
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
    const modalLogoutButton = document.getElementById('modal-logout-button');
    if (modalLogoutButton) {
        modalLogoutButton.addEventListener('click', () => {
            closeModal();
            logoutUser();
        });
    }
}

// --- Auth Functions ---
function attemptAutoLogin() {
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
        state.currentUser = user;
        localStorage.setItem('userIdentifier', user.nio || user.name);
        localStorage.setItem('userPIN', user.pin);
        dom.loginModal.classList.add('hidden');
        dom.loginButton.classList.add('hidden');
        dom.profilePic.src = user.photo || 'placeholder.webp';
        dom.profileButton.classList.remove('hidden');
        dom.loginError.classList.add('hidden');
        dom.loginForm.reset();
        if (state.modalHistory.length > 0) renderCurrentModal();
    } else if (!isAutoLogin) {
        dom.loginError.textContent = 'Nieprawidłowe dane logowania.';
        dom.loginError.classList.remove('hidden');
    }
}
function logoutUser() {
    state.currentUser = null;
    localStorage.removeItem('userIdentifier');
    localStorage.removeItem('userPIN');
    dom.loginButton.classList.remove('hidden');
    dom.profileButton.classList.add('hidden');
    dom.profilePic.src = 'placeholder.webp';
    if (state.modalHistory.length > 0) renderCurrentModal();
}
function handleLogin(e) {
    e.preventDefault();
    const identifier = e.target.loginIdentifier.value;
    const pin = e.target.pin.value;
    loginUser(identifier, pin);
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
        const transactionIndex = plot.history.findIndex(h => h.date === lastPaidTransaction.date && h.newOwner === lastPaidTransaction.newOwner);
        const donorName = (transactionIndex > 0) ? plot.history[transactionIndex - 1].newOwner : 'Skarb Miasta';
        return legalEntityOwners.has(donorName);
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
        const angle = i * arcSize;
        ctx.beginPath();
        ctx.fillStyle = i % 2 === 0 ? '#4f46e5' : '#7c3aed';
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
            ctx.fillText(state.eligibleForLottery[i].name, -ctx.measureText(state.eligibleForLottery[i].name).width / 2, 0);
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
    dom.wheelCanvas.style.transform = `rotate(${currentRotation + degrees}deg)`;
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
            <p class="text-2xl">${winner.name}</p>
            <p class="text-lg">wygrywa działkę</p>
            <p class="text-3xl font-bold text-purple-400">${plot.name}</p>
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

