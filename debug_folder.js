
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debug() {
    // 1. Check recent videos and their folder_id
    console.log('=== Recent Videos ===');
    const { data: videos } = await supabase
        .from('videos')
        .select('id, title, folder_id, source, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    videos?.forEach(v => {
        console.log(`- ${v.title?.substring(0, 30)}...`);
        console.log(`  folder_id: ${v.folder_id || 'NULL'}`);
        console.log(`  source: ${v.source || 'NULL'}`);
    });

    // 2. Check relay_videos source values
    console.log('\n=== Recent relay_videos ===');
    const { data: relays } = await supabase
        .from('relay_videos')
        .select('id, source, external_id')
        .order('created_at', { ascending: false })
        .limit(5);

    relays?.forEach(r => {
        console.log(`- ${r.external_id}: source=${r.source}`);
    });

    // 3. Check Qsharer folder exists
    console.log('\n=== Qsharer Folder ===');
    const { data: folder } = await supabase
        .from('folders')
        .select('id, name')
        .eq('name', '큐쉐어러')
        .eq('scope', 'videos')
        .single();

    if (folder) {
        console.log(`Found: ${folder.name} (id: ${folder.id})`);
    } else {
        console.log('NOT FOUND');
    }
}

debug();
