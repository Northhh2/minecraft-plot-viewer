import { urls, API_BASE } from './config.js';
import { authHeaders, getToken } from './auth.js';

// Loads app data from the Worker API when API_BASE is set, otherwise from the legacy sheet.
export async function loadAppData() {
    if (!API_BASE) return processData(await fetchData());
    try {
        const [res, metroRes] = await Promise.all([
            fetch(`${API_BASE}/api/snapshot`, { headers: authHeaders(getToken()) }),
            // Revalidate: an admin's import or edit must show up on the reload that follows it, not 30 s later.
            fetch(`${API_BASE}/api/metro`, { cache: 'no-cache' }).catch(() => null)
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const appData = snapshotToAppData(await res.json());
        // The metro is optional: a failure here must not take the rest of the portal down.
        appData.metro = metroRes?.ok ? await metroRes.json().catch(() => null) : null;
        if (!appData.metro) appData.metro = { palette: [], stations: [], lines: [] };
        return appData;
    } catch (error) {
        console.error("Błąd podczas pobierania danych z API:", error);
        return null;
    }
}

// Maps a gov-land snapshot (schema/gov-land.schema.json) onto the shape the UI already consumes.
export function snapshotToAppData(s) {
    const byId = list => new Map(list.map(x => [x.id, x]));
    const zoning = byId(s.zoningTypes), districts = byId(s.districts), streetsById = byId(s.streets);
    const citizens = new Map(s.citizens.map(c => [c.number, c]));
    const companies = new Map(s.companies.map(c => [c.number, c]));
    const TREASURY = 'Skarb Miasta';
    const ownerName = ref => ref ? ((ref.kind === 'citizen' ? citizens : companies).get(ref.number)?.name ?? TREASURY) : TREASURY;
    const plotNames = new Map(s.plots.map(p => [p.id, p.name]));

    const allTransactions = s.ownershipHistory.map(o => ({
        plotName: plotNames.get(o.plotId),
        newOwner: ownerName(o.newOwner),
        transactionValue: o.transactionValue ?? '',
        date: String(o.transactionDay ?? ''),
        type: o.transactionType ?? '',
        checkNumber: o.checkNumber ?? '',
        paid: o.paid
    }));

    const allPlots = s.plots.map(p => ({
        id: String(p.id),
        name: p.name,
        type: zoning.get(p.zoningTypeId)?.name ?? '',
        x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2,
        width: p.sideX, height: p.sideZ,
        area: String(p.area), value: String(p.value),
        owner: TREASURY, status: 'owned',
        district: districts.get(p.districtId)?.name ?? '',
        street: streetsById.get(p.streetId)?.name ?? '',
        buildingNumber: p.buildingNumber ?? '',
        history: [],
        // Editor metadata (API mode only)
        dbId: p.id, version: p.version, zoningTypeId: p.zoningTypeId, districtId: p.districtId, streetId: p.streetId
    }));
    updatePlotOwners(allPlots, allTransactions);

    const allLocals = s.units.map(u => {
        const plot = allPlots.find(p => p.id === String(u.plotId));
        return {
            id: String(u.id), plotName: plot?.name ?? '',
            street: plot?.street ?? '', building: plot?.buildingNumber ?? '',
            klatka: u.stairwell ?? '', localNum: u.unitNumber ?? '', floor: u.floor ?? '',
            area: u.area, beds: u.bedCount, workplaces: u.workplaceCount,
            tenant: u.tenant ? ownerName(u.tenant) : (u.tenantLabel ?? '')
        };
    });

    // Never expose PIN data to the client; login moves to the API in a later stage.
    const allOwners = [
        ...s.citizens.map(c => ({
            name: c.name, type: 'fizyczna', photo: c.photoUrl ?? '', nio: c.nio ?? '', age: c.age ?? '',
            profession: c.profession ?? '', legalForm: '', pin: '', staff: c.role !== 'citizen',
            ref: { kind: 'citizen', number: c.number }
        })),
        ...s.companies.map(c => ({
            name: c.name, type: 'prawna', photo: c.photoUrl ?? '', nio: '', age: '',
            profession: '', legalForm: c.legalForm ?? '', pin: '', staff: false,
            ref: { kind: 'company', number: c.number }
        }))
    ];

    const lotteryHistory = s.lottery.map(l => ({
        plotName: plotNames.get(l.plotId), winner: ownerName(l.winner),
        amount: l.amount ?? '', checkNumber: l.checkNumber ?? '', paid: l.paid
    }));

    const mergedPlots = processMergedPlots(
        s.merges.map(m => ({ plot1: plotNames.get(m.mainPlotId), plot2: plotNames.get(m.mergingPlotId) })),
        allPlots
    );

    const streets = s.streets.map(st => ({
        id: st.id, name: st.name, x1: Math.min(st.x1, st.x2), z1: Math.min(st.z1, st.z2),
        width: Math.abs(st.x2 - st.x1) + 1, height: Math.abs(st.z2 - st.z1) + 1
    }));

    return {
        allPlots, allLocals, allOwners, allTransactions, mergedPlots, streets, settings: s.settings, lotteryHistory,
        districts: s.districts, zoningTypes: s.zoningTypes
    };
}

export async function fetchData() {
    try {
        const responses = await Promise.all(Object.values(urls).map(url => fetch(url)));
        if (responses.some(res => !res.ok)) throw new Error('Network response was not ok');

        const texts = await Promise.all(responses.map(res => res.text()));
        return await Promise.all(texts.map(text => new Promise(resolve => Papa.parse(text, { header: true, skipEmptyLines: true, complete: resolve }))));
    } catch (error) {
        console.error("Błąd podczas pobierania danych z sieci:", error);
        return null;
    }
}

export function processData(results) {
    if (!results) return null;

    try {
        const [plotsData, mergedData, streetsData, localsData, ownersData, transactionsData, settingsData, lotteryData] = results;

        const allPlots = plotsData.data
            .filter(d => 
                d['Nr porządkowy'] &&
                d['X (lewy górny)'] && d['Z (lewy górny)'] &&
                d['Bok X'] && d['Bok Z']
            )
            .map(d => ({
                id: d['Nr porządkowy'],
                name: d['Nazwa porządkowa działki'],
                type: d['Typ'],
                x1: parseInt(d['X (lewy górny)'], 10),
                z1: parseInt(d['Z (lewy górny)'], 10),
                x2: parseInt(d['X (prawy dolny)'], 10),
                z2: parseInt(d['Z (prawy dolny)'], 10),
                width: Math.abs(parseInt(d['Bok X'], 10)),
                height: Math.abs(parseInt(d['Bok Z'], 10)),
                area: d['Powierzchnia'],
                value: d['Wartość'],
                owner: 'Skarb Miasta',
                status: 'owned',
                district: d['Dzielnica'],
                street: d['Ulica'],
                buildingNumber: d['Numer budynku'],
                history: []
            }));

        const allLocals = localsData.data.map(l => {
            const parentPlot = allPlots.find(p => p.name === l['Numer działki']);
            return {
                id: l['Numer porządkowy'],
                plotName: l['Numer działki'],
                street: parentPlot ? parentPlot.street : '',
                building: parentPlot ? parentPlot.buildingNumber : '',
                klatka: l['Klatka'],
                localNum: l['Numer lokalu'],
                floor: l['Piętro'],
                area: parseInt(l['Powierzchnia'], 10) || 0,
                beds: parseInt(l['Ilość łóżek'], 10) || 0,
                workplaces: parseInt(l['Ilość miejsc pracy'], 10) || 0,
                tenant: l['Najemca']
            };
        });

        const allOwners = ownersData.data.map(o => ({
            name: o['Nazwa'],
            type: o['Typ'],
            photo: o['Zdjęcie'],
            nio: o['NIO'],
            age: o['Wiek'],
            profession: o['Zawód'], 
            legalForm: o['Forma prawna'],
            pin: o['PIN'],
            staff: o['Obsługa'] === 'Tak'
        }));
        
        const allTransactions = transactionsData.data.map(t => ({
            plotName: t['Numer działki'],
            newOwner: t['Nowy właściciel'],
            transactionValue: t['Wartość transakcji'],
            date: t['Dzień transakcji'],
            type: t['Typ transakcji'],
            checkNumber: t['Numer czeku'],
            paid: t['Opłacone?'] === 'TRUE'
        }));

        const settings = {};
        settingsData.data.forEach(s => { settings[s['Ustawienie']] = s['Włączone?'] === 'TRUE'; });
        
        const lotteryHistory = lotteryData.data.map(l => ({
            plotName: l['Działka'],
            winner: l['Zwycięzca'],
            amount: l['Kwota'],
            checkNumber: l['Numer czeku'],
            paid: l['Opłacone?'] === 'TRUE'
        }));

        updatePlotOwners(allPlots, allTransactions);

        const mergedPlots = processMergedPlots(mergedData.data.filter(m => m['Działka główna'] && m['Działka dołączana']).map(d => ({ plot1: d['Działka główna'], plot2: d['Działka dołączana'] })), allPlots);
        
        const streets = streetsData.data
            .filter(d => 
                d['X (lewy górny)'] && d['Z (lewy górny)'] &&
                d['X (prawy dolny)'] && d['Z (prawy dolny)']
            )
            .map(d => ({
                name: d['Nazwa ulicy'],
                x1: parseInt(d['X (lewy górny)'], 10),
                z1: parseInt(d['Z (lewy górny)'], 10),
                width: Math.abs(parseInt(d['X (prawy dolny)'], 10) - parseInt(d['X (lewy górny)'], 10)) + 1,
                height: Math.abs(parseInt(d['Z (prawy dolny)'], 10) - parseInt(d['Z (lewy górny)'], 10)) + 1
            }));

        return {
            allPlots, allLocals, allOwners, allTransactions,
            mergedPlots, streets, settings, lotteryHistory
        };

    } catch (error) {
        console.error("Błąd podczas przetwarzania danych:", error);
        return null;
    }
}

function updatePlotOwners(allPlots, allTransactions) {
    const transactionsByPlot = {};
    allTransactions.forEach(t => {
        if (t.plotName) {
            if (!transactionsByPlot[t.plotName]) transactionsByPlot[t.plotName] = [];
            transactionsByPlot[t.plotName].push(t);
        }
    });

    for (const plotName in transactionsByPlot) {
        transactionsByPlot[plotName].sort((a, b) => (parseInt(a.date, 10) || 0) - (parseInt(b.date, 10) || 0));
    }
    
    allPlots.forEach(plot => {
        const plotTransactions = transactionsByPlot[plot.name];
        if (plotTransactions && plotTransactions.length > 0) {
            plot.history = plotTransactions;
            
            const lastTransaction = plotTransactions[plotTransactions.length - 1];
            const lastPaidTransaction = [...plotTransactions].reverse().find(t => t.paid);

            plot.owner = lastPaidTransaction ? lastPaidTransaction.newOwner : 'Skarb Miasta';
            plot.status = (lastTransaction && !lastTransaction.paid) ? 'pending' : 'owned';
        }
    });
}

function processMergedPlots(connections, allPlots) {
    const adj = new Map();
    connections.forEach(({ plot1, plot2 }) => {
        if (!adj.has(plot1)) adj.set(plot1, []);
        if (!adj.has(plot2)) adj.set(plot2, []);
        adj.get(plot1).push(plot2);
        adj.get(plot2).push(plot1);
    });

    const visited = new Set();
    const groups = [];
    for (const plotId of adj.keys()) {
        if (!visited.has(plotId)) {
            const group = []; const stack = [plotId];
            visited.add(plotId);
            while (stack.length > 0) {
                const currentId = stack.pop();
                group.push(currentId);
                for (const neighbor of (adj.get(currentId) || [])) {
                    if (!visited.has(neighbor)) { visited.add(neighbor); stack.push(neighbor); }
                }
            }
            groups.push(group);
        }
    }
    return groups.map(group => {
        const plotsInGroup = group.map(id => allPlots.find(p => p.name === id)).filter(Boolean);
        if (plotsInGroup.length === 0) return null;
        const minX = Math.min(...plotsInGroup.map(p => p.x1));
        const maxX = Math.max(...plotsInGroup.map(p => p.x2));
        const minZ = Math.min(...plotsInGroup.map(p => p.z1));
        const maxZ = Math.max(...plotsInGroup.map(p => p.z2));
        const originalArea = plotsInGroup.reduce((sum, p) => sum + (parseInt(p.area) || 0), 0);
        return {
            plots: group, x1: minX, z1: minZ, x2: maxX, z2: maxZ,
            width: maxX - minX, height: maxZ - minZ, originalArea, mergedArea: (maxX - minX) * (maxZ - minZ)
        };
    }).filter(Boolean);
}

