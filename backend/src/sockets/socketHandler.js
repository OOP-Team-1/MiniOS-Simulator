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
        socket.on('cmd:reset', () => sendCommand("RESET"));
        // data: { fileId, newName }
        socket.on('cmd:file_rename', (data) => {
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeName   = String(data.newName).replace(/[^a-zA-Z0-9_.\-]/g, '');
            if (safeFileId && safeName) {
                sendCommand(`FILE_RENAME ${safeFileId} ${safeName}`);
            }
        });
        socket.on('cmd:set_scheduler', (data) => {
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
            const allowed = ['FirstFit', 'BestFit', 'WorstFit'];
            const type = String(data.type);
            if (!allowed.includes(type)) return;
            sendCommand(`SET_ALLOC ${type}`);
        });
        // ── Process creation ──────────────────────────────────────────────────
        socket.on('cmd:add_process', (data) => {
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

        // ── File system operations ────────────────────────────────────────────
        // data: { ownerPID, name, sizeInBlocks, dirPath? }
        socket.on('cmd:file_create', (data) => {
            const { ownerPID, name, sizeInBlocks, dirPath } = data;

            const safePID      = String(ownerPID).replace(/[^a-zA-Z0-9_-]/g, '');
            const safeName     = String(name).replace(/[^a-zA-Z0-9_.\-]/g, '');
            const safeBlocks   = parseInt(sizeInBlocks, 10);
            const safeDirPath  = dirPath ? String(dirPath).replace(/[^a-zA-Z0-9_/\-]/g, '') : '/';

            if (safePID && safeName && safeBlocks > 0) {
                sendCommand(`FILE_CREATE ${safePID} ${safeName} ${safeBlocks} ${safeDirPath}`);
            }
        });

        // data: { fileId }
        socket.on('cmd:file_delete', (data) => {
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId) {
                sendCommand(`FILE_DELETE ${safeFileId}`);
            }
        });

        // data: { fileId, byPID }
        socket.on('cmd:file_open', (data) => {
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safePID    = String(data.byPID).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId && safePID) {
                sendCommand(`FILE_OPEN ${safeFileId} ${safePID}`);
            }
        });

        // data: { fileId, byPID }
        socket.on('cmd:file_close', (data) => {
            const safeFileId = String(data.fileId).replace(/[^a-zA-Z0-9_-]/g, '');
            const safePID    = String(data.byPID).replace(/[^a-zA-Z0-9_-]/g, '');
            if (safeFileId && safePID) {
                sendCommand(`FILE_CLOSE ${safeFileId} ${safePID}`);
            }
        });

        // ── Timer controls ────────────────────────────────────────────────────
        socket.on('timer:start', ({ intervalMs }) => startAutoStep(intervalMs));
        socket.on('timer:pause', () => stopAutoStep());
        socket.on('timer:set_speed', ({ intervalMs }) => startAutoStep(intervalMs));

        socket.on('disconnect', () => {
            if (io.engine.clientsCount === 0) {
                stopAutoStep();
            }
        });
    });
}