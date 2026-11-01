import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
    path.resolve(__dirname, '../../../engine/build/Release/main.exe'),
    path.resolve(__dirname, '../../../engine/build/Debug/main.exe'),
    path.resolve(__dirname, '../../../engine/build/main.exe'),
    path.resolve(__dirname, '../../../engine/build/main')
];

const existing = candidates
    .filter((p) => fs.existsSync(p))
    .sort((a, b) => {
        try {
            return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
        } catch {
            return 0;
        }
    });

export const ENGINE_BINARY_PATH = existing[0] || (process.platform === 'win32' ? candidates[2] : candidates[3]);