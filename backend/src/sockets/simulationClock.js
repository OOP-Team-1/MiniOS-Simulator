import { sendCommand } from '../engine/processManager.js';

let autoRunInterval = null;

export function startAutoStep(intervalMs = 1000) {
    if (autoRunInterval) {
        clearInterval(autoRunInterval);
    }
    
    const safeInterval = Math.max(100, parseInt(intervalMs, 10) || 1000);
    
    autoRunInterval = setInterval(() => {
        sendCommand("STEP");
    }, safeInterval);
}

export function stopAutoStep() {
    if (autoRunInterval) {
        clearInterval(autoRunInterval);
        autoRunInterval = null;
    }
}