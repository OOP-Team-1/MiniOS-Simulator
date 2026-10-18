// Minimal promise wrapper around IndexedDB with a localStorage fallback.
//
// Two object stores share the same shape ({ id, ... }):
//   * accounts — one record per local account (password verifier material)
//   * vfs      — one record per user holding their virtual filesystem snapshot
//
// Everything here is best-effort: if IndexedDB is unavailable (private mode,
// very old browser) we silently fall back to localStorage so the simulator still
// persists. No external database is ever involved.

const DB_NAME = 'minios-desktop';
const DB_VERSION = 1;
const FALLBACK_PREFIX = 'minios.fallback.';

let dbPromise = null;

function indexedDbAvailable() {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
        return false;
    }
}

function openDatabase() {
    if (!indexedDbAvailable()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('accounts')) {
                db.createObjectStore('accounts', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('vfs')) {
                db.createObjectStore('vfs', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

function tx(storeName, mode, run) {
    return openDatabase().then((db) => {
        if (!db) return run(null);
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            let result;
            try {
                result = run(store);
            } catch (err) {
                reject(err);
                return;
            }
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    });
}

function fallbackKey(storeName, id) {
    return `${FALLBACK_PREFIX}${storeName}.${id}`;
}

function fallbackPut(storeName, value) {
    try {
        localStorage.setItem(fallbackKey(storeName, value.id), JSON.stringify(value));
    } catch {
        /* storage full or unavailable — ignore */
    }
}

function fallbackGet(storeName, id) {
    try {
        const raw = localStorage.getItem(fallbackKey(storeName, id));
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
}

function fallbackGetAll(storeName) {
    const out = [];
    try {
        const prefix = `${FALLBACK_PREFIX}${storeName}.`;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                try {
                    out.push(JSON.parse(localStorage.getItem(key)));
                } catch {
                    /* skip corrupt entry */
                }
            }
        }
    } catch {
        /* ignore */
    }
    return out;
}

export async function idbPut(storeName, value) {
    const db = await openDatabase();
    if (!db) {
        fallbackPut(storeName, value);
        return;
    }
    try {
        await tx(storeName, 'readwrite', (store) => store.put(value));
    } catch {
        fallbackPut(storeName, value);
    }
}

export async function idbGet(storeName, id) {
    const db = await openDatabase();
    if (!db) return fallbackGet(storeName, id);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const request = transaction.objectStore(storeName).get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return fallbackGet(storeName, id);
    }
}

export async function idbGetAll(storeName) {
    const db = await openDatabase();
    if (!db) return fallbackGetAll(storeName);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const request = transaction.objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return fallbackGetAll(storeName);
    }
}
