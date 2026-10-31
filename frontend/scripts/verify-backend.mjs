// End-to-end backend verification.
//
// Boots the real backend (which in turn spawns the real C++ engine), drives it
// through the socket.io protocol exactly like the browser does, and asserts the
// whole chain: persistent VFS load/save, the real shell, the kernel bridge, and
// the editor file read/save round-trip.
//
// Run with:  npm run verify:backend --prefix frontend
//
// The backend is isolated with PORT=5099 and MINIOS_DATA_DIR=<temp> so it never
// collides with a dev server or writes into the repo.

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { io as ioClient } from 'socket.io-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(frontendDir, '..', 'backend');

const PORT = 5099;
const BASE = `http://localhost:${PORT}`;

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minios-verify-'));
const backendEnv = {
    ...process.env,
    PORT: String(PORT),
    MINIOS_DATA_DIR: dataDir,
    FRONTEND_URL: 'http://localhost:5173'
};

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
    if (condition) {
        passed++;
        console.log(`  PASS  ${name}`);
    } else {
        failed++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Boots the backend (which in turn spawns the C++ engine) and resolves once it
// answers its health check. Used for the restart phases below.
function bootBackend() {
    const child = spawn(process.execPath, ['src/index.js'], {
        cwd: backendDir,
        env: backendEnv,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[backend] ${d}`));
    return child;
}

function killBackend(child) {
    if (!child) return;
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
        child.kill('SIGKILL');
    }
}

async function waitForHealth(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${BASE}/api/health`);
            if (res.ok) return true;
        } catch {
            // not up yet
        }
        await sleep(250);
    }
    throw new Error('Backend did not become healthy in time');
}

function once(socket, event, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Timed out waiting for '${event}'`));
        }, timeoutMs);
        function handler(payload) {
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(payload);
        }
        socket.on(event, handler);
    });
}

function onceMatching(socket, event, predicate, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Timed out waiting for matching '${event}'`));
        }, timeoutMs);
        function handler(payload) {
            if (!predicate(payload)) return;
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(payload);
        }
        socket.on(event, handler);
    });
}

async function main() {
    console.log('Booting backend + engine...');
    let backend = bootBackend();

    try {
        await waitForHealth();

        let latestTelemetry = null;
        let socket = ioClient(BASE, { transports: ['websocket'], reconnection: false });

        const waitForTelemetry = (pred, timeoutMs = 8000) => {
            if (latestTelemetry && pred(latestTelemetry)) return Promise.resolve(latestTelemetry);
            return onceMatching(socket, 'telemetry:update', pred, timeoutMs);
        };
        socket.on('telemetry:update', (t) => { latestTelemetry = t; });

        const exec = async (command) => {
            const p = onceMatching(socket, 'shell:result', (r) => r.command === command);
            socket.emit('shell:exec', { command });
            return p;
        };

        if (!socket.connected) {
            await once(socket, 'connect', 10000);
        }

        // ── 1. Engine is alive and streaming telemetry ────────────────────────
        console.log('\n[1] Engine telemetry');
        const firstTelemetry = await waitForTelemetry(() => true, 10000);
        check('engine streams telemetry', !!firstTelemetry && typeof firstTelemetry.tick === 'number');

        // ── 2. Fresh user filesystem gets the default folders ────────────────
        console.log('\n[2] Brand-new user filesystem');
        const loaded1P = once(socket, 'vfs:loaded');
        socket.emit('vfs:load', { user: 'verify_user' });
        const loaded1 = await loaded1P;
        check('vfs:loaded echoes the user', loaded1.user === 'verify_user', JSON.stringify(loaded1));
        check('brand-new user has no stored snapshot', loaded1.source === 'none', loaded1.source);

        const snap1 = await onceMatching(socket, 'vfs:snapshot', (s) => s.user === 'verify_user');
        check('snapshot uses the versioned format', snap1.snapshot.startsWith('MINIOS_VFS 1'));

        const lsHome = await exec('ls');
        const defaults = ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos'];
        check(
            'default folders are created',
            defaults.every((d) => lsHome.output.includes(d)),
            JSON.stringify(lsHome.output)
        );

        // ── 3. Real shell file operations ────────────────────────────────────
        console.log('\n[3] Real CommandPrompt via shell:exec');
        await exec('mkdir projects');
        await exec('echo "hello world" > projects/note.txt');
        const cat = await exec('cat projects/note.txt');
        check('echo + cat round-trips through the shell', cat.output.includes('hello world'), JSON.stringify(cat.output));

        const pwd = await exec('pwd');
        check('pwd reports the home directory', pwd.output.trim().startsWith('/home/verify_user'), JSON.stringify(pwd.output));

        // ── 4. Kernel bridge commands ────────────────────────────────────────
        console.log('\n[4] Kernel bridge');
        const spawnRes = await exec('spawn worker 2 0 4 16');
        check('spawn is acknowledged', spawnRes.kernel === true && /Spawned process/.test(spawnRes.output));
        await waitForTelemetry((t) => (t.processes || []).some((p) => p.name === 'worker'));
        check('spawned process appears in telemetry', true);

        const ps = await exec('ps');
        check('ps is handled by the kernel bridge', ps.kernel === true);
        check('ps prints a process table header', ps.output.includes('PID'));
        check('ps lists the spawned process', ps.output.includes('worker'), JSON.stringify(ps.output));

        // Removing a process must erase its PCB in the engine, not just hide it
        // in the UI, so it cannot reappear on the next telemetry frame.
        const worker = (latestTelemetry?.processes || []).find((p) => p.name === 'worker');
        check('telemetry exposes the spawned PID', Boolean(worker?.pid));
        socket.emit('cmd:remove_process', { pid: worker.pid });
        await waitForTelemetry((t) => !(t.processes || []).some((p) => p.pid === worker.pid));
        check('removed process disappears from telemetry', true);
        check(
            'removing a process frees its memory',
            (latestTelemetry?.memory?.usedMemory ?? -1) === 0,
            JSON.stringify(latestTelemetry?.memory)
        );

        const mem = await exec('mem');
        check('mem prints memory totals', /Total:/.test(mem.output), JSON.stringify(mem.output));

        // ── 5. Persistence: reload restores the tree ─────────────────────────
        console.log('\n[5] Persistence across reload');
        const reloadP = once(socket, 'vfs:loaded');
        socket.emit('vfs:load', { user: 'verify_user' });
        const reloaded = await reloadP;
        check('reload restores from the server mirror', reloaded.source === 'server', reloaded.source);

        const lsProjects = await exec('ls projects');
        check('restored tree keeps created files', lsProjects.output.includes('note.txt'), JSON.stringify(lsProjects.output));

        // ── 6. Deleting a default folder is not undone on reload ─────────────
        console.log('\n[6] No reseeding on reload');
        // Attach the snapshot listener *before* the command: the engine emits
        // SHELL_RESULT then FS_EXPORT, and both may arrive in one batch.
        const afterDeleteSnap = onceMatching(socket, 'vfs:snapshot', (s) => s.user === 'verify_user');
        await exec('rm -r Videos');
        await afterDeleteSnap;
        const reload2P = once(socket, 'vfs:loaded');
        socket.emit('vfs:load', { user: 'verify_user' });
        await reload2P;
        const lsAfterDelete = await exec('ls');
        check('pruned default folder stays deleted', !lsAfterDelete.output.includes('Videos'));
        check('other default folders survive', lsAfterDelete.output.includes('Desktop'));

        // ── 7. Editor read + save round-trip ─────────────────────────────────
        console.log('\n[7] Editor file read/save');
        await exec('touch projects/edit.txt');
        await exec('ps'); // forces a STATE refresh so telemetry has the new file
        const withFile = await waitForTelemetry(
            (t) => (t.filesystem?.files || []).some((f) => f.name === 'edit.txt')
        );
        const editFile = withFile.filesystem.files.find((f) => f.name === 'edit.txt');
        check('file is visible in telemetry with a fileId', !!editFile?.fileId);

        const readP = onceMatching(socket, 'file:read_result', (r) => r.fileId === editFile.fileId);
        socket.emit('cmd:file_content', { fileId: editFile.fileId });
        const readRes = await readP;
        check('file_content read succeeds', readRes.ok === true && readRes.pid === 'EDITOR');

        const saveP = onceMatching(socket, 'file:save_result', (r) => r.fileId === editFile.fileId);
        socket.emit('cmd:file_save', { requestId: 'req-1', fileId: editFile.fileId, content: 'edited contents\n' });
        const saveRes = await saveP;
        check('file_save is acknowledged ok', saveRes.ok === true && saveRes.requestId === 'req-1');

        const catEdited = await exec('cat projects/edit.txt');
        check('saved content is readable through the shell', catEdited.output.includes('edited contents'), JSON.stringify(catEdited.output));

        // ── 8. Server mirror is actually on disk ─────────────────────────────
        console.log('\n[8] Server-side mirror');
        const mirrorPath = path.join(dataDir, 'vfs', 'verify_user.json');
        check('server mirror file exists', fs.existsSync(mirrorPath), mirrorPath);
        if (fs.existsSync(mirrorPath)) {
            const record = JSON.parse(fs.readFileSync(mirrorPath, 'utf-8'));
            check('mirror stores the snapshot text', typeof record.snapshot === 'string' && record.snapshot.startsWith('MINIOS_VFS 1'));
        }

        // ── 9. Filesystem survives a real server restart ────────────────────
        // Regression test for "my files vanished after restarting the server":
        // kill the backend completely, boot a brand new one over the same data
        // directory, then log back in like a real user would.
        console.log('\n[9] Persistence across a real server restart');
        socket.close();
        try { await fetch(`${BASE}/api/engine/stop`); } catch { /* already down */ }
        await sleep(300);
        killBackend(backend);
        await sleep(1000);

        backend = bootBackend();
        await waitForHealth();
        socket = ioClient(BASE, { transports: ['websocket'], reconnection: false, forceNew: true });
        if (!socket.connected) await once(socket, 'connect', 10000);

        const restartedLoadedP = once(socket, 'vfs:loaded');
        socket.emit('vfs:load', { user: 'verify_user' });
        const restartedLoaded = await restartedLoadedP;
        check('re-login after restart restores from the mirror', restartedLoaded.source === 'server', restartedLoaded.source);

        const execRestarted = async (command) => {
            const p = onceMatching(socket, 'shell:result', (r) => r.command === command);
            socket.emit('shell:exec', { command });
            return p;
        };
        const lsHomeAfterRestart = await execRestarted('ls');
        check('home folders survived the restart', lsHomeAfterRestart.output.includes('Desktop'), JSON.stringify(lsHomeAfterRestart.output));
        check('pruned folder is still pruned', !lsHomeAfterRestart.output.includes('Videos'), JSON.stringify(lsHomeAfterRestart.output));
        const lsProjectsAfterRestart = await execRestarted('ls projects');
        check('created files survived the restart', lsProjectsAfterRestart.output.includes('note.txt') && lsProjectsAfterRestart.output.includes('edit.txt'), JSON.stringify(lsProjectsAfterRestart.output));
        const catAfterRestart = await execRestarted('cat projects/edit.txt');
        check('edited content survived the restart', catAfterRestart.output.includes('edited contents'), JSON.stringify(catAfterRestart.output));

        // ── 10. Boot restore without a re-login ─────────────────────────────
        // A browser tab left open across a restart never re-emits vfs:load, so
        // the backend has to put the last user's filesystem back by itself.
        console.log('\n[10] Backend restores the filesystem without a re-login');
        socket.close();
        try { await fetch(`${BASE}/api/engine/stop`); } catch { /* already down */ }
        await sleep(300);
        killBackend(backend);
        await sleep(1000);

        backend = bootBackend();
        await waitForHealth();
        socket = ioClient(BASE, { transports: ['websocket'], reconnection: false, forceNew: true });
        if (!socket.connected) await once(socket, 'connect', 10000);
        await sleep(2000); // let the boot restore run

        const execNoLogin = async (command) => {
            const p = onceMatching(socket, 'shell:result', (r) => r.command === command);
            socket.emit('shell:exec', { command });
            return p;
        };
        const lsNoLogin = await execNoLogin('ls projects');
        check('files are back without logging in again', lsNoLogin.output.includes('note.txt'), JSON.stringify(lsNoLogin.output));

        socket.close();
    } finally {
        // Stop the engine, then the backend, then clean up.
        try { await fetch(`${BASE}/api/engine/stop`); } catch { /* ignore */ }
        await sleep(200);
        killBackend(backend);
        await sleep(200);
        try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }

    console.log(`\n===========================================`);
    console.log(`RESULT: ${passed} passed, ${failed} failed`);
    console.log(`===========================================`);
    process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error('\nVerification aborted:', err.message);
    process.exit(1);
});
