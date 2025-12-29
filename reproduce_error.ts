
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reproduce() {
    console.log('--- Reproducing Save Video Error ---');
    const { data: userData } = await supabase.auth.admin.listUsers();
    const user = userData.users[0];

    if (!user) {
        console.error('No users found in database');
        return;
    }

    console.log('Using User ID:', user.id);

    const payload = {
        youtube_video_id: 'test_video_id_' + Date.now(),
        title: 'Test Video',
        user_id: user.id,
        account_id: user.id, // Fixed: now including account_id
        collected_at: new Date().toISOString(),
        platform: 'youtube',
        external_id: 'test_video_id_' + Date.now(),
        url: 'https://youtube.com',
        source: 'verification'
    };

    console.log('Attempting insert with payload:', payload);

    const { data, error } = await supabase
        .from('videos')
        .insert(payload);

    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Insert Success:', data);
    }
}

reproduce();
