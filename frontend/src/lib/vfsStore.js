import { idbGet, idbPut } from './idb';
import { userKey } from './user';

// Browser-side mirror of a user's virtual filesystem snapshot.
//
// The authoritative copy lives in the C++ engine at runtime and is mirrored to
// the backend (backend/data/vfs/<user>.json). This IndexedDB copy is a safety
// net: if the backend has no snapshot for the user (fresh machine, cleared
// server data), the browser uploads its copy when the user logs in.

export async function saveBrowserSnapshot(user, snapshot) {
    if (!user || typeof snapshot !== 'string' || !snapshot) return;
    await idbPut('vfs', {
        id: userKey(user),
        user: String(user).trim(),
        snapshot,
        updatedAt: Date.now()
    });
}

export async function loadBrowserSnapshot(user) {
    if (!user) return null;
    const record = await idbGet('vfs', userKey(user));
    return record?.snapshot || null;
}

// Full record (snapshot + updatedAt), used to tell the backend which copy of
// the filesystem is newer when a session is reloaded.
export async function loadBrowserSnapshotRecord(user) {
    if (!user) return null;
    const record = await idbGet('vfs', userKey(user));
    if (!record?.snapshot) return null;
    return { snapshot: record.snapshot, updatedAt: Number(record.updatedAt) || 0 };
}
