import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const PID_FILE = path.join(process.cwd(), '.worker.pid');

function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0); // Check signal 0
        return true;
    } catch (e) {
        return false;
    }
}

export async function POST(req: Request) {
    try {
        const { action } = await req.json();

        if (action === 'status') {
            if (fs.existsSync(PID_FILE)) {
                const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
                if (isProcessRunning(pid)) {
                    return NextResponse.json({ running: true, pid });
                } else {
                    // Stale PID file
                    fs.unlinkSync(PID_FILE);
                }
            }
            return NextResponse.json({ running: false });
        }

        if (action === 'start') {
            if (fs.existsSync(PID_FILE)) {
                const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
                if (isProcessRunning(pid)) {
                    return NextResponse.json({ success: false, message: 'Worker already running', pid });
                }
            }

            const scriptPath = path.join(process.cwd(), 'scripts', 'grok', 'worker-daemon.js');
            console.log('[API] Spawning modular worker:', scriptPath);

            // Spawn detached
            const child = spawn('node', [scriptPath], {
                detached: true,
                stdio: 'ignore', // or 'inherit' for debug, but 'ignore' for true background
                cwd: process.cwd()
            });

            child.unref(); // Allow parent to exit independently

            if (child.pid) {
                fs.writeFileSync(PID_FILE, child.pid.toString());
                return NextResponse.json({ success: true, pid: child.pid });
            } else {
                return NextResponse.json({ success: false, message: 'Failed to spawn process' }, { status: 500 });
            }
        }

        if (action === 'stop') {
            if (fs.existsSync(PID_FILE)) {
                const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
                try {
                    process.kill(pid); // SIGTERM
                    // Maybe SIGKILL if it doesn't listen?
                    // process.kill(pid, 'SIGKILL');
                } catch (e) {
                    console.error('Failed to kill process:', e);
                }
                fs.unlinkSync(PID_FILE);
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ success: false, message: 'No worker running' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
