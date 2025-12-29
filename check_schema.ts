
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
    console.log('--- Database Schema Check (videos) ---');
    const { data: videos, error } = await supabase.from('videos').select('*').limit(1);
    if (error) {
        console.error('Error fetching videos:', error);
    } else {
        console.log('Columns in videos table:', Object.keys(videos?.[0] || {}));
    }

    const { data: channels, error: cErr } = await supabase.from('channels').select('*').limit(1);
    if (cErr) {
        console.error('Error fetching channels:', cErr);
    } else {
        console.log('Columns in channels table:', Object.keys(channels?.[0] || {}));
    }
}

checkSchema();
