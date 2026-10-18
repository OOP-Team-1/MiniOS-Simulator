import { getLatestTelemetry, sendCommand } from './processManager.js';
import { startAutoStep, stopAutoStep } from '../sockets/simulationClock.js';

// ---------------------------------------------------------------------------
// Kernel command bridge
//
// The desktop terminal speaks two languages:
//   * filesystem commands (ls, cd, mkdir, cat, ...), which the C++ CommandPrompt
//     owns and which are forwarded as `SHELL <b64cmd>`;
//   * kernel/process commands (ps, mem, spawn, kill, step, run, pause, reset),
//     which the simulator's operating-system layer owns.
//
// CommandPrompt deliberately does not implement the kernel verbs, so we
// intercept them here and translate them onto the existing engine protocol
// commands (ADD/KILL/STEP/RESET) plus the backend auto-step clock — exactly the
// same protocol the GUI's socket handlers already use. Everything else returns
// { handled: false } and is forwarded to the real shell.
//
// `ps`/`mem` render from the most recent telemetry snapshot. Mutation commands
// are acknowledged immediately; the authoritative state update arrives moments
// later through the normal telemetry stream.
// ---------------------------------------------------------------------------

function padEnd(value, width) {
    const s = String(value ?? '');
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function formatProcessTable(telemetry) {
    const procs = telemetry?.processes || [];
    if (!procs.length) {
        return 'No processes running.\n';
    }

    let out = padEnd('PID', 8) + padEnd('NAME', 16) + padEnd('STATE', 12)
        + padEnd('PRI', 5) + padEnd('ARR', 5) + padEnd('BURST', 7)
        + padEnd('REM', 5) + 'MEM\n';

    for (const p of procs) {
        out += padEnd(p.pid, 8) + padEnd(p.name, 16) + padEnd(p.state, 12)
            + padEnd(p.priority, 5) + padEnd(p.arrivalTime, 5)
            + padEnd(p.burstTime, 7) + padEnd(p.remainingTime, 5)
            + String(p.memoryRequired ?? 0) + '\n';
    }
    return out;
}

function formatMemory(telemetry) {
    const mem = telemetry?.memory;
    if (!mem) {
        return 'Memory information is not available yet.\n';
    }
    return `Total: ${mem.totalMemory}   Used: ${mem.usedMemory}   `
        + `Free: ${mem.freeMemory}   External fragmentation: ${mem.externalFragmentation}\n`;
}

const KERNEL_VERBS = new Set([
    'ps', 'top', 'mem', 'free', 'spawn', 'kill', 'step', 'tick', 'run', 'pause', 'reset'
]);

// Returns true when the first token names a kernel command.
export function isKernelCommand(commandLine) {
    const first = String(commandLine ?? '').trim().split(/\s+/)[0]?.toLowerCase();
    return KERNEL_VERBS.has(first);
}

// Returns { handled: boolean, output?: string }. When `handled` is false the
// caller should forward the raw line to the engine's SHELL command.
export function handleKernelCommand(commandLine) {
    const line = String(commandLine ?? '').trim();
    if (!line) return { handled: false };

    const tokens = line.split(/\s+/);
    const cmd = tokens[0].toLowerCase();
    if (!KERNEL_VERBS.has(cmd)) return { handled: false };

    switch (cmd) {
        case 'ps':
        case 'top': {
            // Refresh so a repeat `ps` reflects process changes promptly.
            sendCommand('STATE');
            return { handled: true, output: formatProcessTable(getLatestTelemetry()) };
        }

        case 'mem':
        case 'free': {
            sendCommand('STATE');
            return { handled: true, output: formatMemory(getLatestTelemetry()) };
        }

        case 'spawn': {
            const name = String(tokens[1] ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
            if (!name) {
                return { handled: true, output: 'spawn: usage: spawn <name> [priority] [arrival] [burst] [memory]\n' };
            }
            const priority = parseInt(tokens[2], 10) || 1;
            const arrival = parseInt(tokens[3], 10) || 0;
            const burst = parseInt(tokens[4], 10) || 5;
            const memory = parseInt(tokens[5], 10) || 10;

            sendCommand(`ADD ${name} ${priority} ${arrival} ${burst} ${memory}`);
            return {
                handled: true,
                output: `Spawned process '${name}' (priority ${priority}, burst ${burst}, memory ${memory}).\n`
            };
        }

        case 'kill': {
            const pid = String(tokens[1] ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
            if (!pid) {
                return { handled: true, output: 'kill: usage: kill <pid>\n' };
            }
            sendCommand(`KILL ${pid}`);
            return { handled: true, output: `Sent KILL to ${pid}.\n` };
        }

        case 'step':
        case 'tick': {
            sendCommand('STEP');
            return { handled: true, output: 'Stepped simulation by one tick.\n' };
        }

        case 'run': {
            const intervalMs = parseInt(tokens[1], 10) || undefined;
            stopAutoStep();
            startAutoStep(intervalMs);
            return { handled: true, output: 'Simulation running.\n' };
        }

        case 'pause': {
            stopAutoStep();
            return { handled: true, output: 'Simulation paused.\n' };
        }

        case 'reset': {
            stopAutoStep();
            sendCommand('RESET');
            return { handled: true, output: 'Simulation reset.\n' };
        }

        default:
            return { handled: false };
    }
}
