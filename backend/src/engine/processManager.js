import { spawn } from 'child_process';
import { ENGINE_BINARY_PATH } from '../config/paths.js';
import { createStreamParser } from './streamParser.js';

let engineProcess = null;
let lastTelemetry = null;
let telemetryCallback = null;
let errorCallback = null;
let readResultCallback = null;
let engineErrorCallback = null;
let isShuttingDown = false;
let restartCallback = null;
let isRestarting = false;

export function getLatestTelemetry() {
    return lastTelemetry;
}

export function startEngine(onTelemetry, onError, onRestart, onReadResult, onEngineError) {
    if (onTelemetry) telemetryCallback = onTelemetry;
    if (onError) errorCallback = onError;
    if (onRestart)   restartCallback    = onRestart;
    if (onReadResult) readResultCallback = onReadResult;
    if (onEngineError) engineErrorCallback = onEngineError;

    if (engineProcess && !engineProcess.killed) {
        console.warn("Engine is already running.");
        return;
    }

    isShuttingDown = false;
    engineProcess = spawn(ENGINE_BINARY_PATH);

    createStreamParser(engineProcess.stdout,
        (telemetry) => {
            lastTelemetry = telemetry;
            if (telemetryCallback) telemetryCallback(telemetry);
        },
        (errorData) => {
            if (errorCallback) errorCallback(errorData);
        },
        (readResult) => {
            if (readResultCallback) readResultCallback(readResult);
        },
        (engineError) => {
            if (engineErrorCallback) engineErrorCallback(engineError);
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
}

export function sendCommand(cmd) {
    if (engineProcess && !engineProcess.killed && engineProcess.stdin) {
        engineProcess.stdin.write(`${cmd}\n`);
    }
}

export function triggerRestart() {
    if (isRestarting || isShuttingDown) return;
    isRestarting = true;
    if (restartCallback) restartCallback();
    setTimeout(() => {
        isRestarting = false;
        startEngine();
    }, 1000);
}

export function killEngine() {
    isShuttingDown = true;
    if (engineProcess && !engineProcess.killed) {
        sendCommand("EXIT");
        engineProcess.kill();
        engineProcess = null;
    }
}