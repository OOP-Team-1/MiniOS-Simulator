import { sendCommand } from '../engine/processManager.js';
import { startAutoStep, stopAutoStep } from './simulationClock.js';

export function registerSocketEvents(io) {
    io.on('connection', (socket) => {
        console.log(`[Socket.io] Client connected: ${socket.id}`);
        
        sendCommand("STATE");

        socket.on('cmd:step', () => sendCommand("STEP"));
        socket.on('cmd:compact', () => sendCommand("COMPACT"));
        socket.on('cmd:reset', () => sendCommand("RESET"));
        
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