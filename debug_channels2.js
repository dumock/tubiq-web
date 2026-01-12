
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debug() {
    console.log('=== user_channels with joined channels ===');
    const { data, error } = await supabase
        .from('user_channels')
        .select('*, channels(*)')
        .limit(10);

    if (error) {
        console.error('Error:', error.message);
    } else if (data && data.length > 0) {
        data.forEach(uc => {
            console.log(`- user_channel id: ${uc.id}`);
            console.log(`  channel: ${uc.channels?.title || 'no title'}`);
            console.log(`  folder_id: ${uc.folder_id || 'NULL'}`);
        });
    } else {
        console.log('No user_channels found');
    }

    console.log('\n=== channels table (direct) ===');
    const { data: ch } = await supabase.from('channels').select('id, title, youtube_channel_id').limit(10);
    if (ch && ch.length > 0) {
        ch.forEach(c => console.log(`- ${c.title} (${c.youtube_channel_id})`));
    } else {
        console.log('No channels found');
    }
}

debug();
