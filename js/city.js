// City information shown inside the Ratusz modal (the City Treasury's headquarters): the snapshot pushed by the sync agent
// (GET /api/city). Public, no login.
import { API_BASE } from './config.js';

const MOTION_TYPES = ['Zmiana kodeksu', 'Debata', 'Absolutorium', 'Wniosek formalny', 'Wniosek o wybory', 'Odwołanie', 'Budżet', 'Wotum zaufania', 'Komisja', 'Zmiana dodatku', 'Projekt miejski'];
const PROJECT_STATUS = { draft: 'Szkic', proposed: 'U Rady', approved: 'Zatwierdzony', collecting: 'Zbiórka', completed: 'Ukończony', rejected: 'Odrzucony', cancelled: 'Anulowany' };
const CITIZEN_STATUS = ['—', 'Wniosek', 'Obywatel', 'Odrzucony'];
const COUNCIL_ROLE = ['', 'Radny', 'Przewodniczący'];
const CODEX_NAMES = { civil: 'Kodeks cywilny', criminal: 'Kodeks karny', construction: 'Kodeks budowlany' };
const TABS = [['projects', 'Projekty'], ['citizens', 'Obywatele'], ['companies', 'Firmy'], ['council', 'Rada'], ['elections', 'Wybory'], ['positions', 'Stanowiska']];

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
        c.number, c.name, c.legalForm ?? '—', day(c.founded),
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

function renderElections(doc) {
    const rows = list => [...list].reverse().map(e => [
        `#${e.electionNumber}${e.round ? ` (runda ${e.round + 1})` : ''}`, day(e.date), e.winner,
        Object.entries(e.tally ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'
    ]);
    const all = doc.elections ?? [];
    const head = ['Wybory', 'Dzień', 'Wynik', 'Głosy'];
    return [
        section('Cenzusy (spisy)', table(head, rows(all.filter(e => e.type === 1)))),
        section('Wybory powszechne', table(head, rows(all.filter(e => e.type !== 1))))
    ];
}

function renderPositions(doc) {
    const names = new Map(doc.citizens.map(c => [c.identityNumber, c.name]));
    return table(['Stanowisko', 'Piastuje'], (doc.positions ?? []).map(p => [p.name, (p.holders ?? []).map(n => names.get(n) ?? `#${n}`).join(', ') || 'wakat']));
}

const RENDER = { positions: renderPositions, citizens: renderCitizens, companies: renderCompanies, projects: renderProjects, council: renderCouncil, elections: renderElections };

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
