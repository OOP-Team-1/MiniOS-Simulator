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

function getCMakeCommand() {
    if (commandAvailable('cmake')) {
        return 'cmake';
    }

    // On Linux without cmake (such as standard Render native environment), auto-fetch portable binary
    if (process.platform === 'linux' && process.arch === 'x64') {
        const localCmakeDir = path.resolve(__dirname, '.cmake');
        const localCmakeBin = path.join(localCmakeDir, 'bin', 'cmake');

        if (fs.existsSync(localCmakeBin)) {
            return localCmakeBin;
        }

        console.log('[build:engine] CMake not found in PATH. Auto-downloading portable CMake for Linux...');
        try {
            fs.mkdirSync(localCmakeDir, { recursive: true });
            const tarUrl = 'https://github.com/Kitware/CMake/releases/download/v3.28.3/cmake-3.28.3-linux-x86_64.tar.gz';
            const res = spawnSync('sh', ['-c', `curl -sL "${tarUrl}" | tar -xz --strip-components=1 -C "${localCmakeDir}"`], {
                stdio: 'inherit'
            });

            if (res.status === 0 && fs.existsSync(localCmakeBin)) {
                console.log('[build:engine] Portable CMake downloaded successfully.');
                return localCmakeBin;
            }
        } catch (err) {
            console.warn('[build:engine] Failed to auto-download CMake:', err.message);
        }
    }

    return 'cmake';
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
    const cmakeCmd = getCMakeCommand();
    const generator = detectGenerator();
    const configureArgs = ['-B', buildDir, '-S', engineDir];
    if (generator) {
        configureArgs.push('-G', generator);
    }

    console.log(`[build:engine] Configuring C++ engine with ${cmakeCmd}${generator ? ` (Generator: ${generator})` : ''}...`);
    let conf = spawnSync(cmakeCmd, configureArgs, { stdio: 'inherit' });

    if (conf.status !== 0) {
        console.warn('[build:engine] Initial configure failed. Clearing CMakeCache and retrying with detected generator...');
        cleanCache();
        conf = spawnSync(cmakeCmd, configureArgs, { stdio: 'inherit' });
        if (conf.status !== 0) {
            console.error('[build:engine] CMake configuration failed.');
            process.exit(conf.status ?? 1);
        }
    }

    console.log('[build:engine] Compiling C++ engine (Release)...');
    const build = spawnSync(cmakeCmd, ['--build', buildDir, '--config', 'Release'], { stdio: 'inherit' });

    if (build.status !== 0) {
        console.error('[build:engine] CMake build failed.');
        process.exit(build.status ?? 1);
    }

    // On Linux/Unix, ensure the compiled binary has executable permissions
    const linuxBin = path.join(buildDir, 'main');
    if (process.platform !== 'win32' && fs.existsSync(linuxBin)) {
        try {
            fs.chmodSync(linuxBin, 0o755);
        } catch {}
    }

    console.log('[build:engine] C++ engine build completed successfully.');
}

runCMake();
