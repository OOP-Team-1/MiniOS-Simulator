import { getLatestTelemetry, sendCommand } from './processManager.js';
import { startAutoStep, stopAutoStep } from '../sockets/simulationClock.js';

function padEnd(value, width) {
    const s = String(value ?? '');
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function formatProcessTable(telemetry) {
    const procs = telemetry?.processes || [];
    if (!procs.length) {
        return 'No processes in the process table.\n';
    }

    let out = padEnd('PID', 8) + padEnd('NAME', 16) + padEnd('STATE', 12)
        + padEnd('PRI', 5) + padEnd('ARR', 5) + padEnd('BURST', 7)
        + padEnd('REM', 5) + 'MEM\n';

    for (const p of procs) {
        const state = String(p.state ?? 'READY').toUpperCase();
        const rem = state === 'TERMINATED' ? 0 : (p.remainingTime ?? p.remaining ?? 0);
        out += padEnd(p.pid, 8) + padEnd(p.name, 16) + padEnd(state, 12)
            + padEnd(p.priority, 5) + padEnd(p.arrivalTime, 5)
            + padEnd(p.burstTime, 7) + padEnd(rem, 5)
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
    'ps', 'top', 'mem', 'free', 'spawn', 'kill', 'remove', 'rmproc', 'step', 'tick', 'run', 'pause', 'reset'
]);

export function isKernelCommand(commandLine) {
    const first = String(commandLine ?? '').trim().split(/\s+/)[0]?.toLowerCase();
    return KERNEL_VERBS.has(first);
}

export function handleKernelCommand(commandLine) {
    const line = String(commandLine ?? '').trim();
    if (!line) return { handled: false };

    const tokens = line.split(/\s+/);
    const cmd = tokens[0].toLowerCase();
    if (!KERNEL_VERBS.has(cmd)) return { handled: false };

    switch (cmd) {
        case 'ps':
        case 'top': {
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
                return { handled: true, output: 'spawn: usage: spawn <name> [priority] [arrival] [burst] [memory] [weight]\n' };
            }
            const priority = parseInt(tokens[2], 10) || 1;
            const arrival = parseInt(tokens[3], 10) || 0;
            const burst = parseInt(tokens[4], 10) || 5;
            const memory = parseInt(tokens[5], 10) || 10;
            const weight = Math.min(100, Math.max(1, parseInt(tokens[6], 10) || 10));

            sendCommand(`ADD ${name} ${priority} ${arrival} ${burst} ${memory} ${weight}`);
            return {
                handled: true,
                output: `Spawned process '${name}' (priority ${priority}, burst ${burst}, memory ${memory}, weight ${weight}).\n`
            };
        }

        case 'kill': {
            const pid = String(tokens[1] ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
            if (!pid) {
                return { handled: true, output: 'kill: usage: kill <pid>\n' };
            }
            sendCommand(`KILL ${pid}`);
            return { handled: true, output: `Terminated process ${pid}.\n` };
        }

        case 'remove':
        case 'rmproc': {
            const pid = String(tokens[1] ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
            if (!pid) {
                return { handled: true, output: 'remove: usage: remove <pid>\n' };
            }
            sendCommand(`KILL ${pid}`);
            sendCommand(`REMOVE ${pid}`);
            return { handled: true, output: `Removed process ${pid} from process table.\n` };
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