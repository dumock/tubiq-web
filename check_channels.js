
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkChannels() {
    console.log('=== Checking channels table ===');
    const { data: channels, error } = await supabase
        .from('channels')
        .select('id, title, youtube_channel_id, user_id')
        .order('id', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
    } else if (channels && channels.length > 0) {
        console.log('Found channels:');
        channels.forEach(c => console.log(`  - ${c.title} (${c.youtube_channel_id})`));
    } else {
        console.log('No channels found');
    }

    console.log('\n=== Checking user_channels table ===');
    const { data: userChannels, error: ucError } = await supabase
        .from('user_channels')
        .select('*')
        .limit(5);

    if (ucError) {
        console.error('Error:', ucError.message);
    } else if (userChannels && userChannels.length > 0) {
        console.log('Found user_channels:', userChannels.length);
    } else {
        console.log('No user_channels found');
    }
}

checkChannels();
