// City information shown inside the Ratusz modal (the City Treasury's headquarters): the snapshot pushed by the sync agent
// (GET /api/city). Public, no login.
import { API_BASE } from './config.js';
import { state } from './state.js';

const MOTION_TYPES = ['Zmiana kodeksu', 'Debata', 'Absolutorium', 'Wniosek formalny', 'Wniosek o wybory', 'Odwołanie', 'Budżet', 'Wotum zaufania', 'Komisja', 'Zmiana dodatku', 'Projekt miejski', 'Głosowanie nad zmienną'];
const PROJECT_STATUS = { draft: 'Szkic', proposed: 'U Rady', approved: 'Zatwierdzony', collecting: 'Zbiórka', completed: 'Ukończony', rejected: 'Odrzucony', cancelled: 'Anulowany' };
const CITIZEN_STATUS = ['—', 'Wniosek', 'Obywatel', 'Odrzucony'];
const COUNCIL_ROLE = ['', 'Radny', 'Przewodniczący'];
const CODEX_NAMES = { civil: 'Kodeks cywilny', criminal: 'Kodeks karny', construction: 'Kodeks budowlany' };
const TABS = [['projects', 'Projekty'], ['citizens', 'Obywatele'], ['companies', 'Firmy'], ['permits', 'Pozwolenia'], ['variables', 'Zmienne'], ['council', 'Rada'], ['census', 'Cenzusy'], ['elections', 'Wybory'], ['positions', 'Stanowiska']];

// Villager professions: icon + Polish name (keys are what the game's census tallies).
const PROFESSIONS = {
    farmer: 'Rolnik',
    fisherman: 'Rybak',
    fletcher: 'Łuczarz',
    shepherd: 'Pasterz',
    librarian: 'Bibliotekarz',
    cartographer: 'Kartograf',
    cleric: 'Kapłan',
    armorer: 'Płatnerz',
    weaponsmith: 'Zbrojmistrz',
    toolsmith: 'Narzędziarz',
    butcher: 'Rzeźnik',
    leatherworker: 'Rymarz',
    mason: 'Kamieniarz',
    nitwit: 'Głupiec',
    none: 'Bez profesji',
    children: 'Dzieci'
};
// Villager biomes of origin (keys are what the game's census tallies in `biomes`).
const BIOMES = { plains: 'Równiny', desert: 'Pustynia', jungle: 'Dżungla', savanna: 'Sawanna', snow: 'Śnieżne równiny', swamp: 'Bagno', taiga: 'Tajga', unknown: 'Nieznany' };
const BIOME_ICONS = new Set(['desert', 'jungle', 'plains', 'savanna', 'snow', 'swamp']); // taiga has no picture yet: it falls back to plains
const biomeImg = (key, cls) => el('img', { class: cls, src: `img/biomes/${BIOME_ICONS.has(key) ? key : 'plains'}.png`, alt: BIOMES[key] ?? key, loading: 'lazy' });
const PALETTE = ['#a78bfa', '#38bdf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#c084fc', '#f97316', '#2dd4bf', '#e879f9', '#facc15', '#4ade80', '#94a3b8', '#f87171', '#22d3ee'];
/** [icon element, Polish name]; icons are the wiki's villager renders in img/villagers/<key>.png. */
const profession = key => [el('img', { class: 'm-villager', src: `img/villagers/${PROFESSIONS[key] ? key : 'none'}.png`, alt: '', loading: 'lazy' }), PROFESSIONS[key] ?? key];

const LEGAL_FORMS = { SOLE_PROPRIETORSHIP: 'Działalność jednoosobowa', PARTNERSHIP: 'Spółka osobowa', FOUNDATION: 'Fundacja', RELIGIOUS_INSTITUTION: 'Instytucja religijna', PUBLIC_INSTITUTION: 'Instytucja publiczna', OTHER: 'Inne', CITY_TREASURY: 'Skarb Miasta' };

const day = d => (d === null || d === undefined ? '—' : d + 1); // game days are 0-indexed
const num = n => Number(n ?? 0).toLocaleString('pl-PL');

function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
    for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
}

function table(headers, rows) {
    if (rows.length === 0) return el('p', { class: 'text-gray-400 text-sm py-2' }, 'Brak danych.');
    return el('div', { class: 'overflow-x-auto' }, el('table', { class: 'w-full text-sm text-left' },
        el('thead', {}, el('tr', {}, headers.map(h => el('th', { class: 'px-2 py-1 text-gray-400 font-medium border-b border-gray-600' }, h)))),
        el('tbody', {}, rows.map(r => el('tr', { class: 'border-b border-gray-700' }, r.map(c => el('td', { class: 'px-2 py-1 align-top' }, c)))))));
}

const section = (title, ...kids) => el('div', { class: 'mb-6' }, el('h3', { class: 'text-lg font-semibold mb-2' }, title), kids);

function renderCitizens(doc) {
    const rows = [...doc.citizens].sort((a, b) => a.identityNumber - b.identityNumber).map(c => [
        c.identityNumber, c.name, CITIZEN_STATUS[c.status] ?? c.status, day(c.since), c.profession ?? '—',
        COUNCIL_ROLE[c.councilRole] || '—'
    ]);
    return table(['#', 'Imię', 'Status', 'Od dnia', 'Zawód', 'Rada'], rows);
}

function renderCompanies(doc) {
    const names = new Map(doc.citizens.map(c => [c.identityNumber, c.name]));
    return table(['#', 'Nazwa', 'Forma', 'Założona', 'Członkowie'], doc.companies.map(c => [
        c.number, c.name, LEGAL_FORMS[c.legalForm] ?? c.legalForm ?? '—', day(c.founded),
        (c.members ?? []).map(m => names.get(m.identityNumber) ?? `#${m.identityNumber}`).join(', ') || '—'
    ]));
}

let openPlot = null;
/** ui.js registers how to open a plot's modal by its id. */
let plotLabel = id => `#${id}`;
export function setPlotOpener(fn, label) { openPlot = fn; if (label) plotLabel = label; }
const plotLink = id => { const a = el('a', { class: 'cursor-pointer font-semibold text-purple-300 hover:underline' }, plotLabel(id)); a.addEventListener('click', () => openPlot?.(id)); return a; };
export const projectStatusName = status => PROJECT_STATUS[status] ?? status;
/** Projects still running (their plot gets a marker on the map). */
export const ACTIVE_PROJECT_STATUSES = ['proposed', 'approved', 'collecting'];

function renderProjects(doc) {
    const names = new Map(doc.citizens.map(c => [c.identityNumber, c.name]));
    return (doc.projects ?? []).map(p => {
        const rows = (p.items ?? []).map(i => {
            const got = p.progress?.[i.typeId] ?? 0;
            return [i.typeId, `${num(got)} / ${num(i.target)}`, `${Math.min(100, Math.round(got / Math.max(1, i.target) * 100))}%`];
        });
        const donors = Object.entries({ ...p.points }).map(([id, pts]) => `${names.get(Number(id)) ?? `#${id}`}: ${pts}${p.bonus?.[id] ? ` (+${p.bonus[id]})` : ''}`);
        return section(`#${p.id} ${p.name} — ${PROJECT_STATUS[p.status] ?? p.status}`,
            p.description ? el('p', { class: 'text-sm text-gray-300 mb-2' }, p.description) : null,
            p.plotId != null ? el('p', { class: 'text-sm mb-2' }, 'Działka: ', plotLink(p.plotId)) : null,
            el('p', { class: 'text-xs text-gray-400 mb-2' }, `Utworzony: dzień ${day(p.createdDay)}${p.completedDay !== null && p.completedDay !== undefined ? `, ukończony: dzień ${day(p.completedDay)}` : ''}${p.motionIdentifier ? `, uchwała ${p.motionIdentifier}` : ''}`),
            table(['Przedmiot', 'Postęp', ''], rows),
            donors.length ? el('p', { class: 'text-sm mt-2' }, `Darczyńcy (punkty): ${donors.join('; ')}`) : null);
    });
}

function renderCouncil(doc) {
    const names = new Map(doc.citizens.map(c => [c.identityNumber, c.name]));
    const who = n => (n === null || n === undefined ? '—' : names.get(n) ?? `#${n}`);
    const council = doc.council ?? {};
    const motions = [...(council.motions ?? [])].reverse().map(m => {
        const yes = (m.votes ?? []).filter(v => v.choice === 'for').length;
        return [m.identifier ?? `#${m.id}`, MOTION_TYPES[m.type] ?? m.type, m.title, who(m.submitter), m.accepted === null ? m.status : m.accepted ? 'Przyjęta' : 'Odrzucona', (m.votes ?? []).length ? `${yes} / ${m.votes.length}` : '—'];
    });
    const codes = Object.entries(council.codex ?? {}).map(([key, k]) => section(`${CODEX_NAMES[key] ?? key} (wersja ${k.version})`,
        (k.paragraphs ?? []).length === 0 ? el('p', { class: 'text-gray-400 text-sm' }, 'Brak paragrafów.') :
            (k.paragraphs).map(p => el('p', { class: `text-sm mb-1 ${p.deleted ? 'italic text-gray-500' : ''}` },
                el('span', { class: 'font-semibold' }, `§${p.id} `), p.content, p.deleted ? ` (uchylony${p.deletedBy ? ` uchwałą ${p.deletedBy}` : ''})` : ''))));
    return [
        section('Skład', el('p', { class: 'text-sm' }, `Przewodniczący: ${who(council.chairman)}`), el('p', { class: 'text-sm' }, `Radni: ${(council.radni ?? []).map(who).join(', ') || '—'}`)),
        section('Uchwały i wnioski', table(['Numer', 'Rodzaj', 'Tytuł', 'Wnioskodawca', 'Wynik', 'Za / głosy'], motions)),
        codes
    ];
}

let charts = [];

/** A Chart.js canvas (the library comes from the CDN in plot_viewer.html); skipped silently when it is missing. */
function chart(config, height = 230) {
    const canvas = el('canvas');
    const box = el('div', { class: 'm-chart', style: `height:${height}px` }, canvas);
    requestAnimationFrame(() => {
        if (!window.Chart) { box.remove(); return; }
        window.Chart.defaults.color = 'rgba(255,255,255,0.75)';
        window.Chart.defaults.borderColor = 'rgba(255,255,255,0.1)';
        charts.push(new window.Chart(canvas, { ...config, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, ...config.options } }));
    });
    return box;
}

let openProfession = null;
/** ui.js registers how to open a profession's modal (city.js cannot import ui.js: circular). */
export function setProfessionOpener(fn) { openProfession = fn; }
export const professionName = key => PROFESSIONS[key] ?? key;
export const biomeName = key => BIOMES[key] ?? key;
let openBiome = null;
export function setBiomeOpener(fn) { openBiome = fn; }

/** Modal body for one profession: the villager picture on the left, the count trend across censuses on the right. */
export const mountVillager = (root, key) => mountTrend(root, key, 'tally');
/** Same modal for a biome of origin. */
export const mountBiome = (root, key) => mountTrend(root, key, 'biomes');

async function mountTrend(root, key, field) {
    const isBiome = field === 'biomes';
    const names = isBiome ? BIOMES : PROFESSIONS;
    root.replaceChildren(el('p', { class: 'text-sm text-gray-300' }, 'Pobieranie danych miasta...'));
    let data;
    try { data = await loadCity(); } catch (err) { root.replaceChildren(el('p', { class: 'text-red-300 text-sm' }, `Nie udało się pobrać danych: ${err.message}`)); return; }
    const censuses = (data.snapshot?.elections ?? []).filter(e => e.type === 1 && (!isBiome || e.biomes)).sort((a, b) => a.date - b.date || a.electionNumber - b.electionNumber);
    if (censuses.length === 0) { root.replaceChildren(el('p', { class: 'text-sm text-gray-300' }, isBiome ? 'Brak cenzusów z danymi o biomach.' : 'Brak przeprowadzonych cenzusów.')); return; }
    const series = censuses.map(c => c[field]?.[key] ?? 0);
    const totals = censuses.map(c => Object.values(c[field] ?? {}).reduce((s, n) => s + n, 0));
    const last = series.length - 1;
    const delta = last > 0 ? series[last] - series[last - 1] : null;
    const stat = (label, value) => el('div', { class: 'm-stat' }, el('b', {}, value), el('span', {}, label));
    const left = el('div', { class: 'm-villager-side' },
        isBiome ? biomeImg(key, 'm-villager-big') : el('img', { class: 'm-villager-big', src: `img/villagers/${PROFESSIONS[key] ? key : 'none'}.png`, alt: PROFESSIONS[key] ?? key }),
        el('div', { class: 'm-stats' },
            stat('obecnie', num(series[last])),
            stat('zmiana', delta === null ? '—' : `${delta > 0 ? '▲' : delta < 0 ? '▼' : ''}${Math.abs(delta)}`),
            stat('udział', totals[last] ? `${Math.round(series[last] / totals[last] * 100)}%` : '—'),
            stat('rekord', num(Math.max(...series)))));
    const color = PALETTE[Object.keys(names).indexOf(key) % PALETTE.length] ?? PALETTE[0];
    const right = el('div', { class: 'm-villager-chart' }, el('h3', { class: 'text-lg font-semibold mb-2' }, 'Zmiany liczebności'), chart({
        type: 'line',
        data: { labels: censuses.map(c => `#${c.electionNumber} · dz. ${day(c.date)}`), datasets: [{ label: names[key] ?? key, data: series, borderColor: color, backgroundColor: color + '33', fill: true, borderWidth: 3, pointRadius: 4, tension: 0.3 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }, 260));
    root.replaceChildren(el('div', { class: 'm-villager-layout' }, left, right));
}

const bar = (value, max, color) => el('div', { class: 'm-bar' }, el('i', { style: `width:${max && value ? Math.max(2, Math.round(value / max * 100)) : 0}%;background:${color}` }));

function renderCensus(doc) {
    const censuses = (doc.elections ?? []).filter(e => e.type === 1).sort((a, b) => a.date - b.date || a.electionNumber - b.electionNumber);
    if (censuses.length === 0) return el('p', { class: 'text-sm text-gray-300' }, 'Brak przeprowadzonych cenzusów.');
    const keys = [...new Set(censuses.flatMap(c => Object.keys(c.tally ?? {})))];
    const total = c => Object.values(c.tally ?? {}).reduce((s, n) => s + n, 0);
    const labels = censuses.map(c => `#${c.electionNumber} · dz. ${day(c.date)}`);

    const trend = section('Trendy', chart({
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Razem', data: censuses.map(total), borderColor: '#ffffff', borderDash: [6, 4], borderWidth: 2, pointRadius: 3, tension: 0.35 },
                ...keys.map((k, i) => ({ label: profession(k)[1], data: censuses.map(c => c.tally?.[k] ?? 0), borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length], borderWidth: 2, pointRadius: 2, tension: 0.35, hidden: i > 5 }))
            ]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }, 280));

    const biomeKeys = [...new Set(censuses.flatMap(c => Object.keys(c.biomes ?? {})))];
    const withBiomes = censuses.filter(c => c.biomes);
    const biomeTrend = biomeKeys.length === 0 ? null : section('Biomy pochodzenia — trendy', chart({
        type: 'line',
        data: { labels: withBiomes.map(c => `#${c.electionNumber} · dz. ${day(c.date)}`), datasets: biomeKeys.map((k, i) => ({ label: BIOMES[k] ?? k, data: withBiomes.map(c => c.biomes[k] ?? 0), borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length], borderWidth: 2, pointRadius: 2, tension: 0.35 })) },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }, 240));

    const cards = [...censuses].reverse().map((c, idx, list) => {
        const prev = list[idx + 1];
        const max = Math.max(1, total(c));
        const lines = Object.entries(c.tally ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
            const [icon, name] = profession(k);
            const d = prev ? n - (prev.tally?.[k] ?? 0) : null;
            const row = el('div', { class: 'm-line clickable', title: 'Pokaż trend' },
                el('span', { class: 'm-icon' }, icon), el('span', { class: 'm-name' }, name), bar(n, max, PALETTE[keys.indexOf(k) % PALETTE.length]),
                el('span', { class: 'm-count' }, n),
                el('span', { class: `m-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}` }, d === null || d === 0 ? '' : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`));
            row.addEventListener('click', () => openProfession?.(k));
            return row;
        });
        const bmax = Math.max(1, Object.values(c.biomes ?? {}).reduce((s, n) => s + n, 0));
        const bprev = list[idx + 1]?.biomes;
        const blines = Object.entries(c.biomes ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
            const d = bprev ? n - (bprev[k] ?? 0) : null;
            const row = el('div', { class: 'm-line clickable', title: 'Pokaż trend' },
                el('span', { class: 'm-icon' }, biomeImg(k, 'm-villager')), el('span', { class: 'm-name' }, BIOMES[k] ?? k), bar(n, bmax, PALETTE[biomeKeys.indexOf(k) % PALETTE.length]),
                el('span', { class: 'm-count' }, n),
                el('span', { class: `m-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}` }, d === null || d === 0 ? '' : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`));
            row.addEventListener('click', () => openBiome?.(k));
            return row;
        });
        return el('div', { class: 'm-card' },
            el('div', { class: 'm-card-head' }, el('b', {}, `Cenzus #${c.electionNumber}`), el('span', {}, `dzień ${day(c.date)} · razem ${total(c)}${c.excludedCount ? ` · wykluczeni ${c.excludedCount}` : ''}`)), lines,
            blines.length ? [el('div', { class: 'm-subhead' }, 'Biom pochodzenia'), blines] : null);
    });
    return [trend, biomeTrend, section('Historia', cards)];
}

function renderElections(doc) {
    const names = new Map(doc.citizens.map(c => [String(c.identityNumber), c.name]));
    const civic = (doc.elections ?? []).filter(e => e.type !== 1).sort((a, b) => a.date - b.date || a.electionNumber - b.electionNumber || (a.round ?? 0) - (b.round ?? 0));
    if (civic.length === 0) return el('p', { class: 'text-sm text-gray-300' }, 'Brak przeprowadzonych wyborów.');
    const sum = e => Object.values(e.tally ?? {}).reduce((s, n) => s + n, 0);
    const first = civic.filter(e => !e.round);

    const trend = section('Trendy', chart({
        type: 'bar',
        data: { labels: first.map(e => `#${e.electionNumber} · dz. ${day(e.date)}`), datasets: [
            { label: 'Oddane głosy', data: first.map(sum), backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 8 },
            { label: 'Głosy zwycięzcy', data: first.map(e => Math.max(0, ...Object.values(e.tally ?? {}))), backgroundColor: 'rgba(251,191,36,0.75)', borderRadius: 8 }
        ] },
        options: { plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }));

    const cards = [...civic].reverse().map(e => {
        const entries = Object.entries(e.tally ?? {}).sort((a, b) => b[1] - a[1]);
        const max = Math.max(1, entries.reduce((s, x) => s + x[1], 0));
        return el('div', { class: 'm-card' },
            el('div', { class: 'm-card-head' }, el('b', {}, `Wybory #${e.electionNumber}${e.round ? ` · runda ${e.round + 1}` : ''}`), el('span', {}, `dzień ${day(e.date)} · głosów ${sum(e)}`)),
            entries.map(([k, n], i) => el('div', { class: `m-line ${i === 0 ? 'win' : ''}` },
                el('span', { class: 'm-icon' }, i === 0 ? '🏆' : '🗳️'), el('span', { class: 'm-name' }, names.get(k) ?? `#${k}`), bar(n, max, PALETTE[i % PALETTE.length]), el('span', { class: 'm-count' }, n), el('span', {}))));
    });
    return [trend, section('Historia', cards)];
}

function renderPositions(doc) {
    const names = new Map(doc.citizens.map(c => [c.identityNumber, c.name]));
    return table(['Stanowisko', 'Piastuje'], (doc.positions ?? []).map(p => [p.name, (p.holders ?? []).map(n => names.get(n) ?? `#${n}`).join(', ') || 'wakat']));
}

// ─── Building permits and city variables ────────────────────────────────────

const PERMIT_STATUS = { pending_payment: 'Czeka na opłatę', issued: 'Wydane', inspection: 'Odbiór w toku', corrections: 'Do poprawek', completed: 'Odebrane', rejected: 'Odrzucone', cancelled: 'Anulowane' };
const PERMIT_COLORS = { pending_payment: '#fbbf24', issued: '#38bdf8', inspection: '#a78bfa', corrections: '#f97316', completed: '#34d399', rejected: '#f87171', cancelled: '#94a3b8' };
const BUILDING_TYPES = { residential: 'Mieszkalny', service: 'Usługowy', mixed: 'Mieszkalno-usługowy', public: 'Użyteczności publicznej', industrial: 'Przemysłowy', other: 'Inny' };
const INVESTMENT = { finished: 'Inwestycja ukończona', minor_defects: 'Drobne usterki', unfinished: 'Inwestycja niedokończona' };
const PAYMENT = { requested: 'do zapłaty (zlecenie w grze)', awaiting_account: 'brak powiązanego konta bankowego', pending: 'czek wystawiony', paid: 'opłacona' };
const BUILD_STATE = { built: 'Zabudowana', inspection: 'Odbiór w toku', permit: 'Pozwolenie wydane, w budowie', unbuilt: 'Niezabudowana' };
/** Permits that are still in progress (their plot gets a marker on the map). */
export const OPEN_PERMIT_STATUSES = ['pending_payment', 'issued', 'inspection', 'corrections'];
export const permitStatusName = status => PERMIT_STATUS[status] ?? status;
export const buildStateName = key => BUILD_STATE[key] ?? key;

/** A plot counts as built only once a permit for it was completed (accepted at inspection); otherwise unbuilt. */
export function plotBuildInfo(snapshot, plotId) {
    const permits = (snapshot?.permits ?? []).filter(p => p.plotId === Number(plotId));
    const has = s => permits.some(p => p.status === s);
    const key = has('completed') ? 'built' : has('inspection') ? 'inspection' : permits.some(p => OPEN_PERMIT_STATUSES.includes(p.status)) ? 'permit' : 'unbuilt';
    return { key, label: BUILD_STATE[key], permits };
}

const STEPS = [['pending_payment', 'Opłata'], ['issued', 'Pozwolenie'], ['inspection', 'Odbiór'], ['completed', 'Odebrane']];
const stepIndex = status => ({ pending_payment: 0, issued: 1, corrections: 1, inspection: 2, completed: 3 })[status] ?? -1;

/** One permit: status tracker, its parameters, the inspection report and the history. Used by the Permits tab and the plot modal. */
export function permitCard(p, doc, { showPlot = true } = {}) {
    const current = stepIndex(p.status);
    const done = p.status === 'completed';
    const stepper = el('div', { class: 'flex gap-1 my-2' }, STEPS.map(([key, label], i) => {
        const active = current >= 0 && (i < current || (i === current && done) || i === current);
        const failed = current < 0;
        return el('div', { class: 'flex-1 text-center text-xs rounded px-1 py-1', style: `background:${failed ? '#4b5563' : active ? (i === current && !done ? PERMIT_COLORS[p.status] : '#34d399') : '#374151'};color:${active && !failed ? '#111827' : '#d1d5db'}` }, label);
    }));
    const kv = (k, v) => [el('span', { class: 'text-gray-400' }, k), el('span', { class: 'font-medium' }, v)];
    const project = p.projectId != null ? (doc.projects ?? []).find(x => x.id === p.projectId) : null;
    const rows = el('div', { class: 'm-kv' },
        kv('Odpowiedzialny:', `${p.responsible?.name ?? '—'}${p.responsible?.kind === 'company' ? ' (firma)' : ''}`),
        kv('Typ budynku:', BUILDING_TYPES[p.buildingType] ?? p.buildingType),
        kv('Planowane lokale:', `mieszkalne ${p.plannedResidential}, usługowe ${p.plannedService}`),
        kv('Kondygnacje:', p.floors),
        kv('Wydane (dzień):', day(p.issuedDay)),
        kv('Planowane zakończenie:', p.plannedEndDay === null || p.plannedEndDay === undefined ? '—' : `dzień ${day(p.plannedEndDay)}`),
        kv('Opłata administracyjna:', `${num(p.fee)} — ${PAYMENT[p.paymentStatus] ?? '—'}`),
        project ? kv('Projekt miejski:', `#${project.id} ${project.name}`) : null,
        p.retroactive ? kv('Rodzaj:', 'pozwolenie wsteczne (budynek już stał)') : null);
    const insp = p.inspection;
    const inspection = insp ? el('div', { class: 'mt-2 text-sm' },
        el('div', { class: 'font-semibold' }, 'Odbiór'),
        el('div', { class: 'text-gray-300' }, `Lokale: ${insp.singleUnit ? 'jeden lokal zajmuje cały budynek' : insp.units}${insp.investmentState ? ` · ${INVESTMENT[insp.investmentState] ?? insp.investmentState}` : ''}`),
        insp.description ? el('div', { class: 'text-gray-300' }, insp.description) : null,
        insp.note ? el('div', { class: 'text-yellow-300' }, insp.note) : null) : null;
    const history = (p.history ?? []).length ? el('div', { class: 'text-xs text-gray-400 mt-2' }, (p.history).map(h => `dz. ${day(h.day)}: ${PERMIT_STATUS[h.status] ?? h.status}${h.note ? ` (${h.note})` : ''}`).join(' → ')) : null;
    return el('div', { class: 'bg-gray-700 p-3 rounded-md mb-3' },
        el('div', { class: 'flex justify-between items-center gap-2' },
            el('b', {}, showPlot ? [`Pozwolenie #${p.id} · `, plotLink(p.plotId)] : `Pozwolenie #${p.id}`),
            el('span', { class: 'text-xs px-2 py-0.5 rounded', style: `background:${PERMIT_COLORS[p.status] ?? '#6b7280'};color:#111827` }, PERMIT_STATUS[p.status] ?? p.status)),
        stepper, rows, p.notes ? el('p', { class: 'text-sm text-gray-300 mt-2' }, p.notes) : null, inspection, history);
}

let permitScope = 'all';
function renderPermits(doc) {
    const me = Number(state.currentUser?.identifier ?? state.currentUser?.identityNumber ?? NaN);
    const myCompanies = new Set((doc.companies ?? []).filter(c => (c.members ?? []).some(m => m.identityNumber === me)).map(c => c.number));
    const mine = p => p.responsible && ((p.responsible.kind === 'citizen' && p.responsible.number === me) || (p.responsible.kind === 'company' && myCompanies.has(p.responsible.number)));
    const all = [...(doc.permits ?? [])].sort((a, b) => b.id - a.id);
    const list = permitScope === 'mine' ? all.filter(mine) : all;
    const counts = Object.keys(PERMIT_STATUS).map(s => [s, all.filter(p => p.status === s).length]).filter(([, n]) => n > 0);

    const toggle = el('div', { class: 'flex gap-2 mb-3 items-center' },
        ...[['all', 'Wszystkie'], ['mine', 'Moje i mojej firmy']].map(([id, label]) => {
            const b = el('button', { class: `px-3 py-1 rounded-md text-sm ${permitScope === id ? 'bg-purple-600 font-semibold' : 'bg-gray-700 hover:bg-gray-600'}` }, label);
            b.addEventListener('click', () => { permitScope = id; rerender?.('permits'); });
            return b;
        }),
        el('span', { class: 'text-xs text-gray-400' }, state.currentUser ? '' : 'Zaloguj się, aby zobaczyć tylko swoje pozwolenia.'));
    const summary = el('p', { class: 'text-xs text-gray-400 mb-3' }, counts.map(([s, n]) => `${PERMIT_STATUS[s]}: ${n}`).join(' · ') || 'Brak pozwoleń.');
    return [
        el('p', { class: 'text-sm text-gray-300 mb-2' }, 'Budowa na każdej działce wymaga pozwolenia. Działka bez pozwolenia jest niezabudowana — zabudowaną staje się po opłaceniu pozwolenia i odbiorze budynku.'),
        toggle, summary, list.length ? list.map(p => permitCard(p, doc)) : el('p', { class: 'text-gray-400 text-sm' }, 'Brak pozwoleń do wyświetlenia.')
    ];
}

function renderVariables(doc) {
    const v = doc.variables ?? { definitions: [], scheduled: [], history: [] };
    const label = new Map(v.definitions.map(d => [d.key, d.label]));
    const scheduled = new Map(v.scheduled.map(s => [s.key, s]));
    const defs = v.definitions.map(d => {
        const s = scheduled.get(d.key);
        return [d.label, el('b', {}, num(d.value)), num(d.default), `${num(d.min)} – ${num(d.max)}`, s ? `${num(s.value)} od dnia ${day(s.effectiveDay)} (${s.source})` : '—'];
    });
    const history = [...v.history].reverse().slice(0, 40).map(h => [day(h.day), label.get(h.key) ?? h.key, `${num(h.from)} → ${num(h.to)}`, h.source]);
    return [
        el('p', { class: 'text-sm text-gray-300 mb-3' }, 'Zmienne miasta zmienia Rada w głosowaniu parametryzowanym: radny wybiera zmienną i proponuje wartość, inni zgłaszają inne wartości, a wygrywa ta z największą liczbą głosów za (remis — dogrywka). Nowa wartość obowiązuje od następnego dnia.'),
        section('Rejestr zmiennych', table(['Zmienna', 'Wartość', 'Domyślna', 'Zakres', 'Zaplanowana'], defs)),
        section('Historia zmian', table(['Dzień', 'Zmienna', 'Zmiana', 'Źródło'], history))
    ];
}

let rerender = null;

const RENDER = { permits: renderPermits, variables: renderVariables, census: renderCensus, positions: renderPositions, citizens: renderCitizens, companies: renderCompanies, projects: renderProjects, council: renderCouncil, elections: renderElections };

let cache = null;

/** The public city snapshot ({ snapshot, receivedAt } or { snapshot: null }); cached for 30 s. */
export async function loadCity() {
    if (cache && Date.now() - cache.at < 30000) return cache.data;
    const res = await fetch(`${API_BASE}/api/city`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = { at: Date.now(), data: await res.json() };
    return cache.data;
}

/** Fills `root` with the tabbed city information. */
export async function mountCity(root) {
    root.replaceChildren(el('p', { class: 'text-sm text-gray-300' }, 'Pobieranie danych miasta...'));
    let data;
    try { data = await loadCity(); } catch (err) { root.replaceChildren(el('p', { class: 'text-red-300 text-sm' }, `Nie udało się pobrać danych: ${err.message}`)); return null; }
    if (!data.snapshot) { root.replaceChildren(el('p', { class: 'text-sm text-gray-300' }, 'Brak danych: serwer jeszcze nie wysłał eksportu miasta.')); return null; }
    const show = tab => {
        charts.forEach(c => c.destroy());
        charts = [];
        const tabs = el('div', { class: 'flex flex-wrap gap-2 mb-3' }, TABS.map(([id, label]) => {
            const b = el('button', { class: `px-3 py-1 rounded-md text-sm ${id === tab ? 'bg-yellow-600 text-gray-900 font-semibold' : 'bg-gray-700 hover:bg-gray-600'}` }, label);
            b.addEventListener('click', () => show(id));
            return b;
        }));
        let content;
        try { content = RENDER[tab](data.snapshot); } catch (err) { content = el('p', { class: 'text-red-300' }, `Błąd wyświetlania: ${err.message}`); }
        root.replaceChildren(
            el('p', { class: 'text-xs text-yellow-200 opacity-80 mb-3' }, `Stan gry: dzień ${day(data.snapshot.day)} · dane odebrane ${data.receivedAt} UTC`), tabs, el('div', {}, content));
    };
    rerender = show;
    show('projects');
    return data.snapshot;
}
