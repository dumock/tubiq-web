/**
 * Grok Image Generation API
 * 
 * Generate images from text prompts using Grok Imagine via browser automation.
 * Uses child process to avoid Turbopack bundling puppeteer (Windows symlink issues).
 */

import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getSupabaseServer } from '@/lib/supabase-server';

// Check if Grok account is connected (without launching browser)
// Check if Grok account is connected (without launching browser)
function isGrokConnected(profileId: string): boolean {
    const profilesDir = path.join(process.cwd(), 'chrome-profiles');

    // For manual profile, just check if directory exists (login state is managed by Chrome)
    if (profileId === 'grok-manual') {
        return fs.existsSync(path.join(profilesDir, profileId));
    }

    const cookiesPath = path.join(profilesDir, profileId, 'cookies.json');
    return fs.existsSync(cookiesPath);
}

// Get first connected Grok profile
function getConnectedProfile(): string | null {
    const profilesDir = path.join(process.cwd(), 'chrome-profiles');
    if (!fs.existsSync(profilesDir)) return null;

    // Priority 1: Check for manual profile first
    if (fs.existsSync(path.join(profilesDir, 'grok-manual'))) {
        return 'grok-manual';
    }

    // Priority 2: Check legacy cookie-based profiles
    const profiles = fs.readdirSync(profilesDir).filter(name => name.startsWith('grok-'));
    for (const profileId of profiles) {
        if (profileId === 'grok-manual') continue; // Already checked
        const cookiesPath = path.join(profilesDir, profileId, 'cookies.json');
        if (fs.existsSync(cookiesPath)) {
            return profileId;
        }
    }
    return null;
}

export async function POST(request: Request) {
    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ ok: false, error: 'Prompt is required' }, { status: 400 });
        }

        const supabase = getSupabaseServer(false);

        // 1. Insert into image_queue
        const { data: job, error: insertError } = await supabase
            .from('image_queue')
            .insert({ prompt, status: 'pending' })
            .select()
            .single();

        if (insertError) {
            console.error('Failed to queue image job:', insertError);
            return NextResponse.json({ ok: false, error: 'Failed to queue job' }, { status: 500 });
        }

        console.log(`[API] Queued image job ${job.id}. Polling for completion...`);

        // 2. Poll for completion (Internal for UI compatibility)
        const maxWait = 120 * 1000; // Increased to 120 seconds for safety
        const start = Date.now();
        let finalJob = job;

        while (Date.now() - start < maxWait) {
            const { data: pollJob } = await supabase
                .from('image_queue')
                .select('*')
                .eq('id', job.id)
                .single();

            if (pollJob && pollJob.status === 'completed') {
                finalJob = pollJob;
                break;
            } else if (pollJob && pollJob.status === 'failed') {
                return NextResponse.json({ ok: false, error: pollJob.error_message || 'Generation failed' }, { status: 500 });
            }

            await new Promise(r => setTimeout(r, 1500));
        }

        if (finalJob.status !== 'completed' || !finalJob.selected_image_url) {
            return NextResponse.json({ ok: false, error: 'Timed out waiting for worker' }, { status: 504 });
        }

        return NextResponse.json({
            ok: true,
            imageUrl: finalJob.selected_image_url,
            allImageUrls: finalJob.image_urls,
            source: 'grok'
        });

    } catch (error) {
        console.error('Grok image generation error:', error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : 'Image generation failed'
        }, { status: 500 });
    }
}
