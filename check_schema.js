
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    console.log('--- Database Schema Check (videos) ---');
    try {
        const { data: videos, error } = await supabase.from('videos').select('*').limit(1);
        if (error) {
            console.error('Error fetching videos:', error);
        } else {
            console.log('Columns in videos table:', Object.keys(videos?.[0] || {}));
        }
    } catch (e) {
        console.error('Catch Error:', e);
    }
}

checkSchema();
