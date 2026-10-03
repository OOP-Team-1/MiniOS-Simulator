import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Added .exe for Windows compatibility
export const ENGINE_BINARY_PATH = path.resolve(__dirname, '../../../engine/build/main.exe');