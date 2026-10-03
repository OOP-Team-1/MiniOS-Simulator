import readline from 'readline';

export function createStreamParser(stdout, onTelemetry, onError) {
    const rl = readline.createInterface({
        input: stdout,
        terminal: false
    });

    rl.on('line', (line) => {
        try {
            const telemetry = JSON.parse(line);
            onTelemetry(telemetry);
        } catch (err) {
            if (onError) {
                onError({ message: err.message, raw: line });
            }
        }
    });
}