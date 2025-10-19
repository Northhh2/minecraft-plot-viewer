export async function fetchData(urls) {
    const responses = await Promise.all(Object.values(urls).map(url => fetch(url)));
    const texts = await Promise.all(responses.map(res => res.text()));
    const results = await Promise.all(texts.map(text => new Promise(resolve => Papa.parse(text, { header: true, skipEmptyLines: true, complete: resolve }))));
    
    return Object.fromEntries(
        Object.keys(urls).map((key, index) => [key, results[index].data])
    );
}

export function processData(rawData) {
    const allPlots = rawData.plots.map(d => ({
        id: d['Nr porządkowy'], name: d['Nazwa porządkowa działki'], type: d['Typ'],
        x1: parseInt(d['X (lewy górny)'], 10), z1: parseInt(d['Z (lewy górny)'], 10),
        x2: parseInt(d['X (prawy dolny)'], 10), z2: parseInt(d['Z (prawy dolny)'], 10),
        width: Math.abs(parseInt(d['Bok X'], 10)), height: Math.abs(parseInt(d['Bok Z'], 10)),
        area: d['Powierzchnia'], value: d['Wartość'], owner: 'Skarb Miasta', status: 'owned',
        district: d['Dzielnica'], street: d['Ulica'], buildingNumber: d['Numer budynku'], history: []
    }));

    const allLocals = rawData.locals.map(l => {
        const parentPlot = allPlots.find(p => p.name === l['Numer działki']);
        return {
            id: l['Numer porządkowy'], plotName: l['Numer działki'],
            street: parentPlot ? parentPlot.street : '', building: parentPlot ? parentPlot.buildingNumber : '',
            klatka: l['Klatka'], localNum: l['Numer lokalu'], floor: l['Piętro'],
            area: parseInt(l['Powierzchnia']) || 0, beds: parseInt(l['Ilość łóżek']) || 0,
            workplaces: parseInt(l['Ilość miejsc pracy']) || 0, tenant: l['Najemca']
        };
    });

    const allOwners = rawData.owners.map(o => ({
        name: o['Nazwa'], type: o['Typ'], photo: o['Zdjęcie'],
        nio: o['NIO'], age: o['Wiek'], profession: o['Zawód'], 
        legalForm: o['Forma prawna'], pin: o['PIN'], staff: o['Obsługa'] === 'Tak'
    }));
    
    const allTransactions = rawData.transactions.map(t => ({
        plotName: t['Numer działki'], newOwner: t['Nowy właściciel'],
        transactionValue: t['Wartość transakcji'], date: t['Dzień transakcji'],
        type: t['Typ transakcji'], checkNumber: t['Numer czeku'],
        paid: t['Opłacone?'] === 'TRUE'
    }));

    updatePlotOwners(allPlots, allTransactions);

    const mergedPlots = processMergedPlots(rawData.merged.map(d => ({ plot1: d['Działka główna'], plot2: d['Działka dołączana'] })), allPlots);
    
    const streets = rawData.streets.map(d => ({
        name: d['Nazwa ulicy'], x1: parseInt(d['X (lewy górny)'], 10), z1: parseInt(d['Z (lewy górny)'], 10),
        width: Math.abs(parseInt(d['X (prawy dolny)'], 10) - parseInt(d['X (lewy górny)'], 10)) + 1,
        height: Math.abs(parseInt(d['Z (prawy dolny)'], 10) - parseInt(d['Z (lewy górny)'], 10)) + 1
    }));
    
    const settings = {};
    rawData.settings.forEach(s => { settings[s['Ustawienie']] = s['Włączone?'] === 'TRUE'; });

    return { allPlots, allLocals, allOwners, allTransactions, mergedPlots, streets, settings, lotteryHistory: rawData.lottery };
}


function updatePlotOwners(allPlots, allTransactions) {
    const transactionsByPlot = {};
    allTransactions.forEach(t => {
        if (!transactionsByPlot[t.plotName]) transactionsByPlot[t.plotName] = [];
        transactionsByPlot[t.plotName].push(t);
    });
    for (const plotName in transactionsByPlot) {
        transactionsByPlot[plotName].sort((a, b) => {
            const dateA = a.date.split('.').reverse().join('');
            const dateB = b.date.split('.').reverse().join('');
            return dateA.localeCompare(dateB);
        });
    }
    allPlots.forEach(plot => {
        const plotTransactions = transactionsByPlot[plot.name];
        if (plotTransactions && plotTransactions.length > 0) {
            plot.history = plotTransactions;
            const lastTransaction = plotTransactions[plotTransactions.length - 1];
            const lastPaidTransaction = [...plotTransactions].reverse().find(t => t.paid);
            plot.owner = lastPaidTransaction ? lastPaidTransaction.newOwner : 'Skarb Miasta';
            plot.status = lastTransaction && !lastTransaction.paid ? 'pending' : 'owned';
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
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        stack.push(neighbor);
                    }
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
        return { plots: group, x1: minX, z1: minZ, x2: maxX, z2: maxZ, width: maxX - minX, height: maxZ - minZ, originalArea, mergedArea: (maxX - minX) * (maxZ - minZ) };
    }).filter(Boolean);
}
