/**
 * Grok Video Generation API
 * 
 * Generate video from image using Grok Imagine via browser automation.
 */

import { NextResponse } from 'next/server';
import { GrokAutomation, getGrokAccounts } from '@/lib/grok-automation';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for video storage
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { imageUrl, motionPrompt, sceneId, profileId } = await request.json();

        if (!imageUrl) {
            return NextResponse.json(
                { ok: false, error: 'Image URL is required' },
                { status: 400 }
            );
        }

        // Find an available Grok account
        let targetProfileId = profileId;

        if (!targetProfileId) {
            const accounts = await getGrokAccounts();
            const connectedAccount = accounts.find(a => a.connected);

            if (!connectedAccount) {
                return NextResponse.json({
                    ok: false,
                    error: 'No Grok account connected. Please connect your Grok account first.',
                    needsLogin: true
                }, { status: 401 });
            }

            targetProfileId = connectedAccount.id;
        }

        // Generate video using Grok automation
        const automation = new GrokAutomation(targetProfileId);
        const result = await automation.generateVideo(imageUrl, motionPrompt);

        if (!result.success || !result.videoUrl) {
            return NextResponse.json({
                ok: false,
                error: result.error || 'Video generation failed',
                needsLogin: result.error?.includes('Session expired')
            }, { status: 500 });
        }

        // Upload video to Supabase Storage
        let finalVideoUrl = result.videoUrl;

        try {
            // Download video from Grok
            const videoResponse = await fetch(result.videoUrl);
            if (videoResponse.ok) {
                const videoBuffer = await videoResponse.arrayBuffer();
                const fileName = `grok-video-${Date.now()}.mp4`;

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('videos')
                    .upload(`storyboard/${fileName}`, Buffer.from(videoBuffer), {
                        contentType: 'video/mp4',
                        upsert: true
                    });

                if (!uploadError && uploadData) {
                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('videos')
                        .getPublicUrl(`storyboard/${fileName}`);

                    finalVideoUrl = publicUrl;
                }
            }
        } catch (uploadError) {
            console.error('Failed to upload to Supabase, using Grok URL:', uploadError);
            // Keep using the Grok URL if upload fails
        }

        return NextResponse.json({
            ok: true,
            success: true,
            videoUrl: finalVideoUrl,
            sceneId,
            source: 'grok'
        });

    } catch (error) {
        console.error('Grok video generation error:', error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : 'Video generation failed'
        }, { status: 500 });
    }
}
