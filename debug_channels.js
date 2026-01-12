
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugChannels() {
    console.log('=== channels table ===');
    const { data: channels } = await supabase
        .from('channels')
        .select('id, title, youtube_channel_id, folder_id, source, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    channels?.forEach(c => {
        console.log(`- ${c.title}`);
        console.log(`  yt_id: ${c.youtube_channel_id}`);
        console.log(`  folder_id: ${c.folder_id || 'NULL'}`);
        console.log(`  source: ${c.source || 'NULL'}`);
    });

    console.log('\n=== user_channels table ===');
    const { data: userChannels } = await supabase
        .from('user_channels')
        .select('id, channel_id, user_id, folder_id, source')
        .order('created_at', { ascending: false })
        .limit(10);

    userChannels?.forEach(uc => {
        console.log(`- channel_id: ${uc.channel_id}, folder_id: ${uc.folder_id || 'NULL'}, source: ${uc.source || 'NULL'}`);
    });

    console.log('\n=== relay_channels (pending) ===');
    const { data: relays } = await supabase
        .from('relay_channels')
        .select('id, external_id, source, error, processed_at')
        .order('created_at', { ascending: false })
        .limit(5);

    relays?.forEach(r => {
        console.log(`- ${r.external_id}: source=${r.source}, error=${r.error || 'null'}`);
    });
}

debugChannels();
