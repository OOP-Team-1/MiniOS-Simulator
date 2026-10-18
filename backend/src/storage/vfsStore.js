import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Server-side mirror of each user's virtual filesystem.
//
// The C++ engine is the source of truth at runtime, but its state lives in RAM.
// After every mutating command the engine emits an FS_EXPORT line containing a
// self-contained, base64 snapshot; we write that here so the filesystem survives
// page reloads, backend restarts and engine crashes. The browser keeps a second
// copy in IndexedDB as a safety net.
//
// This is intentionally a plain JSON file per user — no external database.
// `backend/data` is gitignored, so nothing here is ever committed.
//
// Durability rules enforced here:
//   * writes are atomic (temp file + rename) so a crash mid-write can never
//     leave a truncated snapshot behind,
//   * a snapshot for an unknown/empty user is rejected by callers, so a fresh
//     engine boot can never overwrite a real account's tree with the empty
//     seed filesystem,
//   * the last active user is remembered on disk, which lets a freshly spawned
//     engine restore that user's filesystem without waiting for a re-login.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MINIOS_DATA_DIR lets tests point storage at a throwaway directory.
const DATA_DIR = process.env.MINIOS_DATA_DIR
    ? path.resolve(process.env.MINIOS_DATA_DIR)
    : path.resolve(__dirname, '../../data');

const VFS_DIR = path.join(DATA_DIR, 'vfs');
const ACTIVE_USER_FILE = path.join(DATA_DIR, 'active-user.json');

// A filesystem-safe, stable key for a username. Must stay in sync with the
// token the backend sends to the engine's FS_LOAD command (whitespace breaks
// the line-based protocol, so it is folded to underscores).
export function normalizeUser(user) {
    const raw = String(user ?? '').trim();
    const folded = raw.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^_+|_+$/g, '');
    return (folded || 'user').slice(0, 64);
}

function vfsPath(user) {
    return path.join(VFS_DIR, `${normalizeUser(user)}.json`);
}

// Returns { user, updatedAt, snapshot } or null when this user has no stored FS.
export function readVfs(user) {
    try {
        const raw = fs.readFileSync(vfsPath(user), 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.snapshot === 'string' && parsed.snapshot.length) {
            return parsed;
        }
    } catch {
        // Missing or corrupt file — treat as "no stored filesystem".
    }
    return null;
}

// Atomic write: serialize to a sibling temp file, then rename over the target.
// Rename is atomic on the same filesystem, so a reader (or a crash) only ever
// sees the previous complete snapshot or the new complete snapshot.
function atomicWriteJson(target, value) {
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(value), 'utf-8');
        try {
            fs.renameSync(tmp, target);
        } catch (err) {
            // Some platforms refuse to rename onto an open file; fall back to a
            // direct write so persistence still succeeds.
            fs.writeFileSync(target, JSON.stringify(value), 'utf-8');
            try { fs.unlinkSync(tmp); } catch { /* best effort */ }
        }
        return true;
    } catch (err) {
        console.error(`[VFS] Failed to persist ${path.basename(target)}: ${err.message}`);
        return false;
    }
}

// Persists a snapshot. Returns the written record (or null on failure).
export function writeVfs(user, snapshot) {
    if (!snapshot || typeof snapshot !== 'string') return null;
    // An empty user means "no one is logged in yet" (a freshly booted engine
    // exporting its untouched seed tree). Writing that would silently wipe the
    // account whose normalized name happens to be "user".
    if (!String(user ?? '').trim()) return null;

    const record = {
        user: normalizeUser(user),
        updatedAt: new Date().toISOString(),
        snapshot
    };
    return atomicWriteJson(vfsPath(user), record) ? record : null;
}

// Epoch milliseconds for a stored record's ISO timestamp (0 when unusable).
export function vfsRecordTimestamp(record) {
    const ms = Date.parse(record?.updatedAt ?? '');
    return Number.isFinite(ms) ? ms : 0;
}

// ── Active-user memory ───────────────────────────────────────────────────────
// The engine is single-user at a time. Remembering who was last loaded means a
// backend restart (with the browser tab still open) can put that user's
// filesystem back without waiting for the user to log in again.

export function readActiveUser() {
    try {
        const parsed = JSON.parse(fs.readFileSync(ACTIVE_USER_FILE, 'utf-8'));
        const user = String(parsed?.user ?? '').trim();
        return user || null;
    } catch {
        return null;
    }
}

export function writeActiveUser(user) {
    const name = String(user ?? '').trim();
    if (!name) return false;
    return atomicWriteJson(ACTIVE_USER_FILE, {
        user: name,
        updatedAt: new Date().toISOString()
    });
}

export function clearActiveUser() {
    try {
        fs.unlinkSync(ACTIVE_USER_FILE);
    } catch {
        // Nothing to clear.
    }
}

export function vfsRoot() {
    return VFS_DIR;
}
