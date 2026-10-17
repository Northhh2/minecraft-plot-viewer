import { SCHEMA_VERSION, buildSnapshot } from './snapshot.js';
import { authenticate, login, logout, syncPins } from './auth.js';
import { handleEdit } from './edit.js';
import { handleExchange } from './exchange.js';
import { handleMetro, readMetro } from './metro.js';

// The front end lives on another origin and authenticates with a bearer token (no cookies),
// so a wildcard origin is fine: browsers never attach credentials automatically.
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const json = (body, status = 200, extra = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra }
    });

const reply = ({ status, body }) => json(body, status, { 'Cache-Control': 'no-store' });

async function readBody(request) {
    try { return await request.json(); } catch { return null; }
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

        const { pathname } = new URL(request.url);
        const route = `${request.method} ${pathname}`;
        try {
            switch (route) {
                case 'GET /api/health':
                    return json({ ok: true, schemaVersion: SCHEMA_VERSION });

                case 'GET /api/snapshot': {
                    const viewer = await authenticate(env, request);
                    return json(await buildSnapshot(env.DB, viewer), 200, {
                        // Anonymous snapshots are shareable; per-user ones must never be cached.
                        'Cache-Control': viewer ? 'private, no-store' : 'public, max-age=30',
                        'Vary': 'Authorization'
                    });
                }

                case 'GET /api/metro':
                    return json(await readMetro(env.DB), 200, { 'Cache-Control': 'public, max-age=30' });

                case 'POST /api/login':
                    return reply(await login(env, request, await readBody(request)));

                case 'GET /api/me': {
                    const viewer = await authenticate(env, request);
                    if (!viewer) return json({ error: 'unauthorized' }, 401, { 'Cache-Control': 'no-store' });
                    const { raw, ...user } = viewer;
                    return json({ user }, 200, { 'Cache-Control': 'no-store' });
                }

                case 'POST /api/logout':
                    await logout(env, request);
                    return json({ ok: true }, 200, { 'Cache-Control': 'no-store' });

                case 'POST /api/sync/pins':
                    return reply(await syncPins(env, request, await readBody(request)));

                default: {
                    if (!pathname.startsWith('/api/') || request.method === 'GET' && pathname !== '/api/audit' && pathname !== '/api/export' && pathname !== '/api/metro/export') {
                        return json({ error: 'not_found' }, 404);
                    }
                    const viewer = await authenticate(env, request);
                    const body = request.method === 'GET' || request.method === 'DELETE' ? null : await readBody(request);
                    const url = new URL(request.url);
                    const result = await handleEdit(env, viewer, request.method, url, body)
                        ?? await handleExchange(env, viewer, request.method, url, body)
                        ?? await handleMetro(env, viewer, request.method, url, body);
                    if (!result) return json({ error: 'not_found' }, 404);
                    if (result.raw !== undefined) {
                        return new Response(result.raw, {
                            status: result.status,
                            headers: { 'Content-Type': result.contentType, 'Content-Disposition': `attachment; filename="${result.filename}"`, 'Cache-Control': 'no-store', ...CORS }
                        });
                    }
                    return reply(result);
                }
            }
        } catch (err) {
            console.error(err);
            return json({ error: 'internal_error' }, 500);
        }
    }
};
