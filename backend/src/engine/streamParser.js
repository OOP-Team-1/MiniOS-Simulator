import readline from 'readline';

export function createStreamParser(stdout, onTelemetry, onError, onReadResult, onEngineError) {
    const rl = readline.createInterface({
        input: stdout,
        terminal: false
    });

    let buffer = '';

    rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        buffer += (buffer ? '\n' : '') + line;

        try {
            const parsed = JSON.parse(buffer);
            buffer = '';

            if (parsed.type === 'READ_RESULT') {
                if (onReadResult) onReadResult(parsed);
            }else if (parsed.type === 'ERROR') {
                if (onEngineError) onEngineError(parsed);
            } else {
                onTelemetry(parsed);
            }
        } catch (err) {
            // Buffer may be an incomplete multiline JSON object, continue accumulating.
            // Discard if buffer exceeds safe size to prevent memory leaks.
            if (buffer.length > 5 * 1024 * 1024) {
                if (onError) {
                    onError({ message: err.message, raw: buffer.slice(0, 200) });
                }
                buffer = '';
            }
        }
    });
}