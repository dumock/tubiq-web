const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper to find Chrome on Windows
function findChrome() {
    const suffixes = [
        '\\Google\\Chrome\\Application\\chrome.exe',
        '\\Google\\Chrome Beta\\Application\\chrome.exe',
        '\\Google\\Chrome Canary\\Application\\chrome.exe',
    ];

    const prefixes = [
        process.env.LOCALAPPDATA,
        process.env.PROGRAMFILES,
        process.env['PROGRAMFILES(X86)'],
    ].filter(Boolean);

    for (const prefix of prefixes) {
        for (const suffix of suffixes) {
            const exe = path.join(prefix, suffix);
            if (fs.existsSync(exe)) return exe;
        }
    }
    return null;
}

const profileId = process.argv[2] || 'grok-manual';
const profilePath = path.resolve(__dirname, '..', 'chrome-profiles', profileId);
console.log(`[DEBUG] Login Profile path: ${profilePath}`);

// Ensure profile dir exists
if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
}

// 1. KILL STALE PROCESSES
// We need to kill any Chrome process using this specific user-data-dir
// to ensure the new window opens visibly and isn't swallowed by a background/hidden process.
try {
    const killCmd = `powershell -Command "Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -like '*${profileId}*'} | Stop-Process -Force"`;
    execSync(killCmd, { stdio: 'ignore' });
} catch (e) {
    // Ignore errors (no process found, etc.)
}

const chromePath = findChrome();

if (!chromePath) {
    console.log(JSON.stringify({ success: false, error: 'Could not find Chrome installation' }));
    process.exit(1);
}

try {
    // 2. LAUNCH NEW CHROME DIRECTLY
    // Using spawn detached to ensure it survives and opens a fresh window
    const child = spawn(chromePath, [
        `--user-data-dir=${profilePath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--start-maximized',
        '--ignore-certificate-errors',
        'https://grok.com'
    ], {
        detached: true,
        stdio: 'ignore'
    });

    child.unref();

    console.log(JSON.stringify({
        success: true,
        message: 'Browser launched cleanly (stale processes killed).',
        email: 'Unknown (Manual Login)'
    }));
    process.exit(0);

} catch (e) {
    console.log(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
}
