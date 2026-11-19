// Automated sync with GovernmentBP, driven by tools/sync-agent.mjs (SYNC_TOKEN, no user session):
//   POST /api/sync/land   game -> portal: a land export document ([gov_land_export]); replaces the land dataset
//   POST /api/sync/city   game -> portal: a city export document ([gov_city_export]); stored as a read-only snapshot
//   GET  /api/sync/export portal -> game: the current land export document (what nb:land_pull_chunk receives)
//   GET  /api/city        public: the stored city snapshot
// Unchanged documents (same hash, ignoring exportedAt) are skipped.
import { sha256Hex, timingSafeEqual } from './auth.js';
import { buildExport, importDoc } from './exchange.js';

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
    if (result.status === 200) await setMeta(env.DB, 'sync_land_hash', hash);
    return result;
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

export async function syncExport(env, request) {
    if (!(await authorized(env, request))) return DENIED;
    const result = await buildExport(env.DB, { allowUnlinked: true });
    return { status: 200, body: { doc: result.doc, warnings: result.warnings, hash: await hashDoc(result.doc) } };
}

export async function readCity(db) {
    const row = await db.prepare('SELECT received_at, doc FROM city_snapshot WHERE id = 1').first();
    if (!row) return { snapshot: null };
    return { snapshot: JSON.parse(row.doc), receivedAt: row.received_at };
}
