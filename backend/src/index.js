import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import healthRoutes from './routes/healthRoutes.js';
import simulationRoutes from './routes/simulationRoutes.js';
import { startEngine, killEngine } from './engine/processManager.js';
import { registerSocketEvents } from './sockets/socketHandler.js';

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

// Boot the C++ Engine
// We pass a callback function that will be triggered every time streamParser.js outputs valid JSON
console.log("Initializing OS Simulator Backend...");
startEngine(
    (telemetry) => {
        io.emit('telemetry:update', telemetry);
    },
    (errorData) => {
        io.emit('engine:error', errorData);
    },
    () => {
        io.emit('engine:restarted', {
            message: 'Engine crashed and is restarting. State has been reset.',
            timestamp: new Date().toISOString()
        });
    },
    (readResult) => {
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
    (engineError) => {
        // engineError: { type: "ERROR", message }
        // Raised when a command threw inside the engine (e.g. bad process params). The engine process itself stays alive.
        io.emit('engine:command_error', {
            message: engineError.message,
            timestamp: new Date().toISOString()
        });
    }
);

registerSocketEvents(io);

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
process.on('uncaughtException', handleShutdown);