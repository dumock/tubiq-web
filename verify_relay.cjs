const { createClient } = require('@supabase/supabase-js');

// Config from User
const SUPABASE_URL = "https://urlbadjyzrwzzaaispce.supabase.co";
// Using the SERVICE ROLE KEY provided by the user to bypass RLS
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGJhZGp5enJ3enphYWlzcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMzNDU5OSwiZXhwIjoyMDgxOTEwNTk5fQ.nf6zvD7Pin18HFYk7uq2kViMgyIY6JUD0EVvAdUmVWQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
    const videoId = "lnYAaBkXbbU";
    console.log(`Checking for video ID: ${videoId}`);

    // 1. Check videos table
    console.log('\n--- videos table ---');
    const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('youtube_video_id', videoId)
        .maybeSingle();

    if (videoError) {
        console.error('Error fetching videos:', videoError);
    } else {
        if (videoData) {
            console.log('✅ SUCCESS! Found video in videos table.');
            console.log(`- Title: ${videoData.title}`);
            console.log(`- Folder ID: ${videoData.folder_id}`);
        } else {
            console.log('❌ Not found in videos table yet.');
        }
    }

    // 2. Check relay_videos
    console.log('\n--- relay_videos table ---');
    const { data: relayData, error: relayError } = await supabase
        .from('relay_videos')
        .select('*')
        .eq('external_id', videoId)
        .limit(1);

    if (relayError) {
        console.error('Error fetching relay_videos:', relayError);
    } else {
        if (relayData && relayData.length > 0) {
            console.log('✅ Found in relay_videos:', relayData[0]);
        } else {
            console.log('❌ Not found in relay_videos (even with Service Role Key)');
        }
    }
}

verify();
