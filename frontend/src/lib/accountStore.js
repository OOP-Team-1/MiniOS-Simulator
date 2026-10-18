import { idbGet, idbGetAll, idbPut } from './idb';
import { hashPassword, verifyPassword } from './auth';
import { userKey } from './user';

// Local account directory backed by IndexedDB (see idb.js). A tiny localStorage
// index keeps the login screen's "known users" list instant without opening the
// database, and survives when IndexedDB is unavailable.

const USER_INDEX_KEY = 'minios.users';

export function listKnownUsers() {
    try {
        const raw = localStorage.getItem(USER_INDEX_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function rememberUser(display) {
    const name = String(display ?? '').trim();
    if (!name) return;
    const existing = listKnownUsers();
    if (existing.some((u) => userKey(u) === userKey(name))) return;
    try {
        localStorage.setItem(USER_INDEX_KEY, JSON.stringify([...existing, name]));
    } catch {
        /* ignore */
    }
}

export async function accountExists(username) {
    const record = await idbGet('accounts', userKey(username));
    return Boolean(record);
}

export async function getAllAccounts() {
    return idbGetAll('accounts');
}

// Creates a brand-new local account. Throws with a user-friendly message if the
// username is taken or the input is invalid.
export async function registerAccount(username, password) {
    const display = String(username ?? '').trim();
    if (!display) throw new Error('Enter a username.');
    if (display.length > 32) throw new Error('Usernames are limited to 32 characters.');
    if (!password || password.length < 6) throw new Error('Passwords must be at least 6 characters.');

    const id = userKey(display);
    if (await idbGet('accounts', id)) {
        throw new Error('That username already exists on this device. Try logging in instead.');
    }

    const verifier = await hashPassword(password);
    await idbPut('accounts', { id, username: display, ...verifier });
    rememberUser(display);
    return display;
}

// Verifies a login. Returns the stored display name on success, or null.
export async function loginAccount(username, password) {
    const id = userKey(username);
    const record = await idbGet('accounts', id);
    if (!record) return null;
    const ok = await verifyPassword(password, record);
    if (!ok) return null;
    rememberUser(record.username || username);
    return record.username || String(username).trim();
}
