// Automatic two-way land sync with GovernmentBP that only moves CHANGED records (see GovernmentBP src/registry/land/LandDelta.ts,
// the other half of this protocol, and tools/sync-agent.mjs, the transport).
//
//   GET  /api/sync/land-delta   portal -> game: the portal's changes since the last confirmed sync ({ id, delta } or { id: null })
//   POST /api/sync/land-result  the game's answer to that delta: assigned ids, rejected records, the records as they now are
//   POST /api/sync/land-delta   game -> portal: the game's changes ({ id, upserts, deletes, citizens, companies })
//
// Per record the portal remembers (table sync_base) the hash of its own representation as of the last confirmed sync. A record
// whose hash differs from that is "dirty" and goes into the next outgoing delta. The game wins conflicts: a portal change is
// rejected by the game when the game changed the same record in the meantime, and the game's version then overwrites the
// portal's. Records created here carry negative temporary ids; the game assigns the real numbers and the rows are re-keyed
// when the result arrives. The portal may change plots, streets, districts and ownership history; units, lottery, merges and
// zoning are authored in the game only, sectors only here.
//
// Scans are only done when something was edited (meta land_rev), so an idle portal costs nothing per minute.
import { sha256Hex } from './auth.js';
import { buildExport, planOwners, applyOwnerPlan } from './exchange.js';
import { assignSector } from './sectors.js';

const P2G = ['districts', 'streets', 'plots', 'ownershipHistory'];
const TABLE = {
    zoningTypes: 'zoning_types', districts: 'districts', streets: 'streets', plots: 'plots', units: 'units',
    ownershipHistory: 'ownership_history', lottery: 'lottery', merges: 'merges'
};
const UPSERT_ORDER = ['zoningTypes', 'districts', 'streets', 'plots', 'units', 'ownershipHistory', 'lottery', 'merges'];
const DELETE_ORDER = [...UPSERT_ORDER].reverse();
const DONATION_LABEL = 'Darowizna';
const SALE_LABEL = 'Sprzedaż';

/** The fields a person can actually change (the rest is derived and may legitimately differ between the two sides). */
const STATE_FIELDS = {
    plots: ['name', 'zoningTypeId', 'x1', 'z1', 'x2', 'z2', 'districtId', 'streetId', 'buildingNumber', 'owner', 'mergedInto', 'sectorId'],
    streets: ['name', 'x1', 'z1', 'x2', 'z2'],
    districts: ['name'],
    ownershipHistory: ['plotId', 'newOwner', 'transactionValue', 'transactionDay', 'transactionType', 'checkNumber', 'paid', 'paymentStatus']
};
const sameState = (set, a, b) => STATE_FIELDS[set].every(f => JSON.stringify(a[f] ?? null) === JSON.stringify(b[f] ?? null));

const hashRec = async rec => (await sha256Hex(JSON.stringify(rec))).slice(0, 16);

async function getMeta(db, key) {
    return (await db.prepare('SELECT value FROM meta WHERE key = ?1').bind(key).first())?.value ?? null;
}
const setMeta = (db, key, value) =>
    db.prepare('INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
const delMeta = (db, key) => db.prepare('DELETE FROM meta WHERE key = ?1').bind(key).run();
const getJson = async (db, key, fallback) => { try { return JSON.parse(await getMeta(db, key)) ?? fallback; } catch { return fallback; } };

/** Called after every successful edit: the next sync pass has to look for changes. */
export function bumpLandRev(db) {
    return db.prepare(`INSERT INTO meta (key, value) VALUES ('land_rev', '1')
                       ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`).run();
}

/** Forgets the sync baseline (after a full import): the next game delta starts the exchange over. */
export async function resetDelta(db) {
    await db.batch([
        db.prepare('DELETE FROM sync_base'),
        db.prepare("DELETE FROM meta WHERE key IN ('land_delta_ready', 'land_outbox', 'land_rev_scanned')")
    ]);
}

async function noteIssues(db, issues) {
    if (issues.length === 0) return;
    const all = [...issues.map(i => ({ ...i, at: new Date().toISOString() })), ...await getJson(db, 'land_sync_issues', [])].slice(0, 50);
    await setMeta(db, 'land_sync_issues', JSON.stringify(all));
}

// ─── portal -> game ──────────────────────────────────────────────────────────────

/** The portal's pending changes, or `{ id: null }`. The same outbox is returned until the game's result for it arrives. */
export async function buildOutbox(db) {
    if ((await getMeta(db, 'land_delta_ready')) !== '1') return { id: null };
    const existing = await getJson(db, 'land_outbox', null);
    if (existing) return { id: existing.id, delta: existing.delta };

    const rev = (await getMeta(db, 'land_rev')) ?? '0';
    if (rev === await getMeta(db, 'land_rev_scanned')) return { id: null };

    const { doc, skip } = await buildExport(db, { allowUnlinked: true });
    const baseRows = (await db.prepare('SELECT kind, id, hash FROM sync_base').all()).results;
    const delta = { upserts: {}, deletes: {} };
    const hashes = {};
    let count = 0;
    for (const set of P2G) {
        const base = new Map(baseRows.filter(r => r.kind === set).map(r => [r.id, r.hash]));
        const seen = new Set();
        for (const rec of doc[set]) {
            seen.add(rec.id);
            if (skip.has(`${set}:${rec.id}`)) continue;
            const h = await hashRec(rec);
            if (base.get(rec.id) === h) continue;
            (delta.upserts[set] ??= []).push(rec);
            (hashes[set] ??= {})[rec.id] = h;
            count++;
        }
        for (const id of base.keys()) {
            if (seen.has(id)) continue;
            (delta.deletes[set] ??= []).push(id);
            (hashes[set] ??= {})[id] = null;
            count++;
        }
    }
    await setMeta(db, 'land_rev_scanned', rev);
    if (count === 0) return { id: null };

    const id = `p${(await hashRec(delta)).slice(0, 8)}${Date.now().toString(36)}`;
    await setMeta(db, 'land_outbox', JSON.stringify({ id, delta, hashes }));
    return { id, delta };
}

/** Moves a portal-created record from its temporary id to the number the game assigned. */
function rekeyStatements(db, set, from, to) {
    const upd = (sql, ...args) => db.prepare(sql).bind(...args);
    const out = [];
    if (set === 'plots') {
        out.push(
            upd('UPDATE units SET plot_id = ?2 WHERE plot_id = ?1', from, to),
            upd('UPDATE ownership_history SET plot_id = ?2 WHERE plot_id = ?1', from, to),
            upd('UPDATE lottery SET plot_id = ?2 WHERE plot_id = ?1', from, to),
            upd('UPDATE merges SET main_plot_id = ?2 WHERE main_plot_id = ?1', from, to),
            upd('UPDATE merges SET merging_plot_id = ?2 WHERE merging_plot_id = ?1', from, to),
            upd('UPDATE plots SET merged_into = ?2 WHERE merged_into = ?1', from, to)
        );
    } else if (set === 'streets') {
        out.push(upd('UPDATE plots SET street_id = ?2 WHERE street_id = ?1', from, to));
    } else if (set === 'districts') {
        out.push(upd('UPDATE plots SET district_id = ?2 WHERE district_id = ?1', from, to));
    }
    out.push(upd(`UPDATE ${TABLE[set]} SET id = ?2 WHERE id = ?1`, from, to));
    return out;
}

/** The game's answer to an outbox delta. */
export async function receiveResult(db, body) {
    const outbox = await getJson(db, 'land_outbox', null);
    if (!outbox || outbox.id !== body?.id) return { status: 200, body: { ok: true, ignored: true } };

    // 1. Temporary ids -> real numbers.
    const stmts = [db.prepare('PRAGMA defer_foreign_keys = on')];
    for (const [set, map] of Object.entries(body.idMap ?? {})) {
        if (!TABLE[set]) continue;
        for (const [from, to] of Object.entries(map)) stmts.push(...rekeyStatements(db, set, Number(from), Number(to)));
    }
    if (stmts.length > 1) await db.batch(stmts);

    // 2. The records as the game now has them (normalised, with their real ids): they are the new baseline.
    const touched = new Set();
    const applied = body.applied ?? {};
    for (const [set, recs] of Object.entries(applied.upserts ?? {})) for (const r of recs) touched.add(`${set}:${r.id}`);
    for (const [set, ids] of Object.entries(applied.deletes ?? {})) for (const id of ids) touched.add(`${set}:${id}`);
    await applyGameDelta(db, { upserts: applied.upserts, deletes: applied.deletes, citizens: body.citizens, companies: body.companies }, { force: true });

    // 3. Everything else that was sent: accepted ones are in sync now, rejected ones are noted.
    const rejected = new Map((body.rejected ?? []).map(r => [`${r.set}:${r.id}`, r]));
    const issues = [];
    const remap = new Map();
    for (const [set, map] of Object.entries(body.idMap ?? {})) for (const [from, to] of Object.entries(map)) remap.set(`${set}:${from}`, to);
    const stmts2 = [];
    for (const [set, sent] of Object.entries(outbox.hashes)) {
        for (const [idText, hash] of Object.entries(sent)) {
            const key = `${set}:${idText}`;
            const rej = rejected.get(key);
            if (rej) {
                if (rej.reason !== 'conflict') {
                    issues.push({ set, id: Number(idText), reason: rej.reason });
                    if (hash !== null && Number(idText) > 0) stmts2.push(db.prepare('INSERT INTO sync_base (kind, id, hash) VALUES (?1, ?2, ?3) ON CONFLICT(kind, id) DO UPDATE SET hash = excluded.hash').bind(set, Number(idText), hash));
                }
                continue;   // a conflict stays dirty; the game's version arrives with its next delta
            }
            const realId = remap.get(key) ?? Number(idText);
            if (touched.has(`${set}:${realId}`)) continue;
            if (hash === null) stmts2.push(db.prepare('DELETE FROM sync_base WHERE kind = ?1 AND id = ?2').bind(set, realId));
            else if (realId > 0) stmts2.push(db.prepare('INSERT INTO sync_base (kind, id, hash) VALUES (?1, ?2, ?3) ON CONFLICT(kind, id) DO UPDATE SET hash = excluded.hash').bind(set, realId, hash));
        }
    }
    if (stmts2.length) await db.batch(stmts2);
    await noteIssues(db, issues);
    await delMeta(db, 'land_outbox');
    // Normalised records or re-keyed rows may need another look. After a conflict the game's own delta is on its way and
    // bumps the revision itself; rescanning now would only offer the same rejected change again.
    if (!(body.rejected ?? []).some(r => r.reason === 'conflict')) await bumpLandRev(db);
    return { status: 200, body: { ok: true, rejected: (body.rejected ?? []).length, issues: issues.length } };
}

// ─── game -> portal ──────────────────────────────────────────────────────────────

const isRec = r => r !== null && typeof r === 'object' && Number.isInteger(r.id);

/** Applies a game delta (upserts + deletes). Returns { ok, failed[], leftDirty }. Idempotent. With `force` (the game's answer to
 *  our own delta) the records count as in sync even if our view differs in derived fields, so a permanent difference cannot ping-pong. */
export async function applyGameDelta(db, delta, { force = false } = {}) {
    const upserts = delta?.upserts ?? {}, deletes = delta?.deletes ?? {};
    const d = {};
    for (const set of UPSERT_ORDER) if (Array.isArray(upserts[set])) d[set] = upserts[set].filter(isRec);
    const anyDeletes = DELETE_ORDER.some(s => Array.isArray(deletes[s]) && deletes[s].length);
    if (Object.values(d).every(l => l.length === 0) && !anyDeletes) return { ok: true, failed: [], leftDirty: false };

    const plan = await planOwners(db, { citizens: delta.citizens ?? [], companies: delta.companies ?? [] }, d);
    const own = await applyOwnerPlan(db, plan);
    const sectors = (await db.prepare('SELECT * FROM sectors').all()).results;

    // One group of statements per record, so a record the database refuses cannot block the others.
    const groups = [];   // { label, stmts }
    const add = (label, ...stmts) => groups.push({ label, stmts });
    const up = (set, rec) => {
        const p = (sql, ...a) => db.prepare(sql).bind(...a);
        switch (set) {
            case 'zoningTypes':
                return add(`${set}:${rec.id}`, p(`INSERT INTO zoning_types (id, name, price_per_100_blocks, counts_for_allowance) VALUES (?1, ?2, ?3, ?4)
                    ON CONFLICT(id) DO UPDATE SET name = excluded.name, price_per_100_blocks = excluded.price_per_100_blocks, counts_for_allowance = excluded.counts_for_allowance`,
                    rec.id, rec.name, rec.pricePer100Blocks, rec.countsForAllowance ? 1 : 0));
            case 'districts':
                return add(`${set}:${rec.id}`, p('INSERT INTO districts (id, name) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET name = excluded.name', rec.id, rec.name));
            case 'streets':
                return add(`${set}:${rec.id}`, p(`INSERT INTO streets (id, name, x1, z1, x2, z2) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                    ON CONFLICT(id) DO UPDATE SET name = excluded.name, x1 = excluded.x1, z1 = excluded.z1, x2 = excluded.x2, z2 = excluded.z2`,
                    rec.id, rec.name, rec.x1, rec.z1, rec.x2, rec.z2));
            case 'plots': {
                const [kind, number] = own(rec.owner ?? null);
                const sectorId = assignSector(sectors, rec.x1, rec.z1, rec.x2, rec.z2);   // the portal owns sector assignment
                return add(`${set}:${rec.id}`,
                    p(`INSERT INTO plots (id, name, zoning_type_id, x1, z1, x2, z2, side_x, side_z, area, value, sector_id, district_id, street_id, building_number, owner_kind, owner_number)
                       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
                       ON CONFLICT(id) DO UPDATE SET name = excluded.name, zoning_type_id = excluded.zoning_type_id, x1 = excluded.x1, z1 = excluded.z1, x2 = excluded.x2, z2 = excluded.z2,
                         side_x = excluded.side_x, side_z = excluded.side_z, area = excluded.area, value = excluded.value, sector_id = excluded.sector_id,
                         district_id = excluded.district_id, street_id = excluded.street_id, building_number = excluded.building_number,
                         owner_kind = excluded.owner_kind, owner_number = excluded.owner_number, version = plots.version + 1, updated_at = datetime('now')`,
                    rec.id, rec.name, rec.zoningTypeId ?? null, rec.x1, rec.z1, rec.x2, rec.z2, rec.sideX, rec.sideZ, rec.area, rec.value, sectorId, rec.districtId ?? null, rec.streetId ?? null, rec.buildingNumber ?? null, kind, number),
                    p('UPDATE plots SET merged_into = ?1 WHERE id = ?2', rec.mergedInto ?? null, rec.id));
            }
            case 'units': {
                const [kind, number] = own(rec.tenant ?? null);
                return add(`${set}:${rec.id}`, p(`INSERT INTO units (id, plot_id, unit_number, stairwell, floor, area, bed_count, workplace_count, tenant_kind, tenant_number)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                    ON CONFLICT(id) DO UPDATE SET plot_id = excluded.plot_id, unit_number = excluded.unit_number, stairwell = excluded.stairwell, floor = excluded.floor, area = excluded.area,
                      bed_count = excluded.bed_count, workplace_count = excluded.workplace_count, tenant_kind = excluded.tenant_kind, tenant_number = excluded.tenant_number`,
                    rec.id, rec.plotId, rec.unitNumber ?? '', rec.stairwell ?? '', String(rec.floor ?? 0), rec.area ?? 0, rec.bedCount ?? 0, rec.workplaceCount ?? 0, kind, number));
            }
            case 'ownershipHistory': {
                const [kind, number] = own(rec.newOwner ?? null);
                return add(`${set}:${rec.id}`, p(`INSERT INTO ownership_history (id, plot_id, owner_kind, owner_number, transaction_value, transaction_day, transaction_type, check_number, paid, payment_status)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                    ON CONFLICT(id) DO UPDATE SET plot_id = excluded.plot_id, owner_kind = excluded.owner_kind, owner_number = excluded.owner_number, transaction_value = excluded.transaction_value,
                      transaction_day = excluded.transaction_day, transaction_type = excluded.transaction_type, check_number = excluded.check_number, paid = excluded.paid, payment_status = excluded.payment_status`,
                    rec.id, rec.plotId, kind, number, String(rec.transactionValue ?? 0), rec.transactionDay ?? 0, rec.transactionType === 'donation' ? DONATION_LABEL : SALE_LABEL,
                    rec.checkNumber ?? null, rec.paid ? 1 : 0, rec.paid ? 'paid' : (rec.paymentStatus ?? null)));
            }
            case 'lottery': {
                const [kind, number] = own(rec.winner ?? null);
                return add(`${set}:${rec.id}`, p(`INSERT INTO lottery (id, plot_id, winner_kind, winner_number, amount, check_number, paid, payment_status)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                    ON CONFLICT(id) DO UPDATE SET plot_id = excluded.plot_id, winner_kind = excluded.winner_kind, winner_number = excluded.winner_number, amount = excluded.amount,
                      check_number = excluded.check_number, paid = excluded.paid, payment_status = excluded.payment_status`,
                    rec.id, rec.plotId, kind, number, String(rec.amount ?? 0), rec.checkNumber ?? null, rec.paid ? 1 : 0, rec.paid ? 'paid' : (rec.paymentStatus ?? null)));
            }
            case 'merges':
                return add(`${set}:${rec.id}`, p(`INSERT INTO merges (id, main_plot_id, merging_plot_id) VALUES (?1, ?2, ?3)
                    ON CONFLICT(id) DO UPDATE SET main_plot_id = excluded.main_plot_id, merging_plot_id = excluded.merging_plot_id`, rec.id, rec.mainPlotId, rec.mergingPlotId));
        }
    };
    for (const set of UPSERT_ORDER) for (const rec of d[set] ?? []) up(set, rec);
    for (const set of DELETE_ORDER) {
        for (const id of (Array.isArray(deletes[set]) ? deletes[set] : []).filter(Number.isInteger)) {
            const stmts = [db.prepare(`DELETE FROM ${TABLE[set]} WHERE id = ?1`).bind(id)];
            if (P2G.includes(set)) stmts.push(db.prepare('DELETE FROM sync_base WHERE kind = ?1 AND id = ?2').bind(set, id));
            add(`${set}:${id} (delete)`, ...stmts);
        }
    }

    const failed = [];
    const run = async list => db.batch([db.prepare('PRAGMA defer_foreign_keys = on'), ...list.flatMap(g => g.stmts)]);
    try {
        await run(groups);
    } catch {
        for (const g of groups) {
            try { await run([g]); } catch (err) { failed.push({ label: g.label, reason: String(err?.message ?? err).slice(0, 200) }); }
        }
    }
    const failedLabels = new Set(failed.map(f => f.label));

    // The new baseline: a game record that the portal now represents identically is in sync; if the portal's own view differs
    // (it assigned a sector, say) the record stays dirty and goes back to the game with the next outgoing delta.
    let leftDirty = false;
    const wanted = P2G.filter(set => (d[set] ?? []).length > 0);
    if (wanted.length > 0) {
        const { doc } = await buildExport(db, { allowUnlinked: true });
        const stmts = [];
        for (const set of wanted) {
            const mine = new Map(doc[set].map(r => [r.id, r]));
            for (const rec of d[set]) {
                if (failedLabels.has(`${set}:${rec.id}`)) continue;
                const portalRec = mine.get(rec.id);
                if (!portalRec) continue;
                if (force || sameState(set, portalRec, rec)) {
                    stmts.push(db.prepare('INSERT INTO sync_base (kind, id, hash) VALUES (?1, ?2, ?3) ON CONFLICT(kind, id) DO UPDATE SET hash = excluded.hash').bind(set, rec.id, await hashRec(portalRec)));
                } else {
                    leftDirty = true;
                }
            }
        }
        if (stmts.length) await db.batch(stmts);
    }
    await noteIssues(db, failed.map(f => ({ set: 'import', id: 0, reason: `${f.label}: ${f.reason}` })));
    return { ok: failed.length === 0, failed, leftDirty };
}

export async function receiveGameDelta(db, body) {
    if (body === null || typeof body !== 'object') return { status: 400, body: { error: 'invalid_request' } };
    const res = await applyGameDelta(db, body);
    if ((await getMeta(db, 'land_delta_ready')) !== '1') await setMeta(db, 'land_delta_ready', '1');
    if (res.leftDirty || res.ok) await bumpLandRev(db);   // the portal may now have something to send back
    return { status: 200, body: { ok: true, failed: res.failed.length } };
}
