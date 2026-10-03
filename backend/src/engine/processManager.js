import { spawn } from 'child_process';
import { ENGINE_BINARY_PATH } from '../config/paths.js';
import { createStreamParser } from './streamParser.js';

let engineProcess = null;
let lastTelemetry = null;
let telemetryCallback = null;
let errorCallback = null;
let isShuttingDown = false;
let restartCallback = null;

export function getLatestTelemetry() {
    return lastTelemetry;
}

export function startEngine(onTelemetry, onError, onRestart) {
    if (onTelemetry) telemetryCallback = onTelemetry;
    if (onError) errorCallback = onError;
    if (onRestart)   restartCallback    = onRestart;
    
    if (engineProcess && !engineProcess.killed) {
        console.warn("Engine is already running.");
        return;
    }

    isShuttingDown = false;
    engineProcess = spawn(ENGINE_BINARY_PATH);

    createStreamParser(engineProcess.stdout, (telemetry) => {
        lastTelemetry = telemetry;
        if (telemetryCallback) telemetryCallback(telemetry);
        },
        (errorData) => {
            if (errorCallback) errorCallback(errorData);
        }
    );

    engineProcess.stderr.on('data', () => {});

    engineProcess.on('error', () => {
        engineProcess = null;
        if (!isShuttingDown) {
            setTimeout(() => startEngine(), 1000);
        }
    });

    engineProcess.on('close', (code) => {
        console.log(`[Engine] Process exited with code ${code}`);
        engineProcess = null;
        if (!isShuttingDown) {
            if (restartCallback) restartCallback();
            setTimeout(() => startEngine(), 1000);
        }
    });
    engineProcess.on('error', () => {
        engineProcess = null;
        if (!isShuttingDown) {
            if (restartCallback) restartCallback();
            setTimeout(() => startEngine(), 1000);
        }
    });
}

export function sendCommand(cmd) {
    if (engineProcess && !engineProcess.killed && engineProcess.stdin) {
        engineProcess.stdin.write(`${cmd}\n`);
    }
}

export function killEngine() {
    isShuttingDown = true;
    if (engineProcess && !engineProcess.killed) {
        sendCommand("EXIT");
        engineProcess.kill();
        engineProcess = null;
    }
}