// Automated sync with GovernmentBP, driven by tools/sync-agent.mjs (SYNC_TOKEN, no user session):
//   POST /api/sync/land   game -> portal: a land export document ([gov_land_export]); replaces the land dataset
//   POST /api/sync/city   game -> portal: a city export document ([gov_city_export]); stored as a read-only snapshot
//   POST /api/sync/metro  game -> portal: a metro snapshot ([trn_metro_export]); refused (409) while portal edits are pending
//   GET/POST /api/sync/land-delta, POST /api/sync/land-result   the automatic delta exchange (see delta.js); the routes above for land are the manual full ones
//   GET  /api/sync/export portal -> game: the current land export document (what nb:land_pull_chunk receives)
//   GET  /api/sync/metro-export  portal -> game: the metro updates document (what nb:metro_pull_chunk receives)
//   POST /api/sync/network  game -> portal: Magenta network coverage ([net_coverage_export]); GET /api/network is the public read
//   GET  /api/city        public: the stored city snapshot
// Unchanged documents (same hash, ignoring exportedAt) are skipped.
import { sha256Hex, timingSafeEqual } from './auth.js';
import { buildExport, importDoc } from './exchange.js';
import { buildOutbox, receiveGameDelta, receiveResult, resetDelta } from './delta.js';
import { buildUpdates, importMetroSnapshot } from './metro.js';

async function authorized(env, request) {
    const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    return !!env.SYNC_TOKEN && timingSafeEqual(await sha256Hex(given), await sha256Hex(env.SYNC_TOKEN));
}

const DENIED = { status: 401, body: { error: 'unauthorized' } };

async function hashDoc(doc) {
    return sha256Hex(JSON.stringify({ ...doc, exportedAt: undefined }));
}

async function getMeta(db, key) {
    return (await db.prepare('SELECT value FROM meta WHERE key = ?1').bind(key).first())?.value ?? null;
}
const setMeta = (db, key, value) =>
    db.prepare('INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();

export async function syncLand(env, request, body) {
    if (!(await authorized(env, request))) return DENIED;
    const doc = body?.doc ?? body;
    if (doc === null || typeof doc !== 'object') return { status: 400, body: { error: 'invalid_request' } };

    const hash = await hashDoc(doc);
    if (await getMeta(env.DB, 'sync_land_hash') === hash) return { status: 200, body: { ok: true, unchanged: true } };

    // viewer.number is only used for the audit log; null marks the sync agent.
    const result = await importDoc(env, { number: null, role: 'admin' }, doc, { dryRun: false })
        .catch(err => err?.status ? { status: err.status, body: err.body } : Promise.reject(err));
    if (result.status === 200) {
        await setMeta(env.DB, 'sync_land_hash', hash);
        await resetDelta(env.DB);   // a full import replaces everything: the delta exchange starts over with the next game delta
    }
    return result;
}

/** GET: the portal's changes for the game. */
export async function syncLandDeltaOut(env, request) {
    if (!(await authorized(env, request))) return DENIED;
    return { status: 200, body: await buildOutbox(env.DB) };
}

/** POST: the game's changes for the portal. */
export async function syncLandDeltaIn(env, request, body) {
    if (!(await authorized(env, request))) return DENIED;
    return receiveGameDelta(env.DB, body);
}

/** POST: the game's answer to a delta from syncLandDeltaOut. */
export async function syncLandResult(env, request, body) {
    if (!(await authorized(env, request))) return DENIED;
    return receiveResult(env.DB, body);
}

export async function syncCity(env, request, body) {
    if (!(await authorized(env, request))) return DENIED;
    const doc = body?.doc ?? body;
    if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.citizens) || !Array.isArray(doc.companies)) {
        return { status: 400, body: { error: 'invalid_document' } };
    }
    const hash = await hashDoc(doc);
    const current = await env.DB.prepare('SELECT hash FROM city_snapshot WHERE id = 1').first();
    if (current?.hash === hash) return { status: 200, body: { ok: true, unchanged: true } };

    await env.DB.prepare(`INSERT INTO city_snapshot (id, hash, doc, received_at) VALUES (1, ?1, ?2, datetime('now'))
                          ON CONFLICT(id) DO UPDATE SET hash = excluded.hash, doc = excluded.doc, received_at = excluded.received_at`)
        .bind(hash, JSON.stringify(doc)).run();
    return { status: 200, body: { ok: true, citizens: doc.citizens.length, companies: doc.companies.length } };
}

export async function syncMetro(env, request, body) {
    if (!(await authorized(env, request))) return DENIED;
    const doc = body?.doc ?? body;
    if (doc === null || typeof doc !== 'object') return { status: 400, body: { error: 'invalid_request' } };

    const hash = await hashDoc(doc);
    if (await getMeta(env.DB, 'sync_metro_hash') === hash) return { status: 200, body: { ok: true, unchanged: true } };

    const result = await importMetroSnapshot(env, { number: null, role: 'admin' }, doc, { dryRun: false, refuseOverwrite: true })
        .catch(err => err?.status ? { status: err.status, body: err.body } : Promise.reject(err));
    if (result.status === 200) await setMeta(env.DB, 'sync_metro_hash', hash);
    return result;
}

/** Game -> portal: the Magenta network coverage ([net_coverage_export], NetworkingBP). Kept as one JSON document in `meta`. */
export async function syncNetwork(env, request, body) {
    if (!(await authorized(env, request))) return DENIED;
    const doc = body?.doc ?? body;
    if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.towers)) return { status: 400, body: { error: 'invalid_document' } };

    const num = v => (Number.isFinite(v) ? Math.round(v) : null);
    const clean = {
        operator: String(doc.operator ?? 'Magenta').slice(0, 40),
        rangeMin: num(doc.rangeMin) ?? 60,
        rangeMax: num(doc.rangeMax) ?? 100,
        towers: doc.towers.slice(0, 2000)
            .map(t => ({ x: num(t?.x), z: num(t?.z), type: t?.type === 'antenna' ? 'antenna' : 'tower', active: t?.active === true }))
            .filter(t => t.x !== null && t.z !== null)
    };
    const json = JSON.stringify(clean);
    if (await getMeta(env.DB, 'network_coverage') === json) return { status: 200, body: { ok: true, unchanged: true } };
    await setMeta(env.DB, 'network_coverage', json);
    return { status: 200, body: { ok: true, towers: clean.towers.length } };
}

/** Public: the stored coverage (no towers until the game has exported once). */
export async function readNetwork(db) {
    try { return JSON.parse(await getMeta(db, 'network_coverage')) ?? { towers: [] }; } catch { return { towers: [] }; }
}

export async function syncMetroExport(env, request) {
    if (!(await authorized(env, request))) return DENIED;
    const doc = await buildUpdates(env.DB);
    return { status: 200, body: { doc, hash: await hashDoc(doc) } };
}

export async function syncExport(env, request) {
    if (!(await authorized(env, request))) return DENIED;
    const result = await buildExport(env.DB, { allowUnlinked: true });
    return { status: 200, body: { doc: result.doc, warnings: result.warnings, hash: await hashDoc(result.doc) } };
}

/** The stored snapshot. The public view never contains allowance data (config, history or per-citizen amounts). */
async function readCitySnapshot(db) {
    const row = await db.prepare('SELECT received_at, doc FROM city_snapshot WHERE id = 1').first();
    return row ? { doc: JSON.parse(row.doc), receivedAt: row.received_at } : null;
}

export async function readCity(db) {
    const row = await readCitySnapshot(db);
    if (!row) return { snapshot: null };
    const { allowance, ...doc } = row.doc;
    doc.citizens = (doc.citizens ?? []).map(({ allowance: _a, ...c }) => c);
    // City variables are public, except the allowance parameters (like the rest of the allowance config).
    if (doc.variables) {
        const open = d => d.group !== 'allowance';
        const keys = new Set((doc.variables.definitions ?? []).filter(open).map(d => d.key));
        doc.variables = {
            definitions: (doc.variables.definitions ?? []).filter(open),
            scheduled: (doc.variables.scheduled ?? []).filter(s => keys.has(s.key)),
            history: (doc.variables.history ?? []).filter(h => keys.has(h.key))
        };
    }
    if (doc.council?.motions) {
        doc.council.motions = doc.council.motions.map(m => m.variableVote?.key?.startsWith('allowance.')
            ? { ...m, variableVote: null, title: 'Głosowanie nad parametrem dodatku', description: '' } : m);
    }
    return { snapshot: doc, receivedAt: row.receivedAt };
}

/** What the signed-in citizen really earns per day per source (never the parameter values). */
export async function readMyAllowance(db, viewer) {
    const row = await readCitySnapshot(db);
    const c = row?.doc.citizens?.find(x => x.identityNumber === viewer.identityNumber);
    if (!c?.allowance) return { allowance: null };
    const { earnings, daily, balance, paidTotal, functions } = c.allowance;
    return { allowance: { earnings, daily, balance, paidTotal, functions }, receivedAt: row.receivedAt };
}
