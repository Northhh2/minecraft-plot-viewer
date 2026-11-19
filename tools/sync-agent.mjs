// Sync agent between the Minecraft server (GovernmentBP) and the plot portal. Run it from cron; every run is one pass.
//
//   node sync-agent.mjs            push: read the server log, send the newest land/city exports if they changed
//   node sync-agent.mjs --pull     push, then also inject the portal's land data into the game if it changed there
//   node sync-agent.mjs --dry      show what would happen, send nothing
//
// Game -> portal: GovernmentBP writes [gov_land_export] / [gov_city_export] chunks to the content log (every
//   10 min, only when something changed). The agent rebuilds the newest complete export of each and POSTs it.
// Portal -> game: with --pull the portal's export is cut into `scriptevent nb:land_pull_chunk` commands and sent to
//   the server console (Crafty stdin). Applying stays a manual step in the game: nb:land_pull_check, nb:land_pull_apply.
//   Portal edits are only pulled when the game side did not change in the same pass (no silent overwrite).
//
// Config (environment variables):
//   PORTAL_URL        https://your-worker.workers.dev           (required)
//   SYNC_TOKEN        the Worker's SYNC_TOKEN                    (required)
//   LOG_FILE          path to the server log file                } one of these two
//   CRAFTY_URL, CRAFTY_TOKEN, CRAFTY_SERVER_ID                   } (reads logs, and sends commands for --pull)
//   CRAFTY_INSECURE=1 accept a self-signed Crafty certificate
//   STATE_FILE        default ./sync-agent-state.json
//   CHUNK_SIZE        default 900 (characters of data per scriptevent)
//   CHUNK_DELAY_MS    default 150
import fs from 'node:fs';
import crypto from 'node:crypto';

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

async function readLogLines() {
    if (env.LOG_FILE) return fs.readFileSync(env.LOG_FILE, 'utf8').split('\n');
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
    const LINE = /\[(gov_land_export|gov_city_export)\] (\S+) (\d+)\/(\d+) ?(.*?)\r?$/;
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

// ─── Run ─────────────────────────────────────────────────────────────────────────

let gameChanged = false;
const found = newestExports(await readLogLines());

for (const [tag, path, key] of [['gov_land_export', '/api/sync/land', 'landHash'], ['gov_city_export', '/api/sync/city', 'cityHash']]) {
    const ex = found[tag];
    if (!ex) { log(`${tag}: no complete export in the log`); continue; }
    const hash = sha(stable(ex.doc));
    if (state[key] === hash) { log(`${tag}: ${ex.id} unchanged`); continue; }
    if (dry) { log(`[dry] would POST ${tag} ${ex.id}`); continue; }
    const r = await portalCall('POST', path, { doc: ex.doc });
    log(`${tag}: ${ex.id} -> ${path}: HTTP ${r.status}`, r.ok ? '' : JSON.stringify(r.json).slice(0, 500));
    if (r.ok) { state[key] = hash; if (tag === 'gov_land_export') gameChanged = true; }
}

if (!dry && (gameChanged || state.portalHash === undefined)) {
    // The portal now mirrors the game: remember its export hash so that is not mistaken for a portal-side edit.
    const p = await portalExport();
    if (p) state.portalHash = p.hash;
}

if (pull) {
    const p = await portalExport();
    if (!p) log('pull: could not fetch the portal export');
    else if (p.hash === state.portalHash) log('pull: portal unchanged since the last sync');
    else if (gameChanged) log('pull: skipped, the game changed in the same pass (portal edits are kept for the next pass)');
    else {
        const json = JSON.stringify(p.doc).replace(/ /g, '\\u0020');
        const id = `p${Date.now().toString(36)}`;
        const total = Math.max(1, Math.ceil(json.length / chunkSize));
        log(`pull: sending ${id} in ${total} chunk(s)${dry ? ' [dry]' : ''}`);
        if (!dry) {
            for (let i = 0; i < total; i++) {
                await sendCommand(`scriptevent nb:land_pull_chunk ${id} ${i + 1}/${total} ${json.slice(i * chunkSize, (i + 1) * chunkSize)}`);
                await new Promise(r => setTimeout(r, chunkDelay));
            }
            state.portalHash = p.hash;
            log('pull: done. In the game run: /scriptevent nb:land_pull_check, then nb:land_pull_apply');
        }
    }
}

saveState();
