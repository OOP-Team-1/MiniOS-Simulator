import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const engineDir = path.resolve(__dirname, 'engine');
const buildDir = path.resolve(engineDir, 'build');

function commandAvailable(cmd, testArg = '--version') {
    try {
        const res = spawnSync(cmd, [testArg], { stdio: 'ignore' });
        return res.status === 0;
    } catch {
        return false;
    }
}

function detectGenerator() {
    if (process.platform !== 'win32') {
        return null;
    }

    // 1. Ninja if present
    if (commandAvailable('ninja')) {
        return 'Ninja';
    }

    // 2. MinGW (MSYS2 / UCRT64 / MinGW-w64)
    if (commandAvailable('mingw32-make') || commandAvailable('g++') || commandAvailable('gcc')) {
        return 'MinGW Makefiles';
    }

    // 3. MSVC command prompt
    if (commandAvailable('nmake', '/?')) {
        return 'NMake Makefiles';
    }

    return null;
}

function cleanCache() {
    const cacheFile = path.join(buildDir, 'CMakeCache.txt');
    const cmakeFiles = path.join(buildDir, 'CMakeFiles');
    try {
        if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
        if (fs.existsSync(cmakeFiles)) fs.rmSync(cmakeFiles, { recursive: true, force: true });
    } catch (err) {
        console.warn('[build:engine] Notice: Could not remove old cache files:', err.message);
    }
}

function runCMake() {
    const generator = detectGenerator();
    const configureArgs = ['-B', buildDir, '-S', engineDir];
    if (generator) {
        configureArgs.push('-G', generator);
    }

    console.log(`[build:engine] Configuring C++ engine with CMake${generator ? ` (Generator: ${generator})` : ''}...`);
    let conf = spawnSync('cmake', configureArgs, { stdio: 'inherit' });

    if (conf.status !== 0) {
        console.warn('[build:engine] Initial configure failed. Clearing CMakeCache and retrying with detected generator...');
        cleanCache();
        conf = spawnSync('cmake', configureArgs, { stdio: 'inherit' });
        if (conf.status !== 0) {
            console.error('[build:engine] CMake configuration failed.');
            process.exit(conf.status ?? 1);
        }
    }

    console.log('[build:engine] Compiling C++ engine (Release)...');
    const build = spawnSync('cmake', ['--build', buildDir, '--config', 'Release'], { stdio: 'inherit' });

    if (build.status !== 0) {
        console.error('[build:engine] CMake build failed.');
        process.exit(build.status ?? 1);
    }

    console.log('[build:engine] C++ engine build completed successfully.');
}

runCMake();
