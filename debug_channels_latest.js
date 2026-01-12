
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLatestChannels() {
    console.log('Checking latest channels...');

    const targetId = 'UCE9LgqslvlZIySGMCKg89sQ';
    console.log(`Checking for YouTube Channel ID: ${targetId}`);

    // 1. Check channels table
    const { data: channels, error } = await supabase
        .from('channels')
        .select('*')
        .eq('youtube_channel_id', targetId);

    if (error) {
        console.error('Error fetching channels:', error);
        return;
    }

    if (channels.length === 0) {
        console.log('❌ Channel NOT found in channels table.');
    }

    const result = {
        channel: channels.length > 0 ? channels[0] : null,
        userLinks: []
    };

    if (result.channel) {
        // 2. Check user_channels link
        const { data: userLinks, error: linkError } = await supabase
            .from('user_channels')
            .select('*')
            .eq('channel_id', result.channel.id);

        if (linkError) {
            console.error('Error fetching user_channels:', linkError);
        } else {
            result.userLinks = userLinks || [];
        }
    }

    fs.writeFileSync('debug_output.json', JSON.stringify(result, null, 2));
    console.log('Output written to debug_output.json');
}

checkLatestChannels();
