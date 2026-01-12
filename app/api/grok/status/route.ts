/**
 * Grok Status API
 * 
 * Check connection status of Grok accounts.
 * Simplified version that checks file system directly.
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const PROFILES_DIR = path.join(process.cwd(), 'chrome-profiles');

// GET - Get all Grok accounts and their status
export async function GET() {
    try {
        const accounts: any[] = [];

        // Check if profiles directory exists
        if (fs.existsSync(PROFILES_DIR)) {
            const profiles = fs.readdirSync(PROFILES_DIR).filter(
                name => name.startsWith('grok-')
            );

            for (const profileId of profiles) {
                const profilePath = path.join(PROFILES_DIR, profileId);
                const cookiesPath = path.join(profilePath, 'cookies.json');

                // For manual profile, existence of directory is enough (managed by Chrome)
                // For others, we still check for the legacy cookies.json
                const isManual = profileId === 'grok-manual';
                const hasConnectedIndicator = isManual ? fs.existsSync(profilePath) : fs.existsSync(cookiesPath);

                accounts.push({
                    id: profileId,
                    name: isManual ? 'Grok Manual (Chrome)' : (hasConnectedIndicator ? 'Connected' : profileId),
                    connected: hasConnectedIndicator
                });
            }
        }

        return NextResponse.json({
            ok: true,
            accounts,
            hasConnectedAccount: accounts.some(a => a.connected)
        });
    } catch (error) {
        console.error('Grok status error:', error);
        return NextResponse.json({
            ok: true,
            accounts: [],
            hasConnectedAccount: false,
            error: error instanceof Error ? error.message : 'Failed to get status'
        });
    }
}
