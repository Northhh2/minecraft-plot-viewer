import { state } from './state.js';
import { API_BASE } from './config.js';
import { authHeaders, getToken } from './auth.js';
import { pickRect } from './map.js';
import { openNewModal } from './ui.js';

// Editing UI for staff (clerk/admin), API mode only. Forms are built with DOM APIs (never innerHTML
// with data), and every write goes through the Worker, which re-validates and audits it.

let appData;

const role = () => state.currentUser?.role;
export const isEditor = () => !!API_BASE && (role() === 'clerk' || role() === 'admin');
const isAdmin = () => !!API_BASE && role() === 'admin';

const FIELD_LABELS = {
    name: 'Nazwa', zoningTypeId: 'Typ', districtId: 'Dzielnica', streetId: 'Ulica', buildingNumber: 'Numer budynku',
    x1: 'X1', z1: 'Z1', x2: 'X2', z2: 'Z2', version: 'Wersja', 'newOwner.number': 'Nowy właściciel',
    transactionDay: 'Dzień transakcji', transactionType: 'Typ transakcji', transactionValue: 'Wartość', checkNumber: 'Numer czeku'
};

// ─── small DOM helper ────────────────────────────────────────────────────────────

function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return el;
}

const INPUT_CLASS = 'mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500';
const BTN_PRIMARY = 'bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50';
const BTN_SECONDARY = 'bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg border border-gray-600 transition-colors';

// ─── API ─────────────────────────────────────────────────────────────────────────

async function request(method, path, body) {
    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', ...authHeaders(getToken()) },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    } catch {
        throw Object.assign(new Error('network'), { data: { error: 'network' } });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error ?? 'error'), { status: res.status, data });
    return data;
}

function describeError(err) {
    const d = err.data ?? {};
    switch (d.error) {
        case 'version_conflict': return 'Ktoś inny zmienił ten element w międzyczasie. Odśwież stronę i spróbuj ponownie.';
        case 'overlap': return `Nachodzi na inne działki: ${d.with.join(', ')}.${isAdmin() ? ' Możesz zaznaczyć „Ignoruj kolizje”.' : ''}`;
        case 'name_taken': return 'Ta nazwa jest już zajęta.';
        case 'invalid_field': return `Niepoprawna wartość pola: ${FIELD_LABELS[d.field] ?? d.field}. Teksty nie mogą zawierać znaków < > & " ' \``;
        case 'unknown_reference': return `Wybrana wartość nie istnieje: ${FIELD_LABELS[d.field] ?? d.field}.`;
        case 'in_use': return 'Nie można usunąć — element jest nadal używany (działki, historia lub lokale).';
        case 'invalid_line': return `Niepoprawne dane linii: ${(d.errors ?? []).join(' ')}`;
        case 'forbidden': return 'Brak uprawnień do tej operacji.';
        case 'unauthorized': return 'Sesja wygasła. Zaloguj się ponownie.';
        case 'too_many_attempts': return 'Zbyt wiele prób. Spróbuj później.';
        case 'network': return 'Brak połączenia z serwerem.';
        default: return 'Operacja nie powiodła się.';
    }
}

/** Reload so the whole UI (map, search, modals) reflects the saved data; optionally reopen a plot. */
function reload(plotName = null, hash = null) {
    if (hash) location.hash = hash;
    else if (plotName) location.hash = `plot=${encodeURIComponent(plotName)}`;
    else history.replaceState(null, '', location.pathname + location.search);
    location.reload();
}

export function openFromHash() {
    const metroHash = /^#metro-(line|station)=(\d+)$/.exec(location.hash);
    if (metroHash && appData?.metro) {
        const id = Number(metroHash[2]);
        const known = metroHash[1] === 'line' ? appData.metro.lines.some(l => l.id === id) : appData.metro.stations.some(x => x.id === id);
        if (known) openNewModal({ type: metroHash[1] === 'line' ? 'metroLine' : 'metroStation', data: id });
        return;
    }
    const m = /^#plot=(.+)$/.exec(location.hash);
    if (!m || !appData) return;
    let name;
    try { name = decodeURIComponent(m[1]); } catch { return; }
    const plot = appData.allPlots.find(p => p.name === name);
    if (plot) openNewModal({ type: 'plot', data: plot });
}

// ─── generic form dialog ─────────────────────────────────────────────────────────

/**
 * fields: [{ name, label, type: 'text'|'number'|'select'|'checkbox', options?, value?, required?, hint? }]
 * pick:   { fields: ['x1','z1','x2','z2'] } adds a "select on map" button filling those number fields.
 * onSubmit(values) must throw on failure; its message is shown in the dialog.
 */
function openDialog({ title, fields, submitLabel = 'Zapisz', pick = null, preview = null, onSubmit }) {
    const inputs = {};
    const customs = {};
    const error = h('p', { class: 'hidden text-red-400 text-sm mt-3' });
    const previewEl = h('p', { class: 'text-xs text-gray-400 mt-2' });

    const rows = fields.map(f => {
        let input;
        if (f.type === 'custom') {
            const widget = f.build();
            customs[f.name] = widget;
            return h('div', { class: 'block text-sm font-medium text-gray-300' }, f.label, widget.el);
        }
        if (f.type === 'select') {
            input = h('select', { class: INPUT_CLASS, name: f.name },
                f.options.map(o => h('option', { value: o.value, selected: String(o.value) === String(f.value ?? '') }, o.label)));
        } else if (f.type === 'checkbox') {
            input = h('input', { type: 'checkbox', name: f.name, checked: !!f.value, class: 'mr-2 h-4 w-4' });
        } else {
            input = h('input', { type: f.type, name: f.name, value: f.value ?? '', required: !!f.required, class: INPUT_CLASS, step: f.type === 'number' ? '1' : undefined });
        }
        inputs[f.name] = input;
        input.addEventListener('input', refreshPreview);
        if (f.type === 'checkbox') {
            return h('label', { class: 'flex items-center text-sm text-gray-300' }, input, f.label);
        }
        return h('label', { class: 'block text-sm font-medium text-gray-300' }, f.label, input, f.hint ? h('span', { class: 'text-xs text-gray-500' }, f.hint) : '');
    });

    const read = () => {
        const out = {};
        for (const f of fields) {
            if (f.type === 'custom') { out[f.name] = customs[f.name].read(); continue; }
            const el = inputs[f.name];
            if (f.type === 'checkbox') out[f.name] = el.checked;
            else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
            else if (f.type === 'select') out[f.name] = el.value === '' ? null : (f.numeric === false ? el.value : Number(el.value));
            else out[f.name] = el.value.trim() === '' ? null : el.value.trim();
        }
        return out;
    };
    function refreshPreview() { previewEl.textContent = preview ? preview(read()) : ''; }

    const submit = h('button', { type: 'submit', class: BTN_PRIMARY }, submitLabel);
    const cancel = h('button', { type: 'button', class: BTN_SECONDARY, onclick: () => overlay.remove() }, 'Anuluj');
    const pickBtn = pick ? h('button', {
        type: 'button', class: BTN_SECONDARY + ' mt-3 w-full',
        onclick: () => {
            overlay.classList.add('hidden');
            const banner = showBanner('Przeciągnij myszą po mapie, aby zaznaczyć obszar. Esc — anuluj.');
            pickRect(result => {
                banner.remove();
                overlay.classList.remove('hidden');
                if (!result) return;
                for (const n of pick.fields) inputs[n].value = result[n];
                refreshPreview();
            });
        }
    }, 'Zaznacz na mapie') : '';

    const form = h('form', { class: 'space-y-3' }, rows, pickBtn, previewEl, error,
        h('div', { class: 'flex justify-end gap-3 pt-2' }, cancel, submit));
    form.addEventListener('submit', async e => {
        e.preventDefault();
        submit.disabled = true;
        error.classList.add('hidden');
        try {
            await onSubmit(read());
        } catch (err) {
            error.textContent = describeError(err);
            error.classList.remove('hidden');
            submit.disabled = false;
        }
    });

    const overlay = h('div', { class: 'fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 p-4' },
        h('div', { class: 'bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-600 w-full max-w-md max-h-full overflow-y-auto' },
            h('div', { class: 'flex justify-between items-center mb-4' },
                h('h2', { class: 'text-xl font-bold' }, title),
                h('button', { type: 'button', class: 'text-gray-400 hover:text-white text-2xl', onclick: () => overlay.remove() }, '×')),
            form));
    document.body.append(overlay);
    refreshPreview();
}

function showBanner(text) {
    const el = h('div', { class: 'fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm' }, text);
    document.body.append(el);
    return el;
}

// ─── forms ───────────────────────────────────────────────────────────────────────

const areaPreview = v => {
    const ok = [v.x1, v.z1, v.x2, v.z2].every(Number.isInteger);
    if (!ok) return '';
    const sx = Math.abs(v.x2 - v.x1) + 1, sz = Math.abs(v.z2 - v.z1) + 1;
    return `Rozmiar: ${sx}×${sz} bloków, powierzchnia ${sx * sz}. Wartość zostanie przeliczona z typu działki.`;
};

const coordFields = r => ['x1', 'z1', 'x2', 'z2'].map(n => ({ name: n, label: n.toUpperCase(), type: 'number', required: true, value: r?.[n] }));

function firstStreetPerName() {
    const seen = new Map();
    for (const s of appData.streets) if (!seen.has(s.name)) seen.set(s.name, s.id);
    return [...seen].map(([name, id]) => ({ value: id, label: name }));
}

function openPlotForm(plot) {
    const none = { value: '', label: '— brak —' };
    openDialog({
        title: plot ? `Edytuj działkę: ${plot.name}` : 'Nowa działka',
        pick: { fields: ['x1', 'z1', 'x2', 'z2'] },
        preview: areaPreview,
        fields: [
            { name: 'name', label: 'Nazwa (max 32 znaki)', type: 'text', required: true, value: plot?.name },
            { name: 'zoningTypeId', label: 'Typ', type: 'select', value: plot?.zoningTypeId, options: [none, ...appData.zoningTypes.map(z => ({ value: z.id, label: z.name }))] },
            { name: 'districtId', label: 'Dzielnica', type: 'select', value: plot?.districtId, options: [none, ...appData.districts.map(d => ({ value: d.id, label: d.name }))] },
            { name: 'streetId', label: 'Ulica', type: 'select', value: plot?.streetId, options: [none, ...firstStreetPerName()] },
            { name: 'buildingNumber', label: 'Numer budynku', type: 'text', value: plot?.buildingNumber },
            ...coordFields(plot),
            ...(isAdmin() ? [{ name: 'ignoreOverlap', label: 'Ignoruj kolizje z innymi działkami', type: 'checkbox' }] : [])
        ],
        onSubmit: async v => {
            const body = { ...v };
            if (!body.ignoreOverlap) delete body.ignoreOverlap;
            const res = plot
                ? await request('PATCH', `/api/plots/${plot.dbId}`, { ...body, version: plot.version })
                : await request('POST', '/api/plots', body);
            reload(res.plot.name);
        }
    });
}

function openTransferForm(plot) {
    const lastDay = Math.max(0, ...((plot.history ?? []).map(t => parseInt(t.date, 10) || 0)));
    const owners = [{ value: '', label: 'Skarb Miasta' },
        ...appData.allOwners.filter(o => o.ref).map(o => ({ value: `${o.ref.kind}:${o.ref.number}`, label: `${o.name} (${o.type})` }))];
    openDialog({
        title: `Przekaż własność: ${plot.name}`,
        submitLabel: 'Zapisz transakcję',
        fields: [
            { name: 'owner', label: 'Nowy właściciel', type: 'select', numeric: false, value: '', options: owners },
            { name: 'transactionType', label: 'Typ transakcji', type: 'text', required: true, value: 'Sprzedaż' },
            { name: 'transactionValue', label: 'Wartość transakcji', type: 'text' },
            { name: 'checkNumber', label: 'Numer czeku', type: 'text' },
            { name: 'transactionDay', label: 'Dzień transakcji', type: 'number', required: true, value: lastDay + 1 },
            { name: 'paid', label: 'Opłacone (zmienia aktualnego właściciela)', type: 'checkbox', value: true }
        ],
        onSubmit: async v => {
            let newOwner = null;
            if (v.owner) { const [kind, number] = v.owner.split(':'); newOwner = { kind, number: Number(number) }; }
            await request('POST', `/api/plots/${plot.dbId}/transfer`, {
                version: plot.version, newOwner, transactionDay: v.transactionDay, transactionType: v.transactionType,
                transactionValue: v.transactionValue, checkNumber: v.checkNumber, paid: v.paid
            });
            reload(plot.name);
        }
    });
}

function openStreetForm(segment) {
    const rect = segment && { x1: segment.x1, z1: segment.z1, x2: segment.x1 + segment.width - 1, z2: segment.z1 + segment.height - 1 };
    openDialog({
        title: segment ? `Edytuj odcinek ulicy: ${segment.name}` : 'Nowa ulica / odcinek',
        pick: { fields: ['x1', 'z1', 'x2', 'z2'] },
        preview: areaPreview,
        fields: [{ name: 'name', label: 'Nazwa (max 64 znaki)', type: 'text', required: true, value: segment?.name }, ...coordFields(rect)],
        onSubmit: async v => {
            await (segment ? request('PATCH', `/api/streets/${segment.id}`, v) : request('POST', '/api/streets', v));
            reload();
        }
    });
}

function openDistrictForm(district) {
    openDialog({
        title: district ? `Zmień nazwę dzielnicy: ${district.name}` : 'Nowa dzielnica',
        fields: [{ name: 'name', label: 'Nazwa (max 64 znaki)', type: 'text', required: true, value: district?.name }],
        onSubmit: async v => {
            await (district ? request('PATCH', `/api/districts/${district.id}`, v) : request('POST', '/api/districts', v));
            reload();
        }
    });
}

async function confirmDelete(label, path) {
    if (!confirm(`Na pewno usunąć: ${label}? Tej operacji nie można cofnąć.`)) return;
    try {
        await request('DELETE', path);
        reload(null);
    } catch (err) {
        alert(describeError(err));
    }
}

// ─── modal integration ───────────────────────────────────────────────────────────

const btn = (action, id, text, danger = false) =>
    `<button data-edit="${action}" data-id="${id}" class="text-sm py-1.5 px-3 rounded-md border ${danger ? 'border-red-700 text-red-300 hover:bg-red-900' : 'border-gray-600 text-white hover:bg-gray-600'} bg-gray-700 transition-colors">${text}</button>`;

/** HTML for the editor buttons shown at the bottom of a modal; empty for non-editors. All interpolated values are numbers. */
export function editorButtonsHTML(kind, data) {
    if (!isEditor()) return '';
    let buttons = '';
    if (kind === 'plot') {
        buttons = btn('plot-edit', data.dbId, 'Edytuj') + btn('plot-transfer', data.dbId, 'Przekaż własność')
            + (isAdmin() ? btn('plot-delete', data.dbId, 'Usuń', true) : '');
    } else if (kind === 'street') {
        const segments = appData.streets.filter(s => s.name === data);
        buttons = segments.map((s, i) => btn('street-edit', s.id, segments.length > 1 ? `Edytuj odcinek ${i + 1}` : 'Edytuj')
            + (isAdmin() ? btn('street-delete', s.id, segments.length > 1 ? `Usuń odcinek ${i + 1}` : 'Usuń', true) : '')).join('');
    } else if (kind === 'metroLine') {
        if (isAdmin()) buttons = btn('metro-line-edit', data, 'Edytuj linię');
    } else if (kind === 'metroStation') {
        if (isAdmin()) buttons = btn('metro-station-edit', data, 'Zmień nazwę');
    } else if (kind === 'district') {
        const d = appData.districts.find(x => x.name === data);
        if (d) buttons = btn('district-edit', d.id, 'Zmień nazwę') + (isAdmin() ? btn('district-delete', d.id, 'Usuń', true) : '');
    }
    return buttons ? `<div class="border-t border-gray-700 pt-3 mt-3 flex flex-wrap gap-2" data-editor-buttons>${buttons}</div>` : '';
}

export function wireEditorButtons(root) {
    root.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
        const id = Number(el.dataset.id);
        const plot = () => appData.allPlots.find(p => p.dbId === id);
        switch (el.dataset.edit) {
            case 'plot-edit': return openPlotForm(plot());
            case 'plot-transfer': return openTransferForm(plot());
            case 'plot-delete': return confirmDelete(`działka ${plot().name}`, `/api/plots/${id}`);
            case 'street-edit': return openStreetForm(appData.streets.find(s => s.id === id));
            case 'street-delete': return confirmDelete('odcinek ulicy', `/api/streets/${id}`);
            case 'district-edit': return openDistrictForm(appData.districts.find(d => d.id === id));
            case 'metro-line-edit': return openMetroLineForm(appData.metro.lines.find(l => l.id === id));
            case 'metro-station-edit': return openMetroStationForm(appData.metro.stations.find(x => x.id === id));
            case 'district-delete': return confirmDelete('dzielnica', `/api/districts/${id}`);
        }
    }));
}

// ─── metro (admin) ───────────────────────────────────────────────────────────────

const COLOR_NAMES = {
    c: 'Czerwony', 9: 'Niebieski', a: 'Jasnozielony', e: 'Żółty', 6: 'Pomarańczowy', d: 'Różowy', b: 'Błękitny', f: 'Biały',
    5: 'Fioletowy', 2: 'Zielony', 3: 'Morski', 4: 'Ciemnoczerwony', 1: 'Granatowy', n: 'Miedziany', u: 'Ametystowy'
};
const SPEED_PRESETS = [4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40];

/** An ordered list of stops: pick a station per row, move rows up/down or remove them. */
function stopListWidget(selectedIds) {
    const options = appData.metro.stations.map(st => ({ value: st.id, label: st.name }));
    const list = h('div', { class: 'space-y-2 mt-1' });
    const addRow = id => {
        const select = h('select', { class: INPUT_CLASS + ' !mt-0 flex-1' },
            options.map(o => h('option', { value: o.value, selected: o.value === id }, o.label)));
        const row = h('div', { class: 'flex items-center gap-2' }, select,
            h('button', { type: 'button', class: BTN_SECONDARY + ' !px-2 !py-1', title: 'W górę', onclick: () => { if (row.previousElementSibling) list.insertBefore(row, row.previousElementSibling); } }, '↑'),
            h('button', { type: 'button', class: BTN_SECONDARY + ' !px-2 !py-1', title: 'W dół', onclick: () => { if (row.nextElementSibling) list.insertBefore(row.nextElementSibling, row); } }, '↓'),
            h('button', { type: 'button', class: BTN_SECONDARY + ' !px-2 !py-1', title: 'Usuń', onclick: () => row.remove() }, '×'));
        list.append(row);
    };
    selectedIds.forEach(addRow);
    const add = h('button', { type: 'button', class: BTN_SECONDARY + ' mt-2 w-full', onclick: () => addRow(options[0]?.value) }, '+ Dodaj przystanek');
    return { el: h('div', {}, list, add), read: () => [...list.querySelectorAll('select')].map(sel => Number(sel.value)) };
}

function openMetroLineForm(line) {
    const speeds = [...new Set([...SPEED_PRESETS, line.speed])].sort((a, b) => a - b);
    openDialog({
        title: `Edytuj linię ${line.name}`,
        fields: [
            { name: 'color', label: 'Kolor', type: 'select', numeric: false, value: line.color, options: appData.metro.palette.map(p => ({ value: p.code, label: `${COLOR_NAMES[p.code] ?? p.code} (${p.hex})` })) },
            { name: 'speed', label: 'Prędkość (m/s)', type: 'select', value: line.speed, options: speeds.map(v => ({ value: v, label: String(v) })) },
            { name: 'dwellSeconds', label: 'Postój na stacji (s)', type: 'number', required: true, value: line.dwellSeconds },
            { name: 'trainCount', label: 'Liczba pociągów', type: 'number', required: true, value: line.trainCount },
            { name: 'circular', label: 'Linia okrężna', type: 'checkbox', value: line.circular },
            { name: 'throughLoops', label: 'Przejazd przez pętle na końcach', type: 'checkbox', value: line.throughLoops },
            { name: 'shuttle', label: 'Wahadło', type: 'checkbox', value: line.shuttle },
            { name: 'stationIds', label: 'Przystanki (w kolejności)', type: 'custom', build: () => stopListWidget(line.stationIds) }
        ],
        preview: () => 'Zmiana przystanków lub rodzaju linii zatrzyma ją w grze, dopóki nie skompilujesz i nie uruchomisz trasy ponownie.',
        onSubmit: async v => {
            await request('PATCH', `/api/metro/lines/${line.id}`, v);
            reload(null, `metro-line=${line.id}`);
        }
    });
}

function openMetroStationForm(station) {
    openDialog({
        title: `Zmień nazwę stacji: ${station.name}`,
        fields: [{ name: 'name', label: 'Nazwa (max 64 znaki)', type: 'text', required: true, value: station.name }],
        onSubmit: async v => {
            await request('PATCH', `/api/metro/stations/${station.id}`, v);
            reload(null, `metro-station=${station.id}`);
        }
    });
}

async function exportMetroModule() {
    try {
        const res = await fetch(`${API_BASE}/api/metro/export?format=module`, { headers: authHeaders(getToken()) });
        if (!res.ok) throw Object.assign(new Error('export'), { status: res.status, data: await res.json().catch(() => ({})) });
        saveFile('MetroImportData.ts', await res.text(), 'text/plain');
        openPanel('Plik metra dla gry', [
            h('p', {}, 'Pobrano MetroImportData.ts. Zawiera zmiany istniejących linii (kolor, prędkość, postój, pociągi, rodzaj, przystanki) i nazw stacji. W paczce TransportationBP:'),
            list(['podmień src/registry/metro/MetroImportData.ts tym plikiem i uruchom npm run build,',
                '/scriptevent nb:metro_import_check — sprawdzenie bez zmian,',
                '/scriptevent nb:metro_import_apply — zastosowanie (linie ze zmienionymi przystankami zostaną zatrzymane).'])
        ], [{ label: 'Zamknij', onclick: (_, o) => o.remove() }]);
    } catch (err) {
        alert(describeError(err));
    }
}

async function importMetroFromFile(file) {
    let doc;
    try { doc = JSON.parse(await file.text()); }
    catch { alert('To nie jest poprawny plik JSON.'); return; }

    let plan;
    try { plan = await request('POST', '/api/metro/import?dryRun=1', doc); }
    catch (err) {
        if (err.data?.errors) openPanel('Nieprawidłowy plik metra', [list(err.data.errors, 15)], [{ label: 'Zamknij', onclick: (_, o) => o.remove() }]);
        else alert(describeError(err));
        return;
    }
    const { before, after } = plan.counts;
    openPanel('Import metra z gry — podsumowanie', [
        h('p', { class: 'text-yellow-300' }, 'Import ZASTĘPUJE wszystkie linie i stacje danymi z gry.'),
        list([`Linie: ${before.lines} → ${after.lines}`, `Stacje: ${before.stations} → ${after.stations}`]),
        ...(plan.overwritten.length ? [h('p', { class: 'text-yellow-300' }, 'Zmiany z portalu, które zostaną utracone:'), list(plan.overwritten)] : []),
        ...(plan.warnings.length ? [h('p', { class: 'text-yellow-300' }, 'Uwagi:'), list(plan.warnings)] : [])
    ], [
        { label: 'Anuluj', onclick: (_, o) => o.remove() },
        { label: 'Zastosuj import', primary: true, onclick: async btn => {
            btn.disabled = true;
            try { await request('POST', '/api/metro/import', doc); reload(null); }
            catch (err) { btn.disabled = false; alert(describeError(err)); }
        } }
    ]);
}

// ─── GovBP exchange (admin) ──────────────────────────────────────────────────────

function openPanel(title, content, buttons) {
    const overlay = h('div', { class: 'fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 p-4' },
        h('div', { class: 'bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-600 w-full max-w-lg max-h-full overflow-y-auto' },
            h('div', { class: 'flex justify-between items-center mb-4' },
                h('h2', { class: 'text-xl font-bold' }, title),
                h('button', { type: 'button', class: 'text-gray-400 hover:text-white text-2xl', onclick: () => overlay.remove() }, '×')),
            h('div', { class: 'space-y-3 text-sm text-gray-300' }, content),
            h('div', { class: 'flex justify-end gap-3 pt-4' }, buttons.map(b =>
                h('button', { type: 'button', class: b.primary ? BTN_PRIMARY : BTN_SECONDARY, onclick: async e => { await b.onclick(e.currentTarget, overlay); } }, b.label)))));
    document.body.append(overlay);
    return overlay;
}

const list = (items, max = 12) => h('ul', { class: 'list-disc pl-5 space-y-1' },
    items.slice(0, max).map(i => h('li', {}, i)), items.length > max ? h('li', {}, `…i ${items.length - max} więcej`) : '');

function saveFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/** kind: 'json' (the exchange document) or 'module' (ImportData.ts for GovernmentBP). */
async function exportForGov(kind, allowUnlinked = false) {
    const query = [kind === 'module' ? 'format=module' : '', allowUnlinked ? 'allowUnlinked=1' : ''].filter(Boolean).join('&');
    const path = `/api/export${query ? `?${query}` : ''}`;
    try {
        if (kind === 'module') {
            const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(getToken()) });
            if (!res.ok) throw Object.assign(new Error('export'), { status: res.status, data: await res.json().catch(() => ({})) });
            saveFile('ImportData.ts', await res.text(), 'text/plain');
            openPanel('Plik importu dla GovBP', [
                h('p', {}, 'Pobrano ImportData.ts. W paczce GovernmentBP:'),
                list(['podmień src/registry/land/ImportData.ts tym plikiem i uruchom npm run build,',
                    '/scriptevent nb:land_import_check — sprawdzenie bez zmian,',
                    '/scriptevent nb:land_import_apply — zastosowanie (najpierw loguje kopię zapasową).'])
            ], [{ label: 'Zamknij', onclick: (_, o) => o.remove() }]);
            return;
        }
        const { doc, warnings } = await request('GET', path);
        saveFile(`land-export-${stamp()}.json`, JSON.stringify(doc, null, 2), 'application/json');
        openPanel('Eksport JSON', [
            h('p', {}, `Pobrano plik: ${doc.plots.length} działek, ${doc.streets.length} ulic, ${doc.ownershipHistory.length} zmian własności.`),
            ...(warnings.length ? [h('p', { class: 'text-yellow-300' }, 'Uwagi:'), list(warnings)] : [])
        ], [{ label: 'Zamknij', onclick: (_, o) => o.remove() }]);
    } catch (err) {
        if (err.data?.error === 'unlinked_owners') {
            openPanel('Właściciele bez identyfikatora GovBP', [
                h('p', {}, 'Ci właściciele nie mają numeru z GovernmentBP, więc nie da się ich zapisać w formacie wymiany:'),
                list(err.data.unlinked.map(u => `${u.name ?? `#${u.number}`} (${u.kind === 'citizen' ? 'obywatel' : 'firma'})`)),
                h('p', {}, 'Powiąż ich (najprościej: najpierw zaimportuj dane z GovBP — dopasowanie po nazwie), albo wyeksportuj mimo to — takie działki trafią do Skarbu Miasta.')
            ], [
                { label: 'Anuluj', onclick: (_, o) => o.remove() },
                { label: 'Eksportuj mimo to', primary: true, onclick: async (_, o) => { o.remove(); await exportForGov(kind, true); } }
            ]);
        } else {
            alert(describeError(err));
        }
    }
}

async function importFromFile(file) {
    let doc;
    try { doc = JSON.parse(await file.text()); }
    catch { alert('To nie jest poprawny plik JSON.'); return; }

    let plan;
    try { plan = await request('POST', '/api/import?dryRun=1', doc); }
    catch (err) {
        const errors = err.data?.errors;
        if (errors) openPanel('Nieprawidłowy plik importu', [list(errors, 15)], [{ label: 'Zamknij', onclick: (_, o) => o.remove() }]);
        else alert(describeError(err));
        return;
    }

    const rowsOf = ([label, key]) => `${label}: ${plan.counts.before[key] ?? '—'} → ${plan.counts.after[key] ?? '—'}`;
    const owners = (label, o) => `${label}: ${o.existing} istniejących, ${o.link.length} powiązanych po nazwie, ${o.create.length} nowych${o.create.length ? ` (${o.create.slice(0, 5).join(', ')}${o.create.length > 5 ? ', …' : ''})` : ''}`;
    openPanel('Import z GovBP — podsumowanie', [
        h('p', { class: 'text-yellow-300' }, 'Import ZASTĘPUJE wszystkie dane o gruntach (działki, ulice, dzielnice, lokale, historię własności, loterię, scalenia). Konta, role i PIN-y zostają.'),
        list([['Działki', 'plots'], ['Ulice', 'streets'], ['Dzielnice', 'districts'], ['Lokale', 'units'], ['Zmiany własności', 'ownershipHistory']].map(rowsOf)),
        list([owners('Obywatele', plan.citizens), owners('Firmy', plan.companies)]),
        ...(plan.warnings.length ? [h('p', { class: 'text-yellow-300' }, 'Uwagi:'), list(plan.warnings)] : [])
    ], [
        { label: 'Anuluj', onclick: (_, o) => o.remove() },
        { label: 'Zastosuj import', primary: true, onclick: async (btn, o) => {
            btn.disabled = true;
            try { await request('POST', '/api/import', doc); reload(null); }
            catch (err) { btn.disabled = false; alert(describeError(err)); }
        } }
    ]);
}

function pickImportFile(handler = importFromFile) {
    const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
    input.addEventListener('change', () => { if (input.files[0]) handler(input.files[0]); input.remove(); });
    document.body.append(input);
    input.click();
}

// ─── toolbar ─────────────────────────────────────────────────────────────────────

let toolbar;
let adminSection;

export function initializeEditor(data) {
    appData = data;
    if (!API_BASE || toolbar) return;
    toolbar = h('div', { id: 'editor-toolbar', class: 'hidden fixed left-4 bottom-4 z-30 flex flex-col gap-2 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl' },
        h('div', { class: 'text-xs text-gray-400 uppercase tracking-wide' }, 'Edycja'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: () => openPlotForm(null) }, '+ Działka'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: () => openStreetForm(null) }, '+ Ulica'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: () => openDistrictForm(null) }, '+ Dzielnica'));
    adminSection = h('div', { class: 'hidden flex flex-col gap-2 border-t border-gray-600 pt-2 mt-1' },
        h('div', { class: 'text-xs text-gray-400 uppercase tracking-wide' }, 'GovBP'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: () => exportForGov('json') }, 'Eksport JSON'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: () => exportForGov('module') }, 'Plik importu GovBP'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: () => pickImportFile() }, 'Import JSON…'),
        h('div', { class: 'text-xs text-gray-400 uppercase tracking-wide pt-1' }, 'Metro'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: () => pickImportFile(importMetroFromFile) }, 'Import metra…'),
        h('button', { class: BTN_SECONDARY + ' text-sm', onclick: exportMetroModule }, 'Plik metra dla gry'));
    toolbar.append(adminSection);
    document.body.append(toolbar);
}

/** Call after login state changes. */
export function refreshEditorUI() {
    toolbar?.classList.toggle('hidden', !isEditor());
    adminSection?.classList.toggle('hidden', !isAdmin());
}
