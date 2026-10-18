import { spawn } from 'child_process';
import { ENGINE_BINARY_PATH } from '../config/paths.js';
import { createStreamParser } from './streamParser.js';
import { readVfs, writeActiveUser, readActiveUser, vfsRecordTimestamp, normalizeUser } from '../storage/vfsStore.js';

// ---------------------------------------------------------------------------
// Engine process lifecycle
//
// The C++ engine is spawned once and kept alive. It is the single source of
// truth for the virtual filesystem, so all callbacks are registered here as a
// named handler object (rather than a long positional argument list). Callers
// may register any subset of handlers; unknown ones are simply skipped.
//
// `startEngine()` is also called with no arguments after a crash/restart, so the
// merged handler object persists across respawns.
// ---------------------------------------------------------------------------

let engineProcess = null;
let lastTelemetry = null;
let engineHandlers = {};
let activeUser = null;
// Distinguishes "engine respawned after a crash" (in-memory state survives)
// from "backend just booted, engine is a brand-new process". Only the latter
// needs to rehydrate the filesystem from the on-disk mirror.
let engineEverLoadedUser = false;

let isShuttingDown = false;
let isRestarting = false;

export function getLatestTelemetry() {
    return lastTelemetry;
}

// The normalized username whose filesystem is currently loaded in the engine.
export function getActiveUser() {
    return activeUser;
}

export function startEngine(handlers = {}) {
    // Register/merge callbacks. Restart paths call this with no args, so the
    // original callbacks must survive.
    engineHandlers = { ...engineHandlers, ...handlers };

    if (engineProcess && !engineProcess.killed) {
        console.warn('Engine is already running.');
        return;
    }

    isShuttingDown = false;
    const freshBoot = !engineEverLoadedUser;
    engineProcess = spawn(ENGINE_BINARY_PATH);

    createStreamParser(engineProcess.stdout, {
        onTelemetry: (telemetry) => {
            lastTelemetry = telemetry;
            engineHandlers.onTelemetry?.(telemetry);
        },
        onError: (errorData) => {
            engineHandlers.onError?.(errorData);
        },
        onReadResult: (readResult) => {
            engineHandlers.onReadResult?.(readResult);
        },
        onEngineError: (engineError) => {
            engineHandlers.onEngineError?.(engineError);
        },
        onFsExport: (payload) => {
            // payload.snapshot is base64; hand callers the decoded snapshot text
            // (the `MINIOS_VFS 1\n...` serialized form) so there is exactly one
            // representation on the JS side.
            const snapshotText = Buffer.from(payload.snapshot || '', 'base64').toString('utf-8');
            engineHandlers.onFsExport?.({ ...payload, snapshotText });
        },
        onShellResult: (result) => {
            engineHandlers.onShellResult?.(result);
        },
        onCwdResult: (result) => {
            engineHandlers.onCwdResult?.(result);
        },
        onFileSaveResult: (result) => {
            engineHandlers.onFileSaveResult?.(result);
        }
    });

    engineProcess.stderr.on('data', (chunk) => {
        console.error(`[Engine stderr] ${chunk.toString()}`);
    });

    engineProcess.on('error', (err) => {
        console.error(`[Engine] Process error: ${err.message}`);
    });

    engineProcess.on('close', (code) => {
        console.log(`[Engine] Process exited with code ${code}`);
        engineProcess = null;
        if (!isShuttingDown && !isRestarting) {
            engineHandlers.onRestart?.();
            setTimeout(() => startEngine(), 1000);
            scheduleActiveUserReload(1600);
        }
    });

    // A brand-new engine process has an empty in-RAM filesystem. If someone was
    // logged in before the backend restarted (the browser tab survived the
    // restart), put their filesystem back right away so the desktop doesn't
    // appear to have lost every file the moment the server comes back.
    if (freshBoot) {
        scheduleBootRestore();
    }
}

// ---------------------------------------------------------------------------
// Virtual filesystem load
//
// The engine RAM filesystem is wiped and repopulated from a snapshot. The
// snapshot source is chosen in priority order:
//   1. the server-side mirror (backend/data/vfs/<user>.json)
//   2. a snapshot uploaded by the browser (its IndexedDB safety net)
//   3. nothing — the engine seeds a brand-new tree with the default folders
//
// Restoring never reseeds, and a brand-new tree is only ever created here.
// ---------------------------------------------------------------------------

export function loadUser(user, browserSnapshot = null, browserUpdatedAt = null) {
    const normalized = normalizeUser(user);
    activeUser = normalized;
    engineEverLoadedUser = true;

    const stored = readVfs(normalized);
    let snapshotText = stored?.snapshot || null;
    let source = snapshotText ? 'server' : 'none';

    // Safety net: when the browser's copy is strictly newer than the server
    // mirror (for example the server data directory was wiped or restored from
    // an older backup while the tab stayed open), prefer the newer snapshot
    // instead of silently rolling the user's filesystem backwards.
    const hasBrowser = typeof browserSnapshot === 'string' && browserSnapshot.length > 0;
    if (hasBrowser) {
        const browserTs = Number(browserUpdatedAt) || 0;
        const serverTs = vfsRecordTimestamp(stored);
        if (!snapshotText || (browserTs > 0 && browserTs > serverTs)) {
            snapshotText = browserSnapshot;
            source = 'browser';
        }
    }

    const payload = snapshotText
        ? Buffer.from(snapshotText, 'utf-8').toString('base64')
        : '-';

    sendCommand(`FS_LOAD ${normalized} ${payload}`);
    writeActiveUser(normalized);
    return { user: normalized, source };
}

// After an engine respawn the in-RAM filesystem is gone. Give the child process
// a moment to boot, then put the active user's filesystem back.
function scheduleActiveUserReload(delayMs) {
    const user = activeUser;
    if (!user) return;

    setTimeout(() => {
        // Ignore if the active user changed (or logged out) while we waited.
        if (activeUser !== user || isShuttingDown) return;

        const stored = readVfs(user);
        const payload = stored?.snapshot
            ? Buffer.from(stored.snapshot, 'utf-8').toString('base64')
            : '-';
        sendCommand(`FS_LOAD ${user} ${payload}`);
    }, delayMs);
}

// Backend-restart path: no JS state survived, but the on-disk mirror remembers
// who was logged in. Restore that user's filesystem into the fresh engine so
// an already-open desktop keeps working (and a re-login is instant).
function scheduleBootRestore() {
    setTimeout(() => {
        if (isShuttingDown || activeUser) return;
        const remembered = readActiveUser();
        if (!remembered) return;

        const stored = readVfs(remembered);
        if (!stored?.snapshot) return;

        activeUser = normalizeUser(remembered);
        engineEverLoadedUser = true;
        const payload = Buffer.from(stored.snapshot, 'utf-8').toString('base64');
        console.log(`[VFS] Restored filesystem for '${remembered}' after backend restart.`);
        sendCommand(`FS_LOAD ${activeUser} ${payload}`);
    }, 700);
}

export function sendCommand(cmd) {
    if (engineProcess && engineProcess.stdin && engineProcess.stdin.writable) {
        try {
            engineProcess.stdin.write(`${cmd}\n`);
        } catch (err) {
            console.error(`[Engine] Stdin write error: ${err.message}`);
        }
    }
}

export function triggerRestart() {
    if (isRestarting || isShuttingDown) return;
    isRestarting = true;
    if (engineProcess) {
        engineProcess.kill();
        engineProcess = null;
    }
    engineHandlers.onRestart?.();
    setTimeout(() => {
        isRestarting = false;
        startEngine();
    }, 1000);
    scheduleActiveUserReload(1600);
}

export function killEngine() {
    isShuttingDown = true;
    if (engineProcess && !engineProcess.killed) {
        sendCommand('EXIT');
        engineProcess.kill();
        engineProcess = null;
    }
}
