import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Import our custom modules
import healthRoutes from './routes/healthRoutes.js';
import { startEngine, killEngine } from './engine/processManager.js';
import { registerSocketEvents } from './sockets/socketHandler.js';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// REST Routes
app.use('/api', healthRoutes);

// WebSockets Setup
// Configure CORS to allow connections from Vite's default dev server port (5173)
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Boot the C++ Engine
// We pass a callback function that will be triggered every time streamParser.js outputs valid JSON
console.log("Initializing OS Simulator Backend...");
startEngine((telemetry) => {
    // Broadcast the parsed JSON state to all connected React clients
    io.emit('telemetry:update', telemetry);
});

// Register all UI socket listeners
registerSocketEvents(io);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`Backend server successfully running on port ${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`===========================================`);
});

// Graceful Shutdown: Clean up the C++ process when Node is stopped (e.g., via Ctrl+C)
const handleShutdown = () => {
    console.log("\n[Server] Shutting down. Cleaning up C++ engine...");
    killEngine();
    process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);