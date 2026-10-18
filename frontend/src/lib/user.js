// A username key that is stable across case/whitespace differences. Used only
// for browser-side storage keys — the backend normalizes the token it sends to
// the engine independently.
export function userKey(username) {
    return String(username ?? '').trim().toLowerCase() || 'user';
}

export function displayName(username) {
    return String(username ?? '').trim();
}

// Mirrors backend/src/storage/vfsStore.js `normalizeUser` — the exact token that
// crosses the line-based engine protocol and therefore the name of the user's
// /home/<user> directory. Keep the two implementations in sync.
export function normalizeUser(username) {
    const folded = String(username ?? '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .replace(/^_+|_+$/g, '');
    return (folded || 'user').slice(0, 64);
}
