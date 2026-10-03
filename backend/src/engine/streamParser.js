import readline from 'readline';

export function createStreamParser(stdout, onTelemetry) {
    // Create an interface to read the stream line-by-line
    const rl = readline.createInterface({
        input: stdout,
        terminal: false
    });

    // Fire the event every time a complete line (terminated by \n) is received
    rl.on('line', (line) => {
        try {
            const telemetry = JSON.parse(line);
            onTelemetry(telemetry);
        } catch (err) {
            console.error("[StreamParser] JSON Parse Error:", err.message);
            console.error("[StreamParser] Raw Output received:", line);
        }
    });
}