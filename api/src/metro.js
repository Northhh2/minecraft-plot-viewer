// Metro: public read (GET /api/metro), admin edits, and the automatic exchange with TransportationBP.
//
//   PATCH /api/metro/lines/:id          colour, speed, dwell, trains, flags, stops of an existing line (admin)
//   PATCH /api/metro/stations/:id       station name (admin)
//
// The game side runs through the sync agent (sync.js): importMetroSnapshot() takes a TransportationBP
// "metro-snapshot" document, buildUpdates() makes the "metro-updates" document the agent injects back into the game.
//
// The format and validation are in MetroExchange.ts, a verbatim copy of
// TransportationBP/src/registry/metro/MetroExchange.ts (the canonical one) — keep them identical.
// Tracks and platforms only exist in the game, so lines and stations are never created or deleted here.

import { METRO_EXCHANGE_VERSION, METRO_PALETTE, hexOfColor, parseMetroSnapshot, parseMetroUpdates } from './MetroExchange.ts';

class HttpError extends Error {
    constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}

const rows = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const json = (v, fallback) => { try { return JSON.parse(v); } catch { return fallback; } };

const stationOut = s => ({ id: s.id, name: s.name, x: s.x, y: s.y, z: s.z, platformCount: s.platform_count, platforms: json(s.platforms, []), edited: !!s.portal_edited });
const lineOut = l => ({
    id: l.id, name: l.name, color: l.color, hex: hexOfColor(l.color), speed: l.speed, dwellSeconds: l.dwell_seconds, trainCount: l.train_count,
    circular: !!l.circular, throughLoops: !!l.through_loops, shuttle: !!l.shuttle, running: !!l.running,
    stationIds: json(l.station_ids, []), segments: json(l.segments, []), edited: !!l.portal_edited
});

export async function readMetro(db) {
    const [stations, lines] = await Promise.all([rows(db, 'SELECT * FROM metro_stations ORDER BY id'), rows(db, 'SELECT * FROM metro_lines ORDER BY id')]);
    return { palette: METRO_PALETTE, stations: stations.map(stationOut), lines: lines.map(lineOut) };
}

// ─── export (portal -> game) ─────────────────────────────────────────────────────

export async function buildUpdates(db) {
    const { stations, lines } = await readMetro(db);
    return {
        schemaVersion: METRO_EXCHANGE_VERSION, kind: 'metro-updates', source: 'portal', exportedAt: new Date().toISOString(),
        stations: stations.map(s => ({ id: s.id, name: s.name })),
        lines: lines.map(l => ({
            id: l.id, color: l.color, speed: l.speed, dwellSeconds: l.dwellSeconds, trainCount: l.trainCount,
            circular: l.circular, throughLoops: l.throughLoops, shuttle: l.shuttle, stationIds: l.stationIds
        }))
    };
}

// ─── import (game -> portal) ─────────────────────────────────────────────────────

const ATTRS = ['color', 'speed', 'dwellSeconds', 'trainCount', 'circular', 'throughLoops', 'shuttle'];

/** Replaces stations and lines with the game's. With `refuseOverwrite`, portal edits the game has not applied yet
 *  are never silently lost: the import is refused (409) until the game reports them (after nb:metro_pull_apply). */
export async function importMetroSnapshot(env, viewer, doc, { dryRun, refuseOverwrite = false }) {
    const parsed = parseMetroSnapshot(doc);
    if (!parsed.ok) throw new HttpError(400, { error: 'invalid_document', errors: parsed.errors, warnings: parsed.warnings });
    const d = parsed.data;

    const current = await readMetro(env.DB);
    // Lines edited in the portal and not yet applied in the game would silently lose those edits.
    const overwritten = current.lines.filter(cur => cur.edited).flatMap(cur => {
        const inc = d.lines.find(l => l.id === cur.id);
        if (!inc) return [`${cur.name} (linia nie istnieje już w grze)`];
        const differs = ATTRS.some(k => inc[k] !== cur[k]) || JSON.stringify(inc.stationIds) !== JSON.stringify(cur.stationIds);
        return differs ? [`${cur.name} — zmiany z portalu zostaną zastąpione wersją z gry`] : [];
    });
    const renamed = current.stations.filter(cur => cur.edited && d.stations.find(s => s.id === cur.id)?.name !== cur.name).map(s => s.name);

    const summary = {
        ok: true, dryRun, warnings: parsed.warnings,
        counts: { before: { stations: current.stations.length, lines: current.lines.length }, after: { stations: d.stations.length, lines: d.lines.length } },
        overwritten: [...overwritten, ...renamed.map(n => `stacja „${n}” — zmieniona nazwa zostanie zastąpiona`)]
    };
    if (refuseOverwrite && summary.overwritten.length > 0) throw new HttpError(409, { error: 'portal_edits_pending', pending: summary.overwritten });
    if (dryRun) return { status: 200, body: summary };

    const db = env.DB;
    const stmts = [db.prepare('DELETE FROM metro_lines'), db.prepare('DELETE FROM metro_stations')];
    for (const s of d.stations) {
        stmts.push(db.prepare('INSERT INTO metro_stations (id, name, x, y, z, platform_count, platforms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(s.id, s.name, s.x, s.y, s.z, s.platforms.length, JSON.stringify(s.platforms.map(p => [p.x, p.z, p.direction]))));
    }
    for (const l of d.lines) {
        stmts.push(db.prepare(
            `INSERT INTO metro_lines (id, name, color, speed, dwell_seconds, train_count, circular, through_loops, shuttle, running, station_ids, segments)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
        ).bind(l.id, l.name, l.color, l.speed, l.dwellSeconds, l.trainCount, +l.circular, +l.throughLoops, +l.shuttle, +l.running, JSON.stringify(l.stationIds), JSON.stringify(l.segments)));
    }
    stmts.push(db.prepare(`INSERT INTO audit_log (actor, entity, entity_id, action, diff) VALUES (?1, 'metro', NULL, 'import', ?2)`)
        .bind(viewer.number, JSON.stringify({ source: d.source, exportedAt: d.exportedAt, counts: summary.counts.after, overwritten: summary.overwritten })));
    await db.batch(stmts);
    return { status: 200, body: summary };
}

// ─── edits ───────────────────────────────────────────────────────────────────────

const CONTROL = /[\u0000-\u001f]/;

async function patchLine(env, viewer, id, body) {
    const db = env.DB;
    const cur = (await readMetro(db)).lines.find(l => l.id === id);
    if (!cur) throw new HttpError(404, { error: 'not_found' });
    const stationIds = new Set((await rows(db, 'SELECT id FROM metro_stations')).map(s => s.id));

    const next = { ...Object.fromEntries([...ATTRS, 'stationIds'].map(k => [k, cur[k]])) };
    for (const k of [...ATTRS, 'stationIds']) if (body && k in body) next[k] = body[k];

    // Reuse the game's validator so the portal can never store a line the game would reject.
    const check = parseMetroUpdates({ schemaVersion: METRO_EXCHANGE_VERSION, kind: 'metro-updates', stations: [], lines: [{ id, ...next }] },
        { stationExists: sid => stationIds.has(sid), lineExists: () => true });
    if (!check.ok) throw new HttpError(400, { error: 'invalid_line', errors: check.errors });
    const u = check.data.lines[0];

    await db.batch([
        db.prepare(
            `UPDATE metro_lines SET color = ?1, speed = ?2, dwell_seconds = ?3, train_count = ?4, circular = ?5, through_loops = ?6, shuttle = ?7,
                    station_ids = ?8, portal_edited = 1 WHERE id = ?9`
        ).bind(u.color, u.speed, u.dwellSeconds, u.trainCount, +u.circular, +u.throughLoops, +u.shuttle, JSON.stringify(u.stationIds), id),
        db.prepare(`INSERT INTO audit_log (actor, entity, entity_id, action, diff) VALUES (?1, 'metro_line', ?2, 'update', ?3)`)
            .bind(viewer.number, id, JSON.stringify({ before: Object.fromEntries([...ATTRS, 'stationIds'].map(k => [k, cur[k]])), after: next }))
    ]);
    return { status: 200, body: { line: (await readMetro(db)).lines.find(l => l.id === id) } };
}

async function patchStation(env, viewer, id, body) {
    const db = env.DB;
    const cur = (await readMetro(db)).stations.find(s => s.id === id);
    if (!cur) throw new HttpError(404, { error: 'not_found' });
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length === 0 || name.length > 64 || CONTROL.test(name)) throw new HttpError(400, { error: 'invalid_field', field: 'name' });
    await db.batch([
        db.prepare('UPDATE metro_stations SET name = ?1, portal_edited = 1 WHERE id = ?2').bind(name, id),
        db.prepare(`INSERT INTO audit_log (actor, entity, entity_id, action, diff) VALUES (?1, 'metro_station', ?2, 'update', ?3)`)
            .bind(viewer.number, id, JSON.stringify({ before: { name: cur.name }, after: { name } }))
    ]);
    return { status: 200, body: { station: { ...cur, name, edited: true } } };
}

// ─── routes ──────────────────────────────────────────────────────────────────────

/** Admin routes only; the public GET /api/metro is served by index.js via readMetro(). */
export async function handleMetro(env, viewer, method, url, body) {
    const path = url.pathname;
    const route = method === 'PATCH' && /^\/api\/metro\/lines\/\d+$/.test(path) ? 'line'
        : method === 'PATCH' && /^\/api\/metro\/stations\/\d+$/.test(path) ? 'station' : null;
    if (!route) return null;

    if (!viewer) return { status: 401, body: { error: 'unauthorized' } };
    if (viewer.role !== 'admin') return { status: 403, body: { error: 'forbidden' } };

    try {
        const id = Number(path.split('/').pop());
        if (body === null || typeof body !== 'object') return { status: 400, body: { error: 'invalid_request' } };
        return route === 'line' ? await patchLine(env, viewer, id, body) : await patchStation(env, viewer, id, body);
    } catch (err) {
        if (err instanceof HttpError) return { status: err.status, body: err.body };
        throw err;
    }
}
