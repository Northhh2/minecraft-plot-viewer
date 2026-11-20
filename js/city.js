// City information shown inside the Ratusz modal (the City Treasury's headquarters): the snapshot pushed by the sync agent
// (GET /api/city). Public, no login.
import { API_BASE } from './config.js';

const MOTION_TYPES = ['Zmiana kodeksu', 'Debata', 'Absolutorium', 'Wniosek formalny', 'Wniosek o wybory', 'Odwołanie', 'Budżet', 'Wotum zaufania', 'Komisja', 'Zmiana dodatku', 'Projekt miejski'];
const PROJECT_STATUS = { draft: 'Szkic', proposed: 'U Rady', approved: 'Zatwierdzony', collecting: 'Zbiórka', completed: 'Ukończony', rejected: 'Odrzucony', cancelled: 'Anulowany' };
const CITIZEN_STATUS = ['—', 'Wniosek', 'Obywatel', 'Odrzucony'];
const COUNCIL_ROLE = ['', 'Radny', 'Przewodniczący'];
const CODEX_NAMES = { civil: 'Kodeks cywilny', criminal: 'Kodeks karny', construction: 'Kodeks budowlany' };
const TABS = [['projects', 'Projekty'], ['citizens', 'Obywatele'], ['companies', 'Firmy'], ['council', 'Rada'], ['census', 'Cenzusy'], ['elections', 'Wybory'], ['positions', 'Stanowiska']];

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

const RENDER = { census: renderCensus, positions: renderPositions, citizens: renderCitizens, companies: renderCompanies, projects: renderProjects, council: renderCouncil, elections: renderElections };

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
    show('projects');
    return data.snapshot;
}
