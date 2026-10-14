import readline from 'readline';

export function createStreamParser(stdout, onTelemetry, onError, onReadResult, onEngineError) {
    const rl = readline.createInterface({
        input: stdout,
        terminal: false
    });

    rl.on('line', (line) => {
        try {
            const parsed = JSON.parse(line);

            if (parsed.type === 'READ_RESULT') {
                if (onReadResult) onReadResult(parsed);
            }else if (parsed.type === 'ERROR') {
                if (onEngineError) onEngineError(parsed);
            } else {
                onTelemetry(parsed);
            }
        } catch (err) {
            if (onError) {
                onError({ message: err.message, raw: line });
            }
        }
    });
}