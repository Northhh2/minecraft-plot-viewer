// Local development server: serves the portal and runs the Worker (api/src) against a SQLite
// database (node:sqlite, Node 22+) through a small D1-compatible shim. No Cloudflare account needed.
//
//   node dev-server.mjs [port]            in-memory database, re-seeded from api/seed.sql on each start
//   DB_FILE=dev.sqlite node dev-server.mjs  keep edits between restarts
//
// A dev admin is created: identifier 1, PIN 12345678.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'api');
const port = Number(process.argv[2] ?? 8787);

const worker = (await import(pathToFileURL(path.join(apiDir, 'src', 'index.js')).href)).default;
const { packHash, pepper } = await import(pathToFileURL(path.join(apiDir, 'src', 'auth.js')).href);

const seedFile = path.join(apiDir, 'seed.sql');
if (!fs.existsSync(seedFile)) {
    console.error('api/seed.sql not found. Run: cd tools && npm install && node import-sheet.mjs');
    process.exit(1);
}

const dbFile = process.env.DB_FILE ?? ':memory:';
const fresh = dbFile === ':memory:' || !fs.existsSync(dbFile);
const sqlite = new DatabaseSync(dbFile);
sqlite.exec('PRAGMA foreign_keys = ON');
sqlite.exec(fs.readFileSync(path.join(apiDir, 'schema.sql'), 'utf8'));

const env = {
    PEPPER: 'dev-pepper', SYNC_TOKEN: 'dev-sync',
    DB: createD1(sqlite)
};

if (fresh) {
    sqlite.exec(fs.readFileSync(seedFile, 'utf8'));
    const salt = '00112233445566778899aabbccddeeff';
    sqlite.prepare(
        `INSERT INTO citizens (number, identity_number, name, role, pin_salt, pin_hash) VALUES (900, 1, 'Dev Admin', 'admin', ?, ?)`
    ).run(salt, await pepper(env, await packHash(salt, 1, '12345678')));
}

/** Minimal D1 surface used by the Worker: prepare().bind().first()/all()/run() and batch() (atomic). */
function createD1(db) {
    const stmt = (sql, args = []) => ({
        bind: (...a) => stmt(sql, a),
        first: async () => db.prepare(sql).get(...args) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...args) }),
        run: async () => {
            const r = db.prepare(sql).run(...args);
            return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        }
    });
    return {
        prepare: sql => stmt(sql),
        batch: async list => {
            db.exec('BEGIN');
            try {
                const out = [];
                for (const s of list) out.push(await s.run());
                db.exec('COMMIT');
                return out;
            } catch (err) {
                db.exec('ROLLBACK');
                throw err;
            }
        }
    };
}

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
    '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml'
};

async function handleApi(req, res) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const response = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
}

function handleStatic(req, res) {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel === '/') rel = '/plot_viewer.html';
    const file = path.resolve(root, '.' + rel);
    const inside = file === root || file.startsWith(root + path.sep);
    const hidden = /(^|[\\/])(\.|node_modules|api|tools)([\\/]|$)/.test(path.relative(root, file));
    if (!inside || hidden || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }

    let data = fs.readFileSync(file);
    if (path.basename(file) === 'plot_viewer.html') {
        // Point the front end at this server's API.
        data = Buffer.from(data.toString('utf8').replace('<script type="module"', '<script>window.PLOT_API_BASE = location.origin;</script>\n    <script type="module"'));
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
}

http.createServer((req, res) => {
    (req.url.startsWith('/api/') ? handleApi(req, res) : Promise.resolve(handleStatic(req, res)))
        .catch(err => { console.error(err); if (!res.headersSent) res.writeHead(500); res.end('Internal error'); });
}).listen(port, () => {
    console.log(`Portal: http://localhost:${port}/   (dev login: identifier 1, PIN 12345678)`);
    console.log(`Database: ${dbFile === ':memory:' ? 'in memory (reset on restart)' : dbFile}`);
});
