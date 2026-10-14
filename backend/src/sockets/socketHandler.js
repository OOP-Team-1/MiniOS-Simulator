import { sendCommand } from '../engine/processManager.js';
import { startAutoStep, stopAutoStep } from './simulationClock.js';

export function registerSocketEvents(io) {
    io.on('connection', (socket) => {
        console.log(`[Socket.io] Client connected: ${socket.id}`);

        sendCommand("STATE");

        // ── Simulation controls ───────────────────────────────────────────────
        socket.on('cmd:step', () => sendCommand("STEP"));
        socket.on('cmd:compact', () => sendCommand("COMPACT"));
        socket.on('cmd:disk_compact', () => sendCommand("DISK_COMPACT"));
        socket.on('cmd:reset', () => {
            stopAutoStep();
            sendCommand("RESET");
        });
        // data: { fileId, newName }
        socket.on('cmd:file_rename', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeName = String(data.newName).replace(/[^a-zA-Z0-9_.\-]/g, '');
            if (safeFileId && safeName) {
                sendCommand(`FILE_RENAME ${safeFileId} ${safeName}`);
            }
        });
        socket.on('cmd:set_scheduler', (data) => {
            if (!data) return;
            const allowed = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'RR'];
            const type = String(data.type).toUpperCase();
            if (!allowed.includes(type)) return;

            if (type === 'RR') {
                const quantum = Math.max(1, parseInt(data.quantum, 10) || 2);
                sendCommand(`SET_SCHEDULER RR ${quantum}`);
            } else {
                sendCommand(`SET_SCHEDULER ${type}`);
            }
        });
        // data: { type: 'FirstFit'|'BestFit'|'WorstFit' }
        socket.on('cmd:set_alloc', (data) => {
            if (!data) return;
            const allowed = ['FirstFit', 'BestFit', 'WorstFit'];
            const type = String(data.type);
            if (!allowed.includes(type)) return;
            sendCommand(`SET_ALLOC ${type}`);
        });
        // ── Process creation ──────────────────────────────────────────────────
        socket.on('cmd:add_process', (data) => {
            if (!data) return;
            const { name, priority, arrival, burst, memory } = data;

            const safeName = String(name).replace(/[^a-zA-Z0-9_-]/g, '');
            const p = parseInt(priority, 10) || 1;
            const a = parseInt(arrival, 10) || 0;
            const b = parseInt(burst, 10) || 1;
            const m = parseInt(memory, 10) || 1;

            if (safeName && b > 0 && m > 0) {
                sendCommand(`ADD ${safeName} ${p} ${a} ${b} ${m}`);
            }
        });
        // ── Process termination ───────────────────────────────────────────────
        socket.on('cmd:kill_process', (data) => {
            if (!data) return;
            // Strip out weird characters for safety, leaving just the PID (like '0P1')
            const safePID = String(data.pid).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safePID) {
                // Forward the kill command to the C++ Engine's standard input
                sendCommand(`KILL ${safePID}`);
            }
        });

        // ── Directory operations ────────────────────────────────────────────────
        // Directory ids look like "D0", "D12", etc. — same safe charset as a PID/fileId.

        // data: { name, parentDirId? }  — parentDirId omitted/empty => root (D0)
        socket.on('cmd:dir_create', (data) => {
            if (!data) return;
            const { name, parentDirId } = data;
            const safeName = String(name).replace(/[^a-zA-Z0-9_.\-]/g, '');
            const safeParent = parentDirId ? String(parentDirId).replace(/[^a-zA-Z0-9_-]/g, '') : '';

            if (safeName) {
                sendCommand(safeParent ? `DIR_CREATE ${safeName} ${safeParent}` : `DIR_CREATE ${safeName}`);
            }
        });

        // data: { dirId }
        socket.on('cmd:dir_delete', (data) => {
            if (!data) return;
            const safeDirId = String(data.dirId).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeDirId) {
                sendCommand(`DIR_DELETE ${safeDirId}`);
            }
        });

        // data: { dirId, newName }
        socket.on('cmd:dir_rename', (data) => {
            if (!data) return;
            const safeDirId = String(data.dirId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeName = String(data.newName).replace(/[^a-zA-Z0-9_.\-]/g, '');
            if (safeDirId && safeName) {
                sendCommand(`DIR_RENAME ${safeDirId} ${safeName}`);
            }
        });

        // data: { dirId, newParentDirId }
        socket.on('cmd:dir_move', (data) => {
            if (!data) return;
            const safeDirId = String(data.dirId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeNewParent = String(data.newParentDirId).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeDirId && safeNewParent) {
                sendCommand(`DIR_MOVE ${safeDirId} ${safeNewParent}`);
            }
        });

        // ── File system operations ────────────────────────────────────────────
        // data: { ownerPID, name, sizeInBlocks, dirId? }  — dirId omitted/empty => root (D0)
        socket.on('cmd:file_create', (data) => {
            if (!data) return;
            const { ownerPID, name, sizeInBlocks, dirId } = data;

            const safePID = String(ownerPID).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeName = String(name).replace(/[^a-zA-Z0-9_.\-]/g, '');
            const safeBlocks = parseInt(sizeInBlocks, 10);
            const safeDirId = dirId ? String(dirId).replace(/[^a-zA-Z0-9_-]/g, '') : '';

            if (safePID && safeName && safeBlocks > 0) {
                sendCommand(
                    safeDirId
                        ? `FILE_CREATE ${safePID} ${safeName} ${safeBlocks} ${safeDirId}`
                        : `FILE_CREATE ${safePID} ${safeName} ${safeBlocks}`
                );
            }
        });

        // data: { fileId }
        socket.on('cmd:file_delete', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId) {
                sendCommand(`FILE_DELETE ${safeFileId}`);
            }
        });

        // data: { fileId, newDirId }
        socket.on('cmd:file_move', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeNewDirId = String(data.newDirId).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId && safeNewDirId) {
                sendCommand(`FILE_MOVE ${safeFileId} ${safeNewDirId}`);
            }
        });

        // data: { fileId, byPID }
        socket.on('cmd:file_open', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safePID = String(data.byPID).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId && safePID) {
                sendCommand(`FILE_OPEN ${safeFileId} ${safePID}`);
            }
        });

        // data: { fileId, byPID }
        socket.on('cmd:file_close', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safePID = String(data.byPID).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId && safePID) {
                sendCommand(`FILE_CLOSE ${safeFileId} ${safePID}`);
            }
        });

        // data: { fileId, byPID }
        socket.on('cmd:file_read', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safePID = String(data.byPID).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId && safePID) {
                sendCommand(`FILE_READ ${safeFileId} ${safePID}`);
            }
        });

        // data: { fileId, byPID, content }
        // content is base64-encoded before crossing the line-based stdin
        // protocol, so embedded newlines/quotes can't break command parsing
        socket.on('cmd:file_write', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safePID = String(data.byPID).replace(/[^a-zA-Z0-9_-]/g, '');
            const b64Content = Buffer.from(String(data.content ?? ''), 'utf-8').toString('base64');
            if (safeFileId && safePID) {
                sendCommand(`FILE_WRITE ${safeFileId} ${safePID} ${b64Content}`);
            }
        });

        // data: { fileId, byPID, content }
        socket.on('cmd:file_append', (data) => {
            if (!data) return;
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safePID = String(data.byPID).replace(/[^a-zA-Z0-9_-]/g, '');
            const b64Content = Buffer.from(String(data.content ?? ''), 'utf-8').toString('base64');
            if (safeFileId && safePID) {
                sendCommand(`FILE_APPEND ${safeFileId} ${safePID} ${b64Content}`);
            }
        });

        // ── Timer controls ────────────────────────────────────────────────────
        socket.on('timer:start', (data) => startAutoStep(data?.intervalMs));
        socket.on('timer:pause', () => stopAutoStep());
        socket.on('timer:set_speed', (data) => startAutoStep(data?.intervalMs));

        socket.on('disconnect', () => {
            if (io.engine.clientsCount === 0) {
                stopAutoStep();
            }
        });
    });
}