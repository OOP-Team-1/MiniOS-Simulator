import { sendCommand } from '../engine/processManager.js';

let autoRunInterval = null;

export function startAutoStep(intervalMs = 1000) {
    // Prevent multiple overlapping intervals
    if (autoRunInterval) {
        clearInterval(autoRunInterval);
    }
    
    // Automatically send the STEP command to the C++ engine every X milliseconds
    autoRunInterval = setInterval(() => {
        sendCommand("STEP");
    }, intervalMs);
    
    console.log(`[Simulation Clock] Auto-stepping started at ${intervalMs}ms`);
}

export function stopAutoStep() {
    if (autoRunInterval) {
        clearInterval(autoRunInterval);
        autoRunInterval = null;
        console.log("[Simulation Clock] Auto-stepping paused");
    }
}