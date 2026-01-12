/**
 * Grok Login API
 * 
 * Opens a browser window for the user to manually login to Grok.
 * Saves the session for future use.
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Force Node.js runtime for Puppeteer (even though we spawn it)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROFILES_DIR = path.join(process.cwd(), 'chrome-profiles');

function createGrokProfile(): string {
    if (!fs.existsSync(PROFILES_DIR)) {
        fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    // Force a fresh clean profile for debugging
    const profileId = `grok-clean-${Date.now()}`;
    fs.mkdirSync(path.join(PROFILES_DIR, profileId), { recursive: true });

    return profileId;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        let profileId = body.profileId;

        // If no profile specified, use the manual profile with exported cookies
        if (!profileId) {
            profileId = 'grok-manual';
        }

        // Run the standalone script
        const scriptPath = path.join(process.cwd(), 'scripts', 'grok-login-runner.js');

        // Spawn node process
        const { spawn } = require('child_process');
        const child = spawn('node', [scriptPath, profileId], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let outputData = '';
        let errorData = '';

        // Collect output
        child.stdout.on('data', (data: any) => {
            outputData += data.toString();
        });

        child.stderr.on('data', (data: any) => {
            console.error(`Grok script stderr: ${data}`);
            errorData += data.toString();
        });

        // Wait for process to complete
        const result: any = await new Promise((resolve) => {
            child.on('close', (code: number) => {
                if (code !== 0) {
                    resolve({ success: false, error: `Process exited with code ${code}` });
                    return;
                }

                try {
                    // Start parsing from last brace to find JSON
                    const lastBrace = outputData.lastIndexOf('}');
                    const firstBrace = outputData.lastIndexOf('{', lastBrace);
                    if (lastBrace !== -1 && firstBrace !== -1) {
                        const jsonStr = outputData.substring(firstBrace, lastBrace + 1);
                        resolve(JSON.parse(jsonStr));
                    } else {
                        resolve({ success: false, error: 'Invalid output from script' });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'Failed to parse script output' });
                }
            });

            // Timeout after 60 minutes (script has 1 hour timeout)
            setTimeout(() => {
                child.kill();
                resolve({ success: false, error: 'Script timeout' });
            }, 60 * 60 * 1000);
        });

        if (result.success) {
            return NextResponse.json({
                ok: true,
                profileId,
                email: result.email,
                message: 'Grok account connected successfully'
            });
        } else {
            return NextResponse.json({
                ok: false,
                error: result.error || 'Login failed'
            }, { status: 400 });
        }
    } catch (error) {
        console.error('Grok login error:', error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : 'Login failed'
        }, { status: 500 });
    }
}
