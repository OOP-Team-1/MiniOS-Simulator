import { spawn } from 'child_process';
import { ENGINE_BINARY_PATH } from '../config/paths.js';
import { createStreamParser } from './streamParser.js';

let engineProcess = null;
let lastTelemetry = null;

export function getLatestTelemetry() {
    return lastTelemetry;
}

export function startEngine(onTelemetry) {
    if (engineProcess && !engineProcess.killed) {
        console.warn("Engine is already running.");
        return;
    }

    console.log(`Starting C++ engine from: ${ENGINE_BINARY_PATH}`);
    
    // Spawn the C++ executable
    engineProcess = spawn(ENGINE_BINARY_PATH);

    // Attach our custom stream parser to safely read JSON lines
    createStreamParser(engineProcess.stdout, (telemetry) => {
        lastTelemetry = telemetry;
        onTelemetry(telemetry);
    });

    // Route C++ std::cerr directly to the Node console
    engineProcess.stderr.on('data', (data) => {
        console.warn(`[Engine Log] ${data}`);
    });

    engineProcess.on('error', (err) => {
        console.error(`[Engine Error] Failed to start process: ${err.message}`);
        engineProcess = null;
    });

    engineProcess.on('close', (code) => {
        console.log(`[Engine] Process exited with code ${code}`);
        engineProcess = null;
    });
}

export function sendCommand(cmd) {
    if (engineProcess && !engineProcess.killed && engineProcess.stdin) {
        // C++ expects line-delimited commands, so we append the newline character
        engineProcess.stdin.write(`${cmd}\n`);
    } else {
        console.error("[Engine Error] Cannot send command. Engine is not running.");
    }
}

export function killEngine() {
    if (engineProcess && !engineProcess.killed) {
        // Send the graceful exit command supported by main.cpp
        sendCommand("EXIT");
        engineProcess.kill();
        engineProcess = null;
    }
}