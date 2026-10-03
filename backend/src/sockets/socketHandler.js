import { sendCommand } from '../engine/processManager.js';
import { startAutoStep, stopAutoStep } from './simulationClock.js';

export function registerSocketEvents(io) {
    io.on('connection', (socket) => {
        console.log(`[Socket.io] Client connected: ${socket.id}`);
        
        // Immediately fetch the current state so the UI can render on initial load
        sendCommand("STATE");

        // Map UI manual execution commands directly to C++ standard input
        socket.on('cmd:step', () => sendCommand("STEP"));
        socket.on('cmd:compact', () => sendCommand("COMPACT"));
        socket.on('cmd:reset', () => sendCommand("RESET"));
        
        // Handle dynamic process creation
        socket.on('cmd:add_process', (data) => {
            const { name, priority, arrival, burst, memory } = data;
            // Formats: ADD <name> <priority> <arrival> <burst> <memory>
            sendCommand(`ADD ${name} ${priority} ${arrival} ${burst} ${memory}`);
        });

        // Map UI playback controls to the Node.js interval timer
        socket.on('timer:start', ({ intervalMs }) => startAutoStep(intervalMs));
        socket.on('timer:pause', () => stopAutoStep());
        socket.on('timer:set_speed', ({ intervalMs }) => startAutoStep(intervalMs));

        socket.on('disconnect', () => {
            console.log(`[Socket.io] Client disconnected: ${socket.id}`);
            // Optional: Pause auto-stepping if no clients are connected
            if (io.engine.clientsCount === 0) {
                stopAutoStep();
            }
        });
    });
}