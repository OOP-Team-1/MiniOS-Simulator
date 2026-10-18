import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import healthRoutes from './routes/healthRoutes.js';
import simulationRoutes from './routes/simulationRoutes.js';
import { startEngine, killEngine, sendCommand } from './engine/processManager.js';
import { registerSocketEvents } from './sockets/socketHandler.js';
import { writeVfs } from './storage/vfsStore.js';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', simulationRoutes);

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

const io = new Server(server, {
    cors: {
        origin: frontendUrl,
        methods: ["GET", "POST"]
    }
});

// Boot the C++ Engine.
// Handlers receive parsed engine output; telemetry/results are fanned out to
// every connected browser, while filesystem snapshots are also mirrored to disk
// so each user's virtual filesystem survives reloads and restarts.
console.log("Initializing OS Simulator Backend...");
startEngine({
    onTelemetry: (telemetry) => {
        io.emit('telemetry:update', telemetry);
    },

    onError: (errorData) => {
        io.emit('engine:error', errorData);
    },

    onRestart: () => {
        io.emit('engine:restarted', {
            message: 'Engine crashed and is restarting. State has been reset.',
            timestamp: new Date().toISOString()
        });
    },

    onReadResult: (readResult) => {
        // readResult: { type: "READ_RESULT", fileId, pid, ok, content }
        // content arrives base64-encoded from the engine (if ok); decode for the client
        const decoded = readResult.ok
            ? Buffer.from(readResult.content, 'base64').toString('utf-8')
            : null;

        io.emit('file:read_result', {
            fileId: readResult.fileId,
            pid: readResult.pid,
            ok: readResult.ok,
            content: decoded
        });
    },

    onEngineError: (engineError) => {
        // engineError: { type: "ERROR", message }
        // Raised when a command threw inside the engine (e.g. bad process params). The engine process itself stays alive.
        io.emit('engine:command_error', {
            message: engineError.message,
            timestamp: new Date().toISOString()
        });
    },

    onFsExport: ({ user, snapshotText }) => {
        // The engine emits this after every mutating command. Mirror it to the
        // server-side store and hand the browser its own copy (IndexedDB).
        //
        // `user` is empty until somebody logs in (a freshly booted engine
        // exporting its untouched seed tree). Persisting that would overwrite
        // the real account whose normalized name is "user", so it is dropped
        // here as well as in the store.
        if (!String(user ?? '').trim()) return;
        writeVfs(user, snapshotText);
        io.emit('vfs:snapshot', { user, snapshot: snapshotText });
        // SHELL/FS commands suppress the engine's normal telemetry line, so ask
        // for a fresh snapshot now that the filesystem changed. This is what
        // keeps the GUI's file manager in sync after a terminal `mkdir`/`rm`.
        // `STATE` never mutates the filesystem, so this cannot loop.
        sendCommand("STATE");
    },

    onShellResult: (shellResult) => {
        io.emit('shell:result', {
            command: shellResult.command,
            output: Buffer.from(shellResult.output || '', 'base64').toString('utf-8'),
            cwdId: shellResult.cwdId,
            cwd: shellResult.cwd,
            prompt: shellResult.prompt
                ? Buffer.from(shellResult.prompt, 'base64').toString('utf-8')
                : null
        });
    },

    onCwdResult: (cwdResult) => {
        io.emit('cwd:result', cwdResult);
    },

    onFileSaveResult: (saveResult) => {
        io.emit('file:save_result', saveResult);
    }
});

registerSocketEvents(io);

// Prime initial engine telemetry on startup so REST GET /api/state works immediately
setTimeout(() => sendCommand("STATE"), 500);


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`Backend server successfully running on port ${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`===========================================`);
});


const handleShutdown = () => {
    killEngine();
    process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('uncaughtException', (err) => {
    console.error('[Backend] Uncaught Exception:', err);
    handleShutdown(1);
});