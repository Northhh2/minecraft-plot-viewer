// Read-only "Miasto" panel: the city snapshot pushed by the sync agent (GET /api/city). Public, no login.
import { API_BASE } from './config.js';

const MOTION_TYPES = ['Zmiana kodeksu', 'Debata', 'Absolutorium', 'Wniosek formalny', 'Wniosek o wybory', 'Odwołanie', 'Budżet', 'Wotum zaufania', 'Komisja', 'Zmiana dodatku', 'Projekt miejski'];
const PROJECT_STATUS = { draft: 'Szkic', proposed: 'U Rady', approved: 'Zatwierdzony', collecting: 'Zbiórka', completed: 'Ukończony', rejected: 'Odrzucony', cancelled: 'Anulowany' };
const CITIZEN_STATUS = ['—', 'Wniosek', 'Obywatel', 'Odrzucony'];
const COUNCIL_ROLE = ['', 'Radny', 'Przewodniczący'];
const CODEX_NAMES = { civil: 'Kodeks cywilny', criminal: 'Kodeks karny', construction: 'Kodeks budowlany' };
const TABS = [['citizens', 'Obywatele'], ['companies', 'Firmy'], ['projects', 'Projekty'], ['council', 'Rada'], ['elections', 'Wybory']];

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
    const rows = [...(doc.elections ?? [])].reverse().map(e => [
        `#${e.electionNumber}${e.round ? ` (runda ${e.round + 1})` : ''}`, e.type === 1 ? 'Spis' : 'Obywatelskie', day(e.date), e.winner,
        Object.entries(e.tally ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'
    ]);
    return table(['Wybory', 'Rodzaj', 'Dzień', 'Wynik', 'Głosy'], rows);
}

const RENDER = { citizens: renderCitizens, companies: renderCompanies, projects: renderProjects, council: renderCouncil, elections: renderElections };

let overlay = null;

async function open() {
    if (!overlay) {
        overlay = el('div', { class: 'hidden fixed inset-0 z-40 bg-gray-900 bg-opacity-95 overflow-y-auto text-white' });
        document.body.append(overlay);
    }
    overlay.classList.remove('hidden');
    overlay.replaceChildren(el('p', { class: 'p-6 text-gray-300' }, 'Pobieranie danych miasta...'));
    let data;
    try {
        const res = await fetch(`${API_BASE}/api/city`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
    } catch (err) {
        overlay.replaceChildren(header(null), el('p', { class: 'p-6 text-red-400' }, `Nie udało się pobrać danych: ${err.message}`));
        return;
    }
    if (!data.snapshot) { overlay.replaceChildren(header(null), el('p', { class: 'p-6 text-gray-300' }, 'Brak danych: serwer jeszcze nie wysłał eksportu miasta.')); return; }
    show(data, 'citizens');
}

function header(data) {
    const close = el('button', { class: 'px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md' }, 'Zamknij');
    close.addEventListener('click', () => overlay.classList.add('hidden'));
    return el('div', { class: 'flex items-center justify-between p-4 border-b border-gray-700' },
        el('div', {}, el('h2', { class: 'text-2xl font-bold' }, 'Miasto'),
            data ? el('p', { class: 'text-xs text-gray-400' }, `Stan gry: dzień ${day(data.snapshot.day)} · dane odebrane ${data.receivedAt} UTC`) : null), close);
}

function show(data, tab) {
    const tabs = el('div', { class: 'flex flex-wrap gap-2 px-4 pt-3' }, TABS.map(([id, label]) => {
        const b = el('button', { class: `px-3 py-1 rounded-md ${id === tab ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}` }, label);
        b.addEventListener('click', () => show(data, id));
        return b;
    }));
    let content;
    try { content = RENDER[tab](data.snapshot); } catch (err) { content = el('p', { class: 'text-red-400' }, `Błąd wyświetlania: ${err.message}`); }
    overlay.replaceChildren(header(data), tabs, el('div', { class: 'p-4 max-w-6xl' }, content));
}

export function initializeCityPanel() {
    const controls = document.getElementById('layer-toggles');
    if (!controls) return;
    const btn = el('button', { id: 'open-city', title: 'Miasto', class: 'control-button w-10 h-10 bg-gray-800 text-white rounded-md flex items-center justify-center hover:bg-gray-700' });
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="7" height="12"></rect><rect x="14" y="3" width="7" height="18"></rect><line x1="6" y1="13" x2="7" y2="13"></line><line x1="17" y1="8" x2="18" y2="8"></line></svg>';
    btn.addEventListener('click', open);
    controls.append(btn);
}
