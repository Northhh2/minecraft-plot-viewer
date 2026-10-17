// One-off migration: Google Sheet (public CSV export) -> api/seed.sql for D1.
// Usage: cd tools && npm install && node import-sheet.mjs [out.sql]
// Then:  cd ../api && npx wrangler d1 execute plot-portal --file=schema.sql
//        npx wrangler d1 execute plot-portal --file=seed.sql
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const SHEET_ID = '1swtElpz27sqLMNbATocFe9VHc1yZTSRxvHyikFL_R7U';
const GIDS = {
    plots: '0', merged: '43897086', streets: '2101138806', locals: '875214507',
    owners: '92681717', transactions: '231383988', settings: '464636229', lottery: '1580637376'
};
const TREASURY = 'skarb miasta';

const outFile = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'api', 'seed.sql');

async function loadTab(name) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GIDS[name]}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return Papa.parse(await res.text(), { header: true, skipEmptyLines: true }).data;
}

const int = v => {
    const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
};
const str = v => (v == null || String(v).trim() === '' ? null : String(v).trim());
const sql = v => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const tabs = {};
for (const name of Object.keys(GIDS)) tabs[name] = await loadTab(name);

const rows = []; // [table, {col: value}]
const insert = (table, obj) => rows.push(`INSERT INTO ${table} (${Object.keys(obj).join(', ')}) VALUES (${Object.values(obj).map(sql).join(', ')});`);

// --- lookups ---------------------------------------------------------------
const idMap = () => { const m = new Map(); return { get: k => m.get(k), getOrAdd: k => { if (!m.has(k)) m.set(k, m.size + 1); return m.get(k); }, entries: () => [...m] }; };
const zoning = idMap(), districts = idMap();

// --- owners: fizyczna -> citizen, prawna -> company; treasury = NULL owner ----
const ownerRefs = new Map(); // lower-case name -> {kind, number}
let citizenSeq = 0, companySeq = 0;
for (const o of tabs.owners) {
    const name = str(o['Nazwa']);
    if (!name || name.toLowerCase() === TREASURY) continue;
    if (str(o['Typ']) === 'fizyczna') {
        const number = ++citizenSeq;
        ownerRefs.set(name.toLowerCase(), { kind: 'citizen', number });
        insert('citizens', {
            number, name, nio: str(o['NIO']), age: str(o['Wiek']), profession: str(o['Zawód']),
            photo_url: str(o['Zdjęcie']), role: o['Obsługa'] === 'Tak' ? 'clerk' : 'citizen'
        });
    } else {
        const number = ++companySeq;
        ownerRefs.set(name.toLowerCase(), { kind: 'company', number });
        insert('companies', { number, name, legal_form: str(o['Forma prawna']), photo_url: str(o['Zdjęcie']) });
    }
}
const refOf = name => ownerRefs.get(String(name ?? '').trim().toLowerCase()) ?? null;

// --- streets (segments with same name stay separate rows) ---------------------
const streetIds = new Map(); // name -> first street id
let streetSeq = 0;
for (const s of tabs.streets) {
    if (!s['X (lewy górny)'] || !s['Z (lewy górny)'] || !s['X (prawy dolny)'] || !s['Z (prawy dolny)']) continue;
    const id = ++streetSeq, name = str(s['Nazwa ulicy']) ?? `Ulica ${id}`;
    if (!streetIds.has(name)) streetIds.set(name, id);
    const [xa, xb] = [int(s['X (lewy górny)']), int(s['X (prawy dolny)'])].sort((a, b) => a - b);
    const [za, zb] = [int(s['Z (lewy górny)']), int(s['Z (prawy dolny)'])].sort((a, b) => a - b);
    insert('streets', { id, name, x1: xa, z1: za, x2: xb, z2: zb });
}

// --- plots ---------------------------------------------------------------------
const transactionsByPlot = new Map();
for (const t of tabs.transactions) {
    const plot = str(t['Numer działki']);
    if (!plot) continue;
    if (!transactionsByPlot.has(plot)) transactionsByPlot.set(plot, []);
    transactionsByPlot.get(plot).push(t);
}
for (const list of transactionsByPlot.values()) list.sort((a, b) => int(a['Dzień transakcji']) - int(b['Dzień transakcji']));

const plotIds = new Map(); // plot name -> id
let plotSeq = 0;
const usedPlotIds = new Set();
const priceSamples = new Map(); // zoning name -> [pricePer100]
const plotRows = [];
for (const p of tabs.plots) {
    if (!p['Nr porządkowy'] || !p['X (lewy górny)'] || !p['Z (lewy górny)'] || !p['Bok X'] || !p['Bok Z']) continue;
    // Keep the sheet's own number as the id (the map label shows it); fall back to a sequence on clashes.
    const sheetNo = int(p['Nr porządkowy']);
    const id = sheetNo > 0 && !usedPlotIds.has(sheetNo) ? sheetNo : Math.max(0, ...usedPlotIds) + 1;
    usedPlotIds.add(id);
    plotSeq++;
    const name = str(p['Nazwa porządkowa działki']) ?? str(p['Nr porządkowy']);
    plotIds.set(name, id);
    const sideX = Math.abs(int(p['Bok X'])), sideZ = Math.abs(int(p['Bok Z']));
    const area = int(p['Powierzchnia']) || sideX * sideZ, value = int(p['Wartość']);
    const typeName = str(p['Typ']);
    const zoningId = typeName ? zoning.getOrAdd(typeName) : null;
    if (typeName && area > 0 && value > 0) {
        if (!priceSamples.has(typeName)) priceSamples.set(typeName, []);
        priceSamples.get(typeName).push(Math.round(value / area * 100));
    }
    const district = str(p['Dzielnica']);
    const history = transactionsByPlot.get(name) ?? [];
    const lastPaid = [...history].reverse().find(t => t['Opłacone?'] === 'TRUE');
    const ref = lastPaid ? refOf(lastPaid['Nowy właściciel']) : null;
    plotRows.push({
        id, name, zoning_type_id: zoningId,
        x1: int(p['X (lewy górny)']), z1: int(p['Z (lewy górny)']),
        x2: int(p['X (prawy dolny)']), z2: int(p['Z (prawy dolny)']),
        side_x: sideX, side_z: sideZ, area, value,
        district_id: district ? districts.getOrAdd(district) : null,
        street_id: streetIds.get(str(p['Ulica'])) ?? null,
        building_number: str(p['Numer budynku']),
        owner_kind: ref?.kind ?? null, owner_number: ref?.number ?? null
    });
}

// lookup tables must precede plots because of foreign keys
for (const [name, id] of zoning.entries()) {
    const samples = (priceSamples.get(name) ?? []).sort((a, b) => a - b);
    insert('zoning_types', { id, name, price_per_100_blocks: samples.length ? samples[Math.floor(samples.length / 2)] : 0 });
}
for (const [name, id] of districts.entries()) insert('districts', { id, name });
// streets/citizens/companies were inserted earlier but must come before plots: reorder below.
for (const r of plotRows) insert('plots', r);

// --- ownership history ----------------------------------------------------------
let ownSeq = 0;
for (const [plotName, list] of transactionsByPlot) {
    const plotId = plotIds.get(plotName);
    if (!plotId) continue;
    for (const t of list) {
        const ref = refOf(t['Nowy właściciel']);
        insert('ownership_history', {
            id: ++ownSeq, plot_id: plotId, owner_kind: ref?.kind ?? null, owner_number: ref?.number ?? null,
            transaction_value: str(t['Wartość transakcji']), transaction_day: int(t['Dzień transakcji']),
            transaction_type: str(t['Typ transakcji']), check_number: str(t['Numer czeku']),
            paid: t['Opłacone?'] === 'TRUE' ? 1 : 0
        });
    }
}

// --- units (locals) -------------------------------------------------------------
let unitSeq = 0;
for (const l of tabs.locals) {
    const plotId = plotIds.get(str(l['Numer działki']));
    if (!plotId) continue;
    const tenantName = str(l['Najemca']), ref = refOf(tenantName);
    insert('units', {
        id: ++unitSeq, plot_id: plotId, unit_number: str(l['Numer lokalu']), stairwell: str(l['Klatka']),
        floor: str(l['Piętro']), area: int(l['Powierzchnia']), bed_count: int(l['Ilość łóżek']),
        workplace_count: int(l['Ilość miejsc pracy']),
        tenant_kind: ref?.kind ?? null, tenant_number: ref?.number ?? null,
        tenant_label: ref ? null : tenantName
    });
}

// --- lottery / merges / settings ------------------------------------------------
let lotSeq = 0;
for (const l of tabs.lottery) {
    const plotId = plotIds.get(str(l['Działka']));
    if (!plotId) continue;
    const ref = refOf(l['Zwycięzca']);
    insert('lottery', {
        id: ++lotSeq, plot_id: plotId, winner_kind: ref?.kind ?? null, winner_number: ref?.number ?? null,
        amount: str(l['Kwota']), check_number: str(l['Numer czeku']), paid: l['Opłacone?'] === 'TRUE' ? 1 : 0
    });
}
let mergeSeq = 0;
for (const m of tabs.merged) {
    const a = plotIds.get(str(m['Działka główna'])), b = plotIds.get(str(m['Działka dołączana']));
    if (a && b) insert('merges', { id: ++mergeSeq, main_plot_id: a, merging_plot_id: b });
}
for (const s of tabs.settings) {
    if (str(s['Ustawienie'])) insert('settings', { key: str(s['Ustawienie']), value: s['Włączone?'] === 'TRUE' ? 1 : 0 });
}

// FK order: lookups and owners first, then plots, then everything that references plots.
const order = ['zoning_types', 'districts', 'streets', 'citizens', 'companies', 'plots', 'ownership_history', 'units', 'lottery', 'merges', 'settings'];
const tableOf = line => line.match(/^INSERT INTO (\w+)/)[1];
rows.sort((a, b) => order.indexOf(tableOf(a)) - order.indexOf(tableOf(b)));

const header = '-- Generated by tools/import-sheet.mjs. Safe to re-run after clearing tables.\n';
fs.writeFileSync(outFile, header + rows.join('\n') + '\n');
console.log(`Wrote ${rows.length} statements to ${outFile}`);
console.log(`plots=${plotSeq} streets=${streetSeq} citizens=${citizenSeq} companies=${companySeq} units=${unitSeq} transactions=${ownSeq}`);
