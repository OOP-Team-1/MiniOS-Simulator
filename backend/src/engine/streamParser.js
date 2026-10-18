import readline from 'readline';

// Reads the engine's stdout, which mixes two shapes of output:
//   * Multi-line pretty-printed telemetry JSON (one object spread over many
//     lines).
//   * Single-line result objects (READ_RESULT, SHELL_RESULT, FS_EXPORT, ...).
//
// Because telemetry spans several lines, we accumulate lines into `buffer` and
// try to JSON.parse the whole thing after every line. Only once it parses do we
// classify it by `type` and hand it to the matching callback. This mirrors how
// the browser's fetch/JSON handling treats a complete object, and it means a
// half-written telemetry frame is never dispatched.
export function createStreamParser(stdout, handlers = {}) {
    const rl = readline.createInterface({
        input: stdout,
        terminal: false
    });

    let buffer = '';

    const dispatch = (parsed) => {
        switch (parsed.type) {
            case 'READ_RESULT':
                handlers.onReadResult?.(parsed);
                break;
            case 'SHELL_RESULT':
                handlers.onShellResult?.(parsed);
                break;
            case 'CWD_RESULT':
                handlers.onCwdResult?.(parsed);
                break;
            case 'FS_EXPORT':
                handlers.onFsExport?.(parsed);
                break;
            case 'FILE_SAVE_RESULT':
                handlers.onFileSaveResult?.(parsed);
                break;
            case 'ERROR':
                handlers.onEngineError?.(parsed);
                break;
            default:
                // Anything without a recognised type is telemetry.
                handlers.onTelemetry?.(parsed);
        }
    };

    rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        buffer += (buffer ? '\n' : '') + line;

        try {
            const parsed = JSON.parse(buffer);
            buffer = '';
            dispatch(parsed);
        } catch (err) {
            // Buffer is probably an incomplete multiline JSON object. Keep
            // accumulating, but bail out (with a diagnostic) if it grows past a
            // safe bound — a never-closing frame would otherwise leak memory.
            if (buffer.length > 5 * 1024 * 1024) {
                handlers.onError?.({ message: err.message, raw: buffer.slice(0, 200) });
                buffer = '';
            }
        }
    });
}
