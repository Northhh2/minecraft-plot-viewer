// Write endpoints for plots, streets, districts and plot transfers (stage 3).
//
// Rules mirror GovernmentBP's land registries: rectangles are normalized to min/max, sides are
// inclusive (|x2-x1|+1), area = sideX*sideZ, value = round(area/100 * zoning.pricePer100Blocks),
// the sector is the one with the largest bounding-box overlap. Every write is recorded in audit_log
// in the same batch as the change. Plots use optimistic locking (`version`).
//
// Roles: clerk and admin edit; deleting entities and overriding the overlap check is admin-only.

import { mapPlot } from './snapshot.js';

class HttpError extends Error {
    constructor(status, code, extra = {}) {
        super(code);
        this.status = status;
        this.body = { error: code, ...extra };
    }
}

const COORD_LIMIT = 30_000_000;

// The portal escapes everything it puts into innerHTML (ui.js `esc`), but data also flows through other
// readers (the game, exports). Defence in depth: refuse markup-significant and control characters in
// anything staff can write.
const UNSAFE_TEXT = /[<>&"'`\\\u0000-\u001f]/;

function intField(v, field, { min = -COORD_LIMIT, max = COORD_LIMIT } = {}) {
    if (!Number.isInteger(v) || v < min || v > max) throw new HttpError(400, 'invalid_field', { field });
    return v;
}
const optInt = (v, field, opts) => (v === null || v === undefined ? null : intField(v, field, opts));

function strField(v, field, max, { required = true } = {}) {
    if (v === null || v === undefined || v === '') {
        if (required) throw new HttpError(400, 'invalid_field', { field });
        return null;
    }
    if (typeof v !== 'string' || v.trim().length === 0 || v.length > max || UNSAFE_TEXT.test(v)) throw new HttpError(400, 'invalid_field', { field });
    return v.trim();
}

const isAdmin = viewer => viewer?.role === 'admin';
const isStaff = viewer => viewer?.role === 'clerk' || viewer?.role === 'admin';

function requireStaff(viewer) {
    if (!viewer) throw new HttpError(401, 'unauthorized');
    if (!isStaff(viewer)) throw new HttpError(403, 'forbidden');
}
function requireAdmin(viewer) {
    if (!viewer) throw new HttpError(401, 'unauthorized');
    if (!isAdmin(viewer)) throw new HttpError(403, 'forbidden');
}

const json = rows => JSON.stringify(rows);

/** Prepared audit insert. `id === null` records the row created by the previous statement in the batch.
 *  With `onlyIfChanged`, nothing is written unless that previous statement changed a row. */
function auditStmt(db, actor, entity, id, action, before, after, { onlyIfChanged = false } = {}) {
    const guard = onlyIfChanged ? 'WHERE changes() > 0' : '';
    const diff = json({ before, after });
    return id === null
        ? db.prepare(`INSERT INTO audit_log (actor, entity, entity_id, action, diff) SELECT ?1, ?2, last_insert_rowid(), ?3, ?4 ${guard}`)
            .bind(actor.number, entity, action, diff)
        : db.prepare(`INSERT INTO audit_log (actor, entity, entity_id, action, diff) SELECT ?1, ?2, ?3, ?4, ?5 ${guard}`)
            .bind(actor.number, entity, id, action, diff);
}

async function one(db, sql, ...args) {
    return db.prepare(sql).bind(...args).first();
}
async function all(db, sql, ...args) {
    return (await db.prepare(sql).bind(...args).all()).results;
}

// ─── plots ──────────────────────────────────────────────────────────────────────

const PLOT_FIELDS = ['name', 'zoningTypeId', 'x1', 'z1', 'x2', 'z2', 'districtId', 'streetId', 'buildingNumber'];

async function resolvePlot(db, input, existing, { force }) {
    const cur = existing ? mapPlot(existing) : {};
    const m = { ...cur };
    for (const f of PLOT_FIELDS) if (f in input) m[f] = input[f];

    const name = strField(m.name, 'name', 32);
    const x1 = intField(m.x1, 'x1'), z1 = intField(m.z1, 'z1'), x2 = intField(m.x2, 'x2'), z2 = intField(m.z2, 'z2');
    const zoningTypeId = optInt(m.zoningTypeId, 'zoningTypeId', { min: 1 });
    const districtId = optInt(m.districtId, 'districtId', { min: 1 });
    const streetId = optInt(m.streetId, 'streetId', { min: 1 });
    const buildingNumber = strField(m.buildingNumber, 'buildingNumber', 16, { required: false });

    if (zoningTypeId !== null && !await one(db, 'SELECT 1 FROM zoning_types WHERE id = ?1', zoningTypeId)) throw new HttpError(400, 'unknown_reference', { field: 'zoningTypeId' });
    if (districtId !== null && !await one(db, 'SELECT 1 FROM districts WHERE id = ?1', districtId)) throw new HttpError(400, 'unknown_reference', { field: 'districtId' });
    if (streetId !== null && !await one(db, 'SELECT 1 FROM streets WHERE id = ?1', streetId)) throw new HttpError(400, 'unknown_reference', { field: 'streetId' });

    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
    const sideX = maxX - minX + 1, sideZ = maxZ - minZ + 1, area = sideX * sideZ;

    const dup = await one(db, 'SELECT id FROM plots WHERE lower(name) = lower(?1) AND id != ?2', name, existing?.id ?? 0);
    if (dup) throw new HttpError(409, 'name_taken', { plotId: dup.id });

    // Value only changes when geometry or zoning does; otherwise keep the stored (possibly manual) value.
    const geometryChanged = !existing || existing.zoning_type_id !== zoningTypeId
        || existing.x1 !== minX || existing.z1 !== minZ || existing.x2 !== maxX || existing.z2 !== maxZ;
    let value = existing?.value ?? 0;
    if (geometryChanged) {
        const zoning = zoningTypeId === null ? null : await one(db, 'SELECT price_per_100_blocks AS p FROM zoning_types WHERE id = ?1', zoningTypeId);
        value = Math.round(area / 100 * (zoning?.p ?? 0));
    }

    if (geometryChanged && !(force && input.ignoreOverlap)) {
        const overlaps = await all(db,
            `SELECT id, name FROM plots
             WHERE merged_into IS NULL AND id != ?1
               AND min(x1, x2) <= ?3 AND max(x1, x2) >= ?2 AND min(z1, z2) <= ?5 AND max(z1, z2) >= ?4
               AND id NOT IN (SELECT merging_plot_id FROM merges WHERE main_plot_id = ?1
                              UNION SELECT main_plot_id FROM merges WHERE merging_plot_id = ?1)`,
            existing?.id ?? 0, minX, maxX, minZ, maxZ);
        if (overlaps.length) throw new HttpError(409, 'overlap', { with: overlaps.map(o => o.name) });
    }

    let sectorId = null, best = 0;
    for (const s of await all(db, 'SELECT * FROM sectors')) {
        const w = Math.min(maxX, Math.max(s.x1, s.x2)) - Math.max(minX, Math.min(s.x1, s.x2)) + 1;
        const h = Math.min(maxZ, Math.max(s.z1, s.z2)) - Math.max(minZ, Math.min(s.z1, s.z2)) + 1;
        if (w > 0 && h > 0 && w * h > best) { best = w * h; sectorId = s.id; }
    }

    return { name, zoningTypeId, x1: minX, z1: minZ, x2: maxX, z2: maxZ, sideX, sideZ, area, value, sectorId, districtId, streetId, buildingNumber };
}

async function createPlot(env, viewer, body) {
    requireStaff(viewer);
    const p = await resolvePlot(env.DB, body ?? {}, null, { force: isAdmin(viewer) });
    const [res] = await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO plots (name, zoning_type_id, x1, z1, x2, z2, side_x, side_z, area, value, sector_id, district_id, street_id, building_number)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
        ).bind(p.name, p.zoningTypeId, p.x1, p.z1, p.x2, p.z2, p.sideX, p.sideZ, p.area, p.value, p.sectorId, p.districtId, p.streetId, p.buildingNumber),
        auditStmt(env.DB, viewer, 'plot', null, 'create', null, p)
    ]);
    const row = await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', res.meta.last_row_id);
    return { status: 201, body: { plot: mapPlot(row) } };
}

async function updatePlot(env, viewer, id, body) {
    requireStaff(viewer);
    const existing = await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', id);
    if (!existing) throw new HttpError(404, 'not_found');
    const version = intField(body?.version, 'version', { min: 1 });
    if (version !== existing.version) throw new HttpError(409, 'version_conflict', { current: mapPlot(existing) });

    const p = await resolvePlot(env.DB, body, existing, { force: isAdmin(viewer) });
    const results = await env.DB.batch([
        env.DB.prepare(
            `UPDATE plots SET name = ?1, zoning_type_id = ?2, x1 = ?3, z1 = ?4, x2 = ?5, z2 = ?6, side_x = ?7, side_z = ?8,
                              area = ?9, value = ?10, sector_id = ?11, district_id = ?12, street_id = ?13, building_number = ?14,
                              version = version + 1, updated_at = datetime('now')
             WHERE id = ?15 AND version = ?16`
        ).bind(p.name, p.zoningTypeId, p.x1, p.z1, p.x2, p.z2, p.sideX, p.sideZ, p.area, p.value, p.sectorId, p.districtId, p.streetId, p.buildingNumber, id, version),
        auditStmt(env.DB, viewer, 'plot', id, 'update', mapPlot(existing), p, { onlyIfChanged: true })
    ]);
    if (results[0].meta.changes === 0) {
        // Lost a race between the version check above and the write.
        throw new HttpError(409, 'version_conflict', { current: mapPlot(await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', id)) });
    }
    return { status: 200, body: { plot: mapPlot(await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', id)) } };
}

async function deletePlot(env, viewer, id) {
    requireAdmin(viewer);
    const existing = await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', id);
    if (!existing) throw new HttpError(404, 'not_found');
    const refs = await one(env.DB,
        `SELECT (SELECT COUNT(*) FROM units WHERE plot_id = ?1) AS units,
                (SELECT COUNT(*) FROM ownership_history WHERE plot_id = ?1) AS history,
                (SELECT COUNT(*) FROM lottery WHERE plot_id = ?1) AS lottery,
                (SELECT COUNT(*) FROM merges WHERE main_plot_id = ?1 OR merging_plot_id = ?1) AS merges`, id);
    if (refs.units || refs.history || refs.lottery || refs.merges) throw new HttpError(409, 'in_use', { references: refs });
    await env.DB.batch([
        env.DB.prepare('DELETE FROM plots WHERE id = ?1').bind(id),
        auditStmt(env.DB, viewer, 'plot', id, 'delete', mapPlot(existing), null)
    ]);
    return { status: 200, body: { ok: true } };
}

async function transferPlot(env, viewer, id, body) {
    requireStaff(viewer);
    const plot = await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', id);
    if (!plot) throw new HttpError(404, 'not_found');
    const version = intField(body?.version, 'version', { min: 1 });
    if (version !== plot.version) throw new HttpError(409, 'version_conflict', { current: mapPlot(plot) });

    let kind = null, number = null;
    if (body.newOwner !== null && body.newOwner !== undefined) {
        kind = body.newOwner.kind;
        number = intField(body.newOwner.number, 'newOwner.number', { min: 1 });
        if (kind !== 'citizen' && kind !== 'company') throw new HttpError(400, 'invalid_field', { field: 'newOwner.kind' });
        const table = kind === 'citizen' ? 'citizens' : 'companies';
        if (!await one(env.DB, `SELECT 1 FROM ${table} WHERE number = ?1`, number)) throw new HttpError(400, 'unknown_reference', { field: 'newOwner' });
    }
    const day = intField(body.transactionDay, 'transactionDay', { min: 0, max: 1_000_000 });
    const type = strField(body.transactionType, 'transactionType', 32);
    const value = strField(body.transactionValue, 'transactionValue', 32, { required: false });
    const check = strField(body.checkNumber, 'checkNumber', 32, { required: false });
    const paid = body.paid === true ? 1 : 0;

    const results = await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO ownership_history (plot_id, owner_kind, owner_number, transaction_value, transaction_day, transaction_type, check_number, paid)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
        ).bind(id, kind, number, value, day, type, check, paid),
        // The plot owner only changes once the transaction is paid, as in the old sheet logic.
        env.DB.prepare(
            `UPDATE plots SET owner_kind = CASE WHEN ?2 = 1 THEN ?3 ELSE owner_kind END,
                              owner_number = CASE WHEN ?2 = 1 THEN ?4 ELSE owner_number END,
                              version = version + 1, updated_at = datetime('now')
             WHERE id = ?1 AND version = ?5`
        ).bind(id, paid, kind, number, version),
        auditStmt(env.DB, viewer, 'plot', id, 'transfer', { owner: mapPlot(plot).owner },
            { newOwner: kind ? { kind, number } : null, day, type, value, check, paid: !!paid }, { onlyIfChanged: true })
    ]);
    if (results[1].meta.changes === 0) {
        // The insert already ran; undo it so history never shows a transfer the plot version rejected.
        await env.DB.prepare('DELETE FROM ownership_history WHERE id = ?1').bind(results[0].meta.last_row_id).run();
        throw new HttpError(409, 'version_conflict', { current: mapPlot(await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', id)) });
    }
    return { status: 200, body: { plot: mapPlot(await one(env.DB, 'SELECT * FROM plots WHERE id = ?1', id)) } };
}

// ─── streets & districts ────────────────────────────────────────────────────────

function streetFields(body, existing) {
    const m = { ...existing, ...body };
    const x1 = intField(m.x1, 'x1'), z1 = intField(m.z1, 'z1'), x2 = intField(m.x2, 'x2'), z2 = intField(m.z2, 'z2');
    return { name: strField(m.name, 'name', 64), x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2) };
}

async function createStreet(env, viewer, body) {
    requireStaff(viewer);
    const s = streetFields(body ?? {}, {});
    const [res] = await env.DB.batch([
        env.DB.prepare('INSERT INTO streets (name, x1, z1, x2, z2) VALUES (?1, ?2, ?3, ?4, ?5)').bind(s.name, s.x1, s.z1, s.x2, s.z2),
        auditStmt(env.DB, viewer, 'street', null, 'create', null, s)
    ]);
    return { status: 201, body: { street: { id: res.meta.last_row_id, ...s } } };
}

async function updateStreet(env, viewer, id, body) {
    requireStaff(viewer);
    const existing = await one(env.DB, 'SELECT * FROM streets WHERE id = ?1', id);
    if (!existing) throw new HttpError(404, 'not_found');
    const s = streetFields(body ?? {}, existing);
    await env.DB.batch([
        env.DB.prepare('UPDATE streets SET name = ?1, x1 = ?2, z1 = ?3, x2 = ?4, z2 = ?5 WHERE id = ?6').bind(s.name, s.x1, s.z1, s.x2, s.z2, id),
        auditStmt(env.DB, viewer, 'street', id, 'update', existing, s)
    ]);
    return { status: 200, body: { street: { id, ...s } } };
}

async function deleteStreet(env, viewer, id) {
    requireAdmin(viewer);
    const existing = await one(env.DB, 'SELECT * FROM streets WHERE id = ?1', id);
    if (!existing) throw new HttpError(404, 'not_found');
    const used = await one(env.DB, 'SELECT COUNT(*) AS n FROM plots WHERE street_id = ?1', id);
    if (used.n) throw new HttpError(409, 'in_use', { plots: used.n });
    await env.DB.batch([env.DB.prepare('DELETE FROM streets WHERE id = ?1').bind(id), auditStmt(env.DB, viewer, 'street', id, 'delete', existing, null)]);
    return { status: 200, body: { ok: true } };
}

async function createDistrict(env, viewer, body) {
    requireStaff(viewer);
    const name = strField(body?.name, 'name', 64);
    if (await one(env.DB, 'SELECT 1 FROM districts WHERE lower(name) = lower(?1)', name)) throw new HttpError(409, 'name_taken');
    const [res] = await env.DB.batch([
        env.DB.prepare('INSERT INTO districts (name) VALUES (?1)').bind(name),
        auditStmt(env.DB, viewer, 'district', null, 'create', null, { name })
    ]);
    return { status: 201, body: { district: { id: res.meta.last_row_id, name } } };
}

async function updateDistrict(env, viewer, id, body) {
    requireStaff(viewer);
    const existing = await one(env.DB, 'SELECT * FROM districts WHERE id = ?1', id);
    if (!existing) throw new HttpError(404, 'not_found');
    const name = strField(body?.name, 'name', 64);
    if (await one(env.DB, 'SELECT 1 FROM districts WHERE lower(name) = lower(?1) AND id != ?2', name, id)) throw new HttpError(409, 'name_taken');
    await env.DB.batch([
        env.DB.prepare('UPDATE districts SET name = ?1 WHERE id = ?2').bind(name, id),
        auditStmt(env.DB, viewer, 'district', id, 'update', existing, { name })
    ]);
    return { status: 200, body: { district: { id, name } } };
}

async function deleteDistrict(env, viewer, id) {
    requireAdmin(viewer);
    const existing = await one(env.DB, 'SELECT * FROM districts WHERE id = ?1', id);
    if (!existing) throw new HttpError(404, 'not_found');
    const used = await one(env.DB, 'SELECT COUNT(*) AS n FROM plots WHERE district_id = ?1', id);
    if (used.n) throw new HttpError(409, 'in_use', { plots: used.n });
    await env.DB.batch([env.DB.prepare('DELETE FROM districts WHERE id = ?1').bind(id), auditStmt(env.DB, viewer, 'district', id, 'delete', existing, null)]);
    return { status: 200, body: { ok: true } };
}

// ─── audit log ──────────────────────────────────────────────────────────────────

async function listAudit(env, viewer, url) {
    requireStaff(viewer);
    const entity = url.searchParams.get('entity');
    const id = url.searchParams.get('id');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200);
    const rows = await all(env.DB,
        `SELECT a.id, a.at, a.entity, a.entity_id, a.action, a.diff, c.name AS actor_name
         FROM audit_log a LEFT JOIN citizens c ON c.number = a.actor
         WHERE (?1 IS NULL OR a.entity = ?1) AND (?2 IS NULL OR a.entity_id = ?2)
         ORDER BY a.id DESC LIMIT ?3`, entity, id === null ? null : Number(id), limit);
    return {
        status: 200,
        body: { entries: rows.map(r => ({ id: r.id, at: r.at, entity: r.entity, entityId: r.entity_id, action: r.action, actor: r.actor_name, diff: JSON.parse(r.diff ?? 'null') })) }
    };
}

// ─── router ─────────────────────────────────────────────────────────────────────

const ROUTES = [
    ['POST', /^\/api\/plots$/, (e, v, b) => createPlot(e, v, b)],
    ['PATCH', /^\/api\/plots\/(\d+)$/, (e, v, b, m) => updatePlot(e, v, Number(m[1]), b)],
    ['DELETE', /^\/api\/plots\/(\d+)$/, (e, v, b, m) => deletePlot(e, v, Number(m[1]))],
    ['POST', /^\/api\/plots\/(\d+)\/transfer$/, (e, v, b, m) => transferPlot(e, v, Number(m[1]), b)],
    ['POST', /^\/api\/streets$/, (e, v, b) => createStreet(e, v, b)],
    ['PATCH', /^\/api\/streets\/(\d+)$/, (e, v, b, m) => updateStreet(e, v, Number(m[1]), b)],
    ['DELETE', /^\/api\/streets\/(\d+)$/, (e, v, b, m) => deleteStreet(e, v, Number(m[1]))],
    ['POST', /^\/api\/districts$/, (e, v, b) => createDistrict(e, v, b)],
    ['PATCH', /^\/api\/districts\/(\d+)$/, (e, v, b, m) => updateDistrict(e, v, Number(m[1]), b)],
    ['DELETE', /^\/api\/districts\/(\d+)$/, (e, v, b, m) => deleteDistrict(e, v, Number(m[1]))],
    ['GET', /^\/api\/audit$/, (e, v, b, m, url) => listAudit(e, v, url)]
];

/** Returns { status, body } for a matching edit route, or null when the path is not an edit route. */
export async function handleEdit(env, viewer, method, url, body) {
    for (const [verb, pattern, handler] of ROUTES) {
        const m = verb === method ? pattern.exec(url.pathname) : null;
        if (!m) continue;
        try {
            return await handler(env, viewer, body, m, url);
        } catch (err) {
            if (err instanceof HttpError) return { status: err.status, body: err.body };
            throw err;
        }
    }
    return null;
}
