// PIN login + bearer sessions.
//
// PIN hash spec (must match GovernmentBP src/framework/PinHash.ts):
//   h = SHA256(utf8(`${salt}:${identityNumber}:${pin}`))
//   repeat PIN_ROUNDS-1 times: h = SHA256(h || utf8(salt))
//   packHash = hex(h)
// The pack never sees the Worker's pepper. On ingest the Worker stores
// HMAC-SHA256(PEPPER, packHash), so a leaked D1 dump alone cannot be brute-forced.

export const PIN_ROUNDS = 2048;
const SESSION_DAYS = 7;
const MAX_FAILS_PER_IDENTITY = 5;
const MAX_FAILS_PER_IP = 20;
const WINDOW_MINUTES = 15;

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text) {
    return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function packHash(salt, identityNumber, pin) {
    const saltBytes = enc.encode(salt);
    let h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${identityNumber}:${pin}`)));
    const buf = new Uint8Array(32 + saltBytes.length);
    buf.set(saltBytes, 32);
    for (let i = 1; i < PIN_ROUNDS; i++) {
        buf.set(h, 0);
        h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    }
    return hex(h);
}

export async function pepper(env, hashHex) {
    const key = await crypto.subtle.importKey('raw', enc.encode(env.PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(await crypto.subtle.sign('HMAC', key, enc.encode(hashHex)));
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

async function recentFails(db, key) {
    const row = await db.prepare(
        `SELECT COUNT(*) AS n FROM login_attempts WHERE key = ?1 AND at > datetime('now', ?2)`
    ).bind(key, `-${WINDOW_MINUTES} minutes`).first();
    return row?.n ?? 0;
}

const publicUser = c => ({
    number: c.number, identityNumber: c.identity_number, name: c.name, role: c.role,
    nio: c.nio, photoUrl: c.photo_url
});

export async function login(env, request, body) {
    const identityNumber = Number(body?.identityNumber);
    const pin = String(body?.pin ?? '').trim();
    if (!Number.isInteger(identityNumber) || identityNumber <= 0 || !/^\d{4,12}$/.test(pin)) {
        return { status: 400, body: { error: 'invalid_request' } };
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const idKey = `id:${identityNumber}`, ipKey = `ip:${ip}`;
    if (await recentFails(env.DB, idKey) >= MAX_FAILS_PER_IDENTITY || await recentFails(env.DB, ipKey) >= MAX_FAILS_PER_IP) {
        return { status: 429, body: { error: 'too_many_attempts' } };
    }

    const citizen = await env.DB.prepare('SELECT * FROM citizens WHERE identity_number = ?1').bind(identityNumber).first();
    // Always do the hashing work so unknown identities are not distinguishable by timing.
    const salt = citizen?.pin_salt ?? 'x'.repeat(32);
    const candidate = await pepper(env, await packHash(salt, identityNumber, pin));
    const ok = !!citizen?.pin_hash && timingSafeEqual(candidate, citizen.pin_hash);

    if (!ok) {
        await env.DB.batch([
            env.DB.prepare('INSERT INTO login_attempts (key) VALUES (?1)').bind(idKey),
            env.DB.prepare('INSERT INTO login_attempts (key) VALUES (?1)').bind(ipKey),
            env.DB.prepare(`DELETE FROM login_attempts WHERE at < datetime('now', '-1 day')`)
        ]);
        return { status: 401, body: { error: 'invalid_credentials' } };
    }

    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.batch([
        env.DB.prepare('INSERT INTO sessions (token_hash, citizen_number, expires_at) VALUES (?1, ?2, datetime(\'now\', ?3))')
            .bind(await sha256Hex(token), citizen.number, `+${SESSION_DAYS} days`),
        env.DB.prepare('DELETE FROM login_attempts WHERE key = ?1').bind(idKey),
        env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`)
    ]);
    return { status: 200, body: { token, user: publicUser(citizen) } };
}

/** Resolves `Authorization: Bearer <token>` to the citizen row, or null. */
export async function authenticate(env, request) {
    const header = request.headers.get('Authorization') ?? '';
    const match = /^Bearer ([0-9a-f]{64})$/.exec(header);
    if (!match) return null;
    const row = await env.DB.prepare(
        `SELECT c.* FROM sessions s JOIN citizens c ON c.number = s.citizen_number
         WHERE s.token_hash = ?1 AND s.expires_at > datetime('now')`
    ).bind(await sha256Hex(match[1])).first();
    return row ? { ...publicUser(row), raw: row } : null;
}

export async function logout(env, request) {
    const match = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('Authorization') ?? '');
    if (match) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(match[1])).run();
}

/**
 * Machine-to-machine ingest of PIN records exported from GovernmentBP.
 * Protected by the SYNC_TOKEN secret. Records are matched to citizens by identity number, or, for
 * citizens not linked yet, by case-insensitive name (and then linked). Unmatched records are reported.
 */
export async function syncPins(env, request, body) {
    const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    if (!env.SYNC_TOKEN || !timingSafeEqual(await sha256Hex(given), await sha256Hex(env.SYNC_TOKEN))) {
        return { status: 401, body: { error: 'unauthorized' } };
    }
    const records = Array.isArray(body?.records) ? body.records : null;
    if (!records) return { status: 400, body: { error: 'invalid_request' } };

    const result = { updated: 0, linked: 0, unmatched: [] };
    for (const r of records) {
        const identityNumber = Number(r?.identityNumber);
        if (!Number.isInteger(identityNumber) || !/^[0-9a-f]{16,64}$/.test(r?.salt ?? '') || !/^[0-9a-f]{64}$/.test(r?.hash ?? '')) {
            result.unmatched.push({ identityNumber: r?.identityNumber ?? null, reason: 'malformed' });
            continue;
        }
        let citizen = await env.DB.prepare('SELECT number FROM citizens WHERE identity_number = ?1').bind(identityNumber).first();
        if (!citizen && typeof r.name === 'string') {
            citizen = await env.DB.prepare(
                'SELECT number FROM citizens WHERE identity_number IS NULL AND lower(name) = lower(?1)'
            ).bind(r.name).first();
            if (citizen) {
                await env.DB.prepare('UPDATE citizens SET identity_number = ?1 WHERE number = ?2').bind(identityNumber, citizen.number).run();
                result.linked++;
            }
        }
        if (!citizen) { result.unmatched.push({ identityNumber, name: r.name ?? null, reason: 'no_citizen' }); continue; }
        await env.DB.prepare('UPDATE citizens SET pin_salt = ?1, pin_hash = ?2 WHERE number = ?3')
            .bind(r.salt, await pepper(env, r.hash), citizen.number).run();
        result.updated++;
    }
    return { status: 200, body: result };
}
