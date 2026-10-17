// Manual JSON exchange with GovernmentBP (admin only): GET /api/export, POST /api/import[?dryRun=1].
//
// The document format and validation are in LandExchange.ts, a verbatim copy of
// GovernmentBP/src/registry/land/LandExchange.ts (the canonical one) — keep them identical.
//
// Owners: inside the portal a citizen is referenced by citizens.number, but in the exchange format a
// citizen's number is their GovBP identity number and a company's number is its GovBP company number.
// Export/import translate between the two; citizens/companies are matched by that number, then (first
// time only) by case-insensitive name, and created when unknown.
//
// Import REPLACES the whole land dataset (zoning, districts, sectors, streets, plots, units, ownership,
// lottery, merges) in one batch. Portal accounts (citizens, roles, PINs, sessions) are never deleted.

import { EXCHANGE_VERSION, parseImport } from './LandExchange.ts';

const LAND_SETS = ['zoningTypes', 'districts', 'sectors', 'streets', 'plots', 'units', 'ownershipHistory', 'lottery', 'merges'];
const DONATION_LABEL = 'Darowizna';
const SALE_LABEL = 'Sprzedaż';

class HttpError extends Error {
    constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}

const rows = async (db, sql) => (await db.prepare(sql).all()).results;

/** Digits of a money-like text ("1 200", "22"), or 0 when there are none. */
function toMoney(text) {
    const m = /-?\d[\d\s]*/.exec(String(text ?? ''));
    return m ? parseInt(m[0].replace(/\s/g, ''), 10) : 0;
}
const toInt = v => { const n = parseInt(v, 10); return Number.isNaN(n) ? 0 : n; };

// ─── export ──────────────────────────────────────────────────────────────────────

export async function buildExport(db, { allowUnlinked = false } = {}) {
    const [zoning, districts, sectors, streets, citizens, companies, plots, units, ownership, lottery, merges, settings] = await Promise.all([
        rows(db, 'SELECT * FROM zoning_types ORDER BY id'), rows(db, 'SELECT * FROM districts ORDER BY id'),
        rows(db, 'SELECT * FROM sectors ORDER BY id'), rows(db, 'SELECT * FROM streets ORDER BY id'),
        rows(db, 'SELECT * FROM citizens ORDER BY number'), rows(db, 'SELECT * FROM companies ORDER BY number'),
        rows(db, 'SELECT * FROM plots ORDER BY id'), rows(db, 'SELECT * FROM units ORDER BY id'),
        rows(db, 'SELECT * FROM ownership_history ORDER BY id'), rows(db, 'SELECT * FROM lottery ORDER BY id'),
        rows(db, 'SELECT * FROM merges ORDER BY id'), rows(db, 'SELECT * FROM settings')
    ]);

    const citizenById = new Map(citizens.map(c => [c.number, c]));
    const companyById = new Map(companies.map(c => [c.number, c]));
    const unlinked = new Map();
    const warnings = [];

    // Internal ref -> exchange ref. Unlinked owners cannot be expressed in GovBP terms.
    const ref = (kind, number) => {
        if (!kind) return null;
        const rec = (kind === 'citizen' ? citizenById : companyById).get(number);
        const ext = kind === 'citizen' ? rec?.identity_number : rec?.gov_number;
        if (ext === null || ext === undefined) {
            unlinked.set(`${kind}:${number}`, { kind, number, name: rec?.name ?? null });
            return null;
        }
        return { kind, number: ext };
    };

    const plotsOut = plots.map(p => ({
        id: p.id, name: p.name, zoningTypeId: p.zoning_type_id,
        x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2, sideX: p.side_x, sideZ: p.side_z, area: p.area, value: p.value,
        sectorId: p.sector_id, districtId: p.district_id, streetId: p.street_id, buildingNumber: p.building_number,
        owner: ref(p.owner_kind, p.owner_number), mergedInto: p.merged_into
    }));
    // Units carry no geometry here: the portal does not store it, and GovBP keeps its own units on import.
    const unitsOut = units.map(u => ({
        id: u.id, plotId: u.plot_id, unitNumber: u.unit_number ?? '', stairwell: u.stairwell ?? '', floor: toInt(u.floor), area: u.area,
        bedCount: u.bed_count, workplaceCount: u.workplace_count, tenant: ref(u.tenant_kind, u.tenant_number)
    }));
    const ownershipOut = ownership.map(o => ({
        id: o.id, plotId: o.plot_id, newOwner: ref(o.owner_kind, o.owner_number),
        transactionValue: toMoney(o.transaction_value), transactionDay: o.transaction_day ?? 0,
        transactionType: o.transaction_type === DONATION_LABEL ? 'donation' : 'sale',
        checkNumber: o.check_number, paid: !!o.paid
    }));
    const lotteryOut = lottery.map(l => ({
        id: l.id, plotId: l.plot_id, winner: ref(l.winner_kind, l.winner_number), amount: toMoney(l.amount), checkNumber: l.check_number, paid: !!l.paid
    }));
    const mergesOut = merges.map(m => ({ id: m.id, mainPlotId: m.main_plot_id, mergingPlotId: m.merging_plot_id }));

    const odd = ownership.filter(o => o.transaction_type !== DONATION_LABEL && o.transaction_type !== SALE_LABEL).length;
    if (odd > 0) warnings.push(`${odd} transakcji ma typ inny niż „${DONATION_LABEL}”/„${SALE_LABEL}” i zostanie wyeksportowane jako sprzedaż.`);

    if (unlinked.size > 0 && !allowUnlinked) return { unlinked: [...unlinked.values()] };
    if (unlinked.size > 0) warnings.push(`${unlinked.size} właścicieli bez identyfikatora GovBP wyeksportowano jako Skarb Miasta (brak właściciela).`);

    const doc = {
        schemaVersion: EXCHANGE_VERSION, source: 'portal', exportedAt: new Date().toISOString(),
        zoningTypes: zoning.map(z => ({ id: z.id, name: z.name, pricePer100Blocks: z.price_per_100_blocks })),
        districts: districts.map(d => ({ id: d.id, name: d.name })),
        sectors: sectors.map(s => ({ id: s.id, name: s.name, x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2 })),
        streets: streets.map(s => ({ id: s.id, name: s.name, x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2 })),
        plots: plotsOut, units: unitsOut, ownershipHistory: ownershipOut, lottery: lotteryOut, merges: mergesOut,
        settings: { plot_lottery_enabled: !!settings.find(s => s.key === 'plot_lottery_enabled')?.value },
        citizens: citizens.filter(c => c.identity_number !== null).map(c => ({
            identityNumber: c.identity_number, name: c.name, photoUrl: c.photo_url, profession: c.profession
        })),
        companies: companies.filter(c => c.gov_number !== null).map(c => ({ number: c.gov_number, name: c.name, legalForm: c.legal_form }))
    };
    return { doc, warnings, unlinked: [] };
}

/** The doc as a TypeScript module replacing GovernmentBP/src/registry/land/ImportData.ts. */
export function toGovModule(doc) {
    const id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `// Generated by the plot portal on ${doc.exportedAt}. Replaces src/registry/land/ImportData.ts.\n`
        + `// Then: npm run build, /scriptevent nb:land_import_check, /scriptevent nb:land_import_apply\n`
        + `export const importId: string | null = ${JSON.stringify(id)};\n`
        + `export const importData: unknown = ${JSON.stringify(doc)};\n`;
}

// ─── import ──────────────────────────────────────────────────────────────────────

const bodyRefs = d => [
    ...(d.plots ?? []).map(p => p.owner), ...(d.units ?? []).map(u => u.tenant),
    ...(d.ownershipHistory ?? []).map(o => o.newOwner), ...(d.lottery ?? []).map(l => l.winner)
].filter(Boolean);

/** Decides, for every citizen/company the document references, whether it exists, can be linked or must be created. */
async function planOwners(db, doc, d) {
    const [citizens, companies] = await Promise.all([rows(db, 'SELECT number, identity_number, name FROM citizens'), rows(db, 'SELECT number, gov_number, name FROM companies')]);
    const infoCit = new Map((doc.citizens ?? []).map(c => [c.identityNumber, c]));
    const infoCom = new Map((doc.companies ?? []).map(c => [c.number, c]));
    const refs = bodyRefs(d);
    const plan = { citizens: new Map(), companies: new Map() };

    const unlinkedByName = (list, key) => new Map(list.filter(x => x[key] === null).map(x => [x.name.toLowerCase(), x]));
    const freeCit = unlinkedByName(citizens, 'identity_number');
    const freeCom = unlinkedByName(companies, 'gov_number');
    const claimed = new Set();

    for (const r of refs) {
        const map = r.kind === 'citizen' ? plan.citizens : plan.companies;
        if (map.has(r.number)) continue;
        const existing = (r.kind === 'citizen' ? citizens : companies).find(x => (r.kind === 'citizen' ? x.identity_number : x.gov_number) === r.number);
        if (existing) { map.set(r.number, { action: 'existing', number: existing.number, name: existing.name }); continue; }

        const info = (r.kind === 'citizen' ? infoCit : infoCom).get(r.number);
        const byName = info ? (r.kind === 'citizen' ? freeCit : freeCom).get(String(info.name).toLowerCase()) : null;
        if (byName && !claimed.has(`${r.kind}:${byName.number}`)) {
            claimed.add(`${r.kind}:${byName.number}`);
            map.set(r.number, { action: 'link', number: byName.number, name: byName.name });
        } else {
            map.set(r.number, { action: 'create', number: null, name: info?.name ?? `${r.kind === 'citizen' ? 'Gracz' : 'Firma'} ${r.number}`, info });
        }
    }
    return plan;
}

export async function importDoc(env, viewer, doc, { dryRun }) {
    const report = parseImport(doc, { citizenExists: () => true, companyExists: () => true, lenient: true });
    if (!report.ok) throw new HttpError(400, { error: 'invalid_document', errors: report.errors, warnings: report.warnings });
    const d = report.data;

    const present = LAND_SETS.filter(k => d[k] !== undefined);
    if (present.length > 0 && present.length < LAND_SETS.length) {
        throw new HttpError(400, {
            error: 'incomplete_snapshot',
            errors: [`Import zastępuje cały zbiór danych o gruntach, więc dokument musi zawierać wszystkie zbiory. Brakuje: ${LAND_SETS.filter(k => d[k] === undefined).join(', ')}.`]
        });
    }

    const db = env.DB;
    const before = Object.fromEntries(await Promise.all(
        [['plots', 'plots'], ['streets', 'streets'], ['districts', 'districts'], ['units', 'units'], ['ownershipHistory', 'ownership_history']]
            .map(async ([k, t]) => [k, (await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first()).n])));

    const plan = present.length ? await planOwners(db, doc, d) : { citizens: new Map(), companies: new Map() };
    const describe = map => ({
        create: [...map.values()].filter(x => x.action === 'create').map(x => x.name),
        link: [...map.values()].filter(x => x.action === 'link').map(x => x.name),
        existing: [...map.values()].filter(x => x.action === 'existing').length
    });
    const summary = {
        ok: true, dryRun, warnings: report.warnings,
        counts: { after: report.counts, before },
        citizens: describe(plan.citizens), companies: describe(plan.companies),
        settings: d.plotLotteryEnabled === undefined ? null : { plot_lottery_enabled: d.plotLotteryEnabled }
    };
    if (dryRun) return { status: 200, body: summary };

    // Owners first (small, and harmless if the main batch later fails): link by name, create unknown ones.
    for (const [ext, p] of plan.citizens) {
        if (p.action === 'link') await db.prepare('UPDATE citizens SET identity_number = ?1 WHERE number = ?2').bind(ext, p.number).run();
        if (p.action === 'create') {
            const res = await db.prepare('INSERT INTO citizens (identity_number, name, photo_url, profession) VALUES (?1, ?2, ?3, ?4)')
                .bind(ext, p.name, p.info?.photoUrl ?? null, p.info?.profession ?? null).run();
            p.number = res.meta.last_row_id;
        }
    }
    for (const [ext, p] of plan.companies) {
        if (p.action === 'link') await db.prepare('UPDATE companies SET gov_number = ?1 WHERE number = ?2').bind(ext, p.number).run();
        if (p.action === 'create') {
            const res = await db.prepare('INSERT INTO companies (gov_number, name, legal_form) VALUES (?1, ?2, ?3)').bind(ext, p.name, p.info?.legalForm ?? null).run();
            p.number = res.meta.last_row_id;
        }
    }
    const own = r => {
        if (!r) return [null, null];
        const hit = (r.kind === 'citizen' ? plan.citizens : plan.companies).get(r.number);
        return [r.kind, hit.number];
    };

    const stmts = [];
    const add = (sql, ...args) => stmts.push(db.prepare(sql).bind(...args));

    if (present.length) {
        for (const t of ['merges', 'lottery', 'ownership_history', 'units', 'plots', 'streets', 'sectors', 'districts', 'zoning_types']) add(`DELETE FROM ${t}`);
        for (const z of d.zoningTypes) add('INSERT INTO zoning_types (id, name, price_per_100_blocks) VALUES (?1, ?2, ?3)', z.id, z.name, z.pricePer100Blocks);
        for (const x of d.districts) add('INSERT INTO districts (id, name) VALUES (?1, ?2)', x.id, x.name);
        for (const s of d.sectors) add('INSERT INTO sectors (id, name, x1, z1, x2, z2) VALUES (?1, ?2, ?3, ?4, ?5, ?6)', s.id, s.name, s.x1, s.z1, s.x2, s.z2);
        for (const s of d.streets) add('INSERT INTO streets (id, name, x1, z1, x2, z2) VALUES (?1, ?2, ?3, ?4, ?5, ?6)', s.id, s.name, s.x1, s.z1, s.x2, s.z2);
        // mergedInto may point forward, so plots are inserted first and linked afterwards.
        for (const p of d.plots) {
            const [kind, number] = own(p.owner);
            add(`INSERT INTO plots (id, name, zoning_type_id, x1, z1, x2, z2, side_x, side_z, area, value, sector_id, district_id, street_id, building_number, owner_kind, owner_number)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
            p.id, p.name, p.zoningTypeId, p.x1, p.z1, p.x2, p.z2, p.sideX, p.sideZ, p.area, p.value, p.sectorId, p.districtId, p.streetId, p.buildingNumber, kind, number);
        }
        for (const p of d.plots) if (p.mergedInto !== null) add('UPDATE plots SET merged_into = ?1 WHERE id = ?2', p.mergedInto, p.id);
        for (const u of d.units) {
            const [kind, number] = own(u.tenant);
            add(`INSERT INTO units (id, plot_id, unit_number, stairwell, floor, area, bed_count, workplace_count, tenant_kind, tenant_number)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
            u.id, u.plotId, u.unitNumber, u.stairwell, String(u.floor), u.area, u.bedCount, u.workplaceCount, kind, number);
        }
        for (const o of d.ownershipHistory) {
            const [kind, number] = own(o.newOwner);
            add(`INSERT INTO ownership_history (id, plot_id, owner_kind, owner_number, transaction_value, transaction_day, transaction_type, check_number, paid)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
            o.id, o.plotId, kind, number, String(o.transactionValue), o.transactionDay, o.transactionType === 'donation' ? DONATION_LABEL : SALE_LABEL, o.checkNumber, o.paid ? 1 : 0);
        }
        for (const l of d.lottery) {
            const [kind, number] = own(l.winner);
            add('INSERT INTO lottery (id, plot_id, winner_kind, winner_number, amount, check_number, paid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
                l.id, l.plotId, kind, number, String(l.amount), l.checkNumber, l.paid ? 1 : 0);
        }
        for (const m of d.merges) add('INSERT INTO merges (id, main_plot_id, merging_plot_id) VALUES (?1, ?2, ?3)', m.id, m.mainPlotId, m.mergingPlotId);
    }
    if (d.plotLotteryEnabled !== undefined) {
        add('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'plot_lottery_enabled', d.plotLotteryEnabled ? 1 : 0);
    }
    add(`INSERT INTO audit_log (actor, entity, entity_id, action, diff) VALUES (?1, 'land', NULL, 'import', ?2)`,
        viewer.number, JSON.stringify({ source: doc.source ?? null, exportedAt: doc.exportedAt ?? null, counts: report.counts, warnings: report.warnings }));

    await db.batch(stmts);
    return { status: 200, body: summary };
}

// ─── routes ──────────────────────────────────────────────────────────────────────

export async function handleExchange(env, viewer, method, url, body) {
    const isExport = method === 'GET' && url.pathname === '/api/export';
    const isImport = method === 'POST' && url.pathname === '/api/import';
    if (!isExport && !isImport) return null;

    if (!viewer) return { status: 401, body: { error: 'unauthorized' } };
    if (viewer.role !== 'admin') return { status: 403, body: { error: 'forbidden' } };

    try {
        if (isExport) {
            const result = await buildExport(env.DB, { allowUnlinked: url.searchParams.get('allowUnlinked') === '1' });
            if (result.unlinked.length) return { status: 409, body: { error: 'unlinked_owners', unlinked: result.unlinked } };
            if (url.searchParams.get('format') === 'module') return { status: 200, raw: toGovModule(result.doc), contentType: 'text/plain; charset=utf-8', filename: 'ImportData.ts' };
            return { status: 200, body: { doc: result.doc, warnings: result.warnings } };
        }
        if (body === null || typeof body !== 'object') return { status: 400, body: { error: 'invalid_request' } };
        return await importDoc(env, viewer, body.doc ?? body, { dryRun: url.searchParams.get('dryRun') === '1' });
    } catch (err) {
        if (err instanceof HttpError) return { status: err.status, body: err.body };
        throw err;
    }
}
