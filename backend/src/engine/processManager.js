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

    engineProcess.stderr.on('data', (chunk) => {
        console.error(`[Engine stderr] ${chunk.toString()}`);
    });


    engineProcess.on('error', (err) => {
        console.error(`[Engine] Process error: ${err.message}`);
    });

    engineProcess.on('close', (code) => {
        console.log(`[Engine] Process exited with code ${code}`);
        engineProcess = null;
        if (!isShuttingDown && !isRestarting) {
            if (restartCallback) restartCallback();
            setTimeout(() => startEngine(), 1000);
        }
    });

}

export function sendCommand(cmd) {
    if (engineProcess && engineProcess.stdin && engineProcess.stdin.writable) {
        try {
            engineProcess.stdin.write(`${cmd}\n`);
        } catch (err) {
            console.error(`[Engine] Stdin write error: ${err.message}`);
        }
    }
}

export function triggerRestart() {
    if (isRestarting || isShuttingDown) return;
    isRestarting = true;
    if (engineProcess) {
        engineProcess.kill();
        engineProcess = null;
    }
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