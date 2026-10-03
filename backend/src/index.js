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