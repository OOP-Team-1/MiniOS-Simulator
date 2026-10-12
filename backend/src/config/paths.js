import fs from 'fs';

// Hardcode the exact Windows path to the executable
export const ENGINE_BINARY_PATH = "C:\\Users\\marri\\Downloads\\MiniOS-Simulator\\engine\\build\\minios_engine.exe";

if (!fs.existsSync(ENGINE_BINARY_PATH)) {
    console.error(`\nCRITICAL ERROR: Engine not found at ${ENGINE_BINARY_PATH}`);
    console.error("Please verify you compiled it successfully.\n");
}