import { API_BASE } from './config.js';

// Only the opaque session token is kept client-side; the PIN is never stored.
const TOKEN_KEY = 'portalToken';

export function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage unavailable: session lasts until reload */ }
}

export const authHeaders = token => (token ? { Authorization: `Bearer ${token}` } : {});

const ERRORS = {
    invalid_credentials: 'Nieprawidłowy identyfikator lub PIN.',
    invalid_request: 'Podaj identyfikator (liczba) i PIN (same cyfry).',
    too_many_attempts: 'Zbyt wiele prób. Spróbuj ponownie za kilkanaście minut.'
};

/** Resolves to { user } on success or { error } with a message to show. */
export async function apiLogin(identityNumber, pin) {
    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identityNumber: Number(identityNumber), pin })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { error: ERRORS[body.error] ?? 'Logowanie nie powiodło się.' };
        setToken(body.token);
        return { user: body.user };
    } catch {
        return { error: 'Brak połączenia z serwerem.' };
    }
}

/** The signed-in user for the stored token, or null (and the token is dropped if it was rejected). */
export async function apiCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API_BASE}/api/me`, { headers: authHeaders(token) });
        if (res.status === 401) { setToken(null); return null; }
        if (!res.ok) return null;
        return (await res.json()).user;
    } catch {
        return null;
    }
}

export async function apiLogout() {
    const token = getToken();
    setToken(null);
    if (!token) return;
    try { await fetch(`${API_BASE}/api/logout`, { method: 'POST', headers: authHeaders(token) }); } catch { /* token expires anyway */ }
}
