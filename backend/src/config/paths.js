import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
    path.resolve(__dirname, '../../../engine/build/main.exe'),
    path.resolve(__dirname, '../../../engine/build/Debug/main.exe'),
    path.resolve(__dirname, '../../../engine/build/Release/main.exe'),
    path.resolve(__dirname, '../../../engine/build/main') // Linux / macOS fallback
];

// Added .exe for Windows compatibility
export const ENGINE_BINARY_PATH = candidates.find(p => fs.existsSync(p)) || candidates[0];