// Sync agent between the Minecraft server (GovernmentBP) and the plot portal. Run it from cron; every run is one pass.
//
//   node sync-agent.mjs            push: read the server log, send the newest land/city exports if they changed
//   node sync-agent.mjs --pull     also inject the portal's metro data into the game if it changed there (land needs no flag)
//   node sync-agent.mjs --dry      show what would happen, send nothing
//
// LAND is exchanged automatically in both directions as small deltas (only changed records), see runLandDelta() below; run
// the agent from cron every minute. The old whole-dataset land push/pull is gone (set LAND_FULL=1 to bring the push back).
//
// Game -> portal: GovernmentBP and TransportationBP write [gov_land_export] / [gov_city_export] / [trn_metro_export]
//   chunks to the content log (every 10 min, only when something changed). The agent rebuilds the newest complete
//   export of each and POSTs it.
// Portal -> game: with --pull the portal's land and metro data is cut into `scriptevent nb:land_pull_chunk` /
//   `nb:metro_pull_chunk` commands and sent to the server console (Crafty stdin). Applying stays a manual step in the
//   game: nb:land_pull_check + nb:land_pull_apply, nb:metro_pull_check + nb:metro_pull_apply.
//   Portal edits are only pulled when the game side did not change in the same pass (no silent overwrite); the portal
//   also refuses a metro snapshot (409) while its metro edits are still waiting to be applied in the game.
//
// Config (environment variables):
//   PORTAL_URL        https://your-worker.workers.dev           (required)
//   SYNC_TOKEN        the Worker's SYNC_TOKEN                    (required)
//   LOG_FILE          path to the server log file; may contain * (newest match wins) } one of these two
//   CRAFTY_URL, CRAFTY_TOKEN, CRAFTY_SERVER_ID                   } (reads logs, and sends commands for --pull)
//   CRAFTY_INSECURE=1 accept a self-signed Crafty certificate
//   STATE_FILE        default ./sync-agent-state.json
//   CHUNK_SIZE        default 900 (characters of data per scriptevent)
//   CHUNK_DELAY_MS    default 150
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const dry = args.has('--dry');
const pull = args.has('--pull');
const env = process.env;

for (const k of ['PORTAL_URL', 'SYNC_TOKEN']) if (!env[k]) { console.error(`Missing ${k}`); process.exit(2); }
const portal = env.PORTAL_URL.replace(/\/$/, '');
const stateFile = env.STATE_FILE ?? './sync-agent-state.json';
const chunkSize = Number(env.CHUNK_SIZE ?? 900);
const chunkDelay = Number(env.CHUNK_DELAY_MS ?? 150);
if (env.CRAFTY_INSECURE === '1') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const stable = doc => JSON.stringify({ ...doc, exportedAt: undefined });

const state = (() => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } })();
const saveState = () => { if (!dry) fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)); };

// ─── Crafty ──────────────────────────────────────────────────────────────────────

function crafty() {
    if (!env.CRAFTY_URL || !env.CRAFTY_TOKEN || !env.CRAFTY_SERVER_ID) throw new Error('CRAFTY_URL, CRAFTY_TOKEN and CRAFTY_SERVER_ID are required');
    return { base: `${env.CRAFTY_URL.replace(/\/$/, '')}/api/v2/servers/${env.CRAFTY_SERVER_ID}`, headers: { Authorization: `Bearer ${env.CRAFTY_TOKEN}` } };
}

/** LOG_FILE may contain `*` in its file name (e.g. /srv/bds/ContentLog_*): the newest matching file is used,
 *  because Bedrock starts a new content log file on every server start. Only the last LOG_TAIL_BYTES are read. */
function resolveLogFile(spec) {
    if (!spec.includes('*')) return spec;
    const dir = path.dirname(spec);
    const re = new RegExp(`^${path.basename(spec).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    const files = fs.readdirSync(dir).filter(f => re.test(f)).map(f => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }));
    if (files.length === 0) throw new Error(`LOG_FILE: nothing matches ${spec}`);
    return files.sort((a, b) => b.t - a.t)[0].f;
}

function readTail(file) {
    const limit = Number(env.LOG_TAIL_BYTES ?? 30 * 1024 * 1024);
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    try {
        const start = Math.max(0, size - limit);
        const buf = Buffer.alloc(size - start);
        fs.readSync(fd, buf, 0, buf.length, start);
        const lines = buf.toString('utf8').split('\n');
        return start > 0 ? lines.slice(1) : lines; // the first line of a tail may be cut in half
    } finally { fs.closeSync(fd); }
}

async function readLogLines() {
    if (env.LOG_FILE) { const file = resolveLogFile(env.LOG_FILE); log(`log file: ${file}`); return readTail(file); }
    const { base, headers } = crafty();
    const res = await fetch(`${base}/logs?file=false&colors=false&raw=true&html=false`, { headers });
    if (!res.ok) throw new Error(`Crafty logs: HTTP ${res.status}`);
    const data = (await res.json()).data ?? [];
    return (Array.isArray(data) ? data : String(data).split('\n')).map(String);
}

async function sendCommand(command) {
    const { base, headers } = crafty();
    const res = await fetch(`${base}/stdin`, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: command });
    if (!res.ok) throw new Error(`Crafty stdin: HTTP ${res.status}`);
}

// ─── Log -> export documents ─────────────────────────────────────────────────────

/** Newest complete export per tag. Lines look like: [...] [gov_land_export] <id> <i>/<n> <chunk> */
function newestExports(lines) {
    const LINE = /\[(gov_land_export|gov_city_export|trn_metro_export)\] (\S+) (\d+)\/(\d+) ?(.*?)\r?$/;
    const sets = new Map();
    lines.forEach((line, no) => {
        const m = LINE.exec(line);
        if (!m) return;
        const [, tag, id, i, n, chunk] = m;
        const key = `${tag}|${id}`;
        if (!sets.has(key)) sets.set(key, { tag, id, total: Number(n), parts: new Map(), lastLine: 0 });
        const s = sets.get(key);
        s.parts.set(Number(i), chunk);
        s.lastLine = no;
    });
    const best = {};
    for (const s of sets.values()) {
        if (s.parts.size !== s.total) continue;
        if (!best[s.tag] || s.lastLine > best[s.tag].lastLine) best[s.tag] = s;
    }
    const out = {};
    for (const [tag, s] of Object.entries(best)) {
        let json = '';
        for (let i = 1; i <= s.total; i++) json += s.parts.get(i);
        try { out[tag] = { id: s.id, doc: JSON.parse(json) }; } catch (err) { log(`${tag} ${s.id}: invalid JSON (${err.message})`); }
    }
    return out;
}

// ─── Portal ──────────────────────────────────────────────────────────────────────

async function portalCall(method, path, body) {
    const res = await fetch(`${portal}${path}`, {
        method, headers: { Authorization: `Bearer ${env.SYNC_TOKEN}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { ok: res.ok, status: res.status, json };
}

async function portalExport() {
    const r = await portalCall('GET', '/api/sync/export');
    return r.ok ? { hash: r.json.hash, doc: r.json.doc } : null;
}

async function portalMetroExport() {
    const r = await portalCall('GET', '/api/sync/metro-export');
    return r.ok ? { hash: r.json.hash, doc: r.json.doc } : null;
}

// ─── Run ─────────────────────────────────────────────────────────────────────────

const gameChanged = { land: false, metro: false };
const allLines = await readLogLines();
const found = newestExports(allLines);

const PUSHES = [
    ...(env.LAND_FULL === '1' ? [{ tag: 'gov_land_export', path: '/api/sync/land', key: 'landHash', changed: 'land' }] : []),
    { tag: 'gov_city_export', path: '/api/sync/city', key: 'cityHash' },
    { tag: 'trn_metro_export', path: '/api/sync/metro', key: 'metroHash', changed: 'metro' }
];

for (const { tag, path: apiPath, key, changed } of PUSHES) {
    const ex = found[tag];
    if (!ex) { log(`${tag}: no complete export in the log`); continue; }
    const hash = sha(stable(ex.doc));
    if (state[key] === hash) { log(`${tag}: ${ex.id} unchanged`); continue; }
    if (dry) { log(`[dry] would POST ${tag} ${ex.id}`); continue; }
    const r = await portalCall('POST', apiPath, { doc: ex.doc });
    if (r.status === 409 && r.json?.error === 'portal_edits_pending') {
        log(`${tag}: ${ex.id} held back, portal edits are not applied in the game yet: ${(r.json.pending ?? []).slice(0, 5).join('; ')}`);
        continue;
    }
    log(`${tag}: ${ex.id} -> ${apiPath}: HTTP ${r.status}`, r.ok ? '' : JSON.stringify(r.json).slice(0, 500));
    if (r.ok) { state[key] = hash; if (changed) gameChanged[changed] = true; }
}


// ─── Land: delta exchange (both directions, automatic) ──────────────────────────

/** Every complete chunked group of one tag in the log: [{ id, doc }] in log order. Lines: `[tag] <id> <i>/<n> <chunk>`. */
function completeGroups(lines, tag) {
    const LINE = new RegExp(`\[${tag}\] (\S+) (\d+)/(\d+) ?(.*?)\r?$`);
    const groups = new Map();
    lines.forEach((line, no) => {
        const m = LINE.exec(line);
        if (!m) return;
        const [, id, i, n, chunk] = m;
        if (!groups.has(id)) groups.set(id, { id, total: Number(n), parts: new Map(), lastLine: 0 });
        const g = groups.get(id);
        g.parts.set(Number(i), chunk);
        g.lastLine = no;
    });
    const out = [];
    for (const g of [...groups.values()].sort((a, b) => a.lastLine - b.lastLine)) {
        if (g.parts.size !== g.total) continue;
        let json = '';
        for (let i = 1; i <= g.total; i++) json += g.parts.get(i);
        try { out.push({ id: g.id, doc: JSON.parse(json) }); } catch { log(`${tag} ${g.id}: invalid JSON`); }
    }
    return out;
}

const remember = (list, id) => { list.push(id); if (list.length > 200) list.splice(0, list.length - 200); };

async function runLandDelta(lines) {
    state.deltaDone ??= [];
    state.resultDone ??= [];

    // 1. Game -> portal: deltas the game logged. Each is acknowledged to the game once the portal has stored it.
    for (const g of completeGroups(lines, 'gov_land_delta')) {
        if (state.deltaDone.includes(g.id)) continue;
        if (dry) { log(`[dry] would POST game delta ${g.id}`); continue; }
        const r = await portalCall('POST', '/api/sync/land-delta', g.doc);
        log(`land delta ${g.id} (game -> portal): HTTP ${r.status}`, r.ok ? '' : JSON.stringify(r.json).slice(0, 300));
        if (!r.ok) continue;
        try { await sendCommand(`scriptevent nb:land_delta_ack ${g.id}`); remember(state.deltaDone, g.id); }
        catch (err) { log(`land delta ${g.id}: ack not sent (${err.message}); it will be retried`); }
    }

    // 2. The game's answers to portal deltas (assigned ids, rejected records, normalised records).
    for (const g of completeGroups(lines, 'gov_land_result')) {
        if (state.resultDone.includes(g.id)) continue;
        if (dry) { log(`[dry] would POST land result ${g.id}`); continue; }
        const r = await portalCall('POST', '/api/sync/land-result', g.doc);
        log(`land result ${g.id}: HTTP ${r.status}`, r.ok ? `rejected ${g.doc.rejected?.length ?? 0}` : JSON.stringify(r.json).slice(0, 300));
        if (r.ok) remember(state.resultDone, g.id);
    }

    // 3. Portal -> game: whatever changed in the portal since the last confirmed sync. The same outbox is offered until the
    //    game's result arrives; it is re-sent only if no result showed up for a few minutes (the game ignores a repeated id).
    const out = await portalCall('GET', '/api/sync/land-delta');
    if (!out.ok) { log(`land delta (portal -> game): HTTP ${out.status}`); return; }
    const { id, delta } = out.json;
    if (!id) return;
    const last = state.outbox;
    if (last?.id === id && Date.now() - last.at < 4 * 60_000) return;
    const json = JSON.stringify(delta).replace(/ /g, '\u0020');
    const total = Math.max(1, Math.ceil(json.length / chunkSize));
    log(`land delta ${id} (portal -> game): ${total} chunk(s)${dry ? ' [dry]' : ''}`);
    if (dry) return;
    for (let i = 0; i < total; i++) {
        await sendCommand(`scriptevent nb:land_delta_chunk ${id} ${i + 1}/${total} ${json.slice(i * chunkSize, (i + 1) * chunkSize)}`);
        await new Promise(r => setTimeout(r, chunkDelay));
    }
    state.outbox = { id, at: Date.now() };
}

if (env.LAND_DELTA !== '0') await runLandDelta(allLines);

if (env.LAND_FULL === '1' && !dry && (gameChanged.land || state.portalHash === undefined)) {
    // The portal now mirrors the game: remember its export hash so that is not mistaken for a portal-side edit.
    const p = await portalExport();
    if (p) state.portalHash = p.hash;
}
if (!dry && (gameChanged.metro || state.metroPortalHash === undefined)) {
    const p = await portalMetroExport();
    if (p) state.metroPortalHash = p.hash;
}

/** Cuts a portal document into scriptevent chunks and sends them to the game console. */
async function sendToGame({ label, event, doc, hash, hashKey }) {
    const json = JSON.stringify(doc).replace(/ /g, '\\u0020');
    const id = `p${Date.now().toString(36)}`;
    const total = Math.max(1, Math.ceil(json.length / chunkSize));
    log(`pull ${label}: sending ${id} in ${total} chunk(s)${dry ? ' [dry]' : ''}`);
    if (dry) return;
    for (let i = 0; i < total; i++) {
        await sendCommand(`scriptevent ${event} ${id} ${i + 1}/${total} ${json.slice(i * chunkSize, (i + 1) * chunkSize)}`);
        await new Promise(r => setTimeout(r, chunkDelay));
    }
    state[hashKey] = hash;
}

if (pull) {
    const metro = await portalMetroExport();
    if (!metro) log('pull metro: could not fetch the portal export');
    else if (metro.hash === state.metroPortalHash) log('pull metro: portal unchanged since the last sync');
    else if (gameChanged.metro) log('pull metro: skipped, the game changed in the same pass (portal edits are kept for the next pass)');
    else {
        await sendToGame({ label: 'metro', event: 'nb:metro_pull_chunk', doc: metro.doc, hash: metro.hash, hashKey: 'metroPortalHash' });
        if (!dry) log('pull metro: done. In the game run: /scriptevent nb:metro_pull_check, then nb:metro_pull_apply');
    }
}

saveState();
