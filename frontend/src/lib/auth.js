// Password derivation for the local-first account store.
//
// ── Honest security note ─────────────────────────────────────────────────────
// This is a client-side simulator: there is no server-side authentication and no
// trusted authority. Credentials are stored only in this browser, so anyone with
// access to the browser profile / devtools can read or modify them. We still do
// the right things locally — a unique random salt per account and a slow,
// memory-hard-ish PBKDF2-SHA256 derivation (210k iterations) with a
// constant-time comparison — so a raw password is never stored and identical
// passwords never share a hash. That raises the bar for casual inspection, but
// it does NOT make this a secure login. Do not reuse a real password here.
// ─────────────────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_HASH = 'SHA-256';
const DERIVED_BITS = 256;

function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function subtleCrypto() {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('Web Crypto is unavailable. Open the app over http://localhost or https:// to enable secure password hashing.');
    }
    return crypto.subtle;
}

async function derive(password, salt, iterations) {
    const subtle = subtleCrypto();
    const keyMaterial = await subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
        keyMaterial,
        DERIVED_BITS
    );
    return new Uint8Array(bits);
}

function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

// Returns verifier material (never the password itself).
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, iterations);
    return {
        salt: bytesToBase64(salt),
        hash: bytesToBase64(hash),
        iterations,
        algorithm: `PBKDF2-${PBKDF2_HASH}`,
        createdAt: new Date().toISOString()
    };
}

export async function verifyPassword(password, record) {
    if (!record?.salt || !record?.hash) return false;
    const salt = base64ToBytes(record.salt);
    const expected = base64ToBytes(record.hash);
    const actual = await derive(password, salt, record.iterations || PBKDF2_ITERATIONS);
    return constantTimeEqual(actual, expected);
}
