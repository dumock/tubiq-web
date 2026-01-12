
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_VIDEO_URL = 'https://youtu.be/DoocoRugfKM?si=wuhWkwmD4GUBfhEX';
const TEST_EXTERNAL_ID = 'DoocoRugfKM';
const TEST_ACCOUNT_ID = 'a337f6d8-20fd-4c1d-9f89-b6814464f3ab';

async function testVideoInsertion() {
    // 1. First create the Qsharer folder if it doesn't exist
    console.log('1. Checking/Creating Qsharer folder...');
    let { data: folder } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', TEST_ACCOUNT_ID)
        .eq('name', '큐쉐어러')
        .eq('scope', 'videos')
        .single();

    if (!folder) {
        const { data: created, error } = await supabase
            .from('folders')
            .insert({
                name: '큐쉐어러',
                user_id: TEST_ACCOUNT_ID,
                scope: 'videos',
                sort_order: 0
            })
            .select('id')
            .single();

        if (error) {
            console.error('Failed to create folder:', error);
            return;
        }
        folder = created;
        console.log('   Created folder with id:', folder.id);
    } else {
        console.log('   Folder exists with id:', folder.id);
    }

    // 2. Insert into relay_videos with android_floating source
    console.log('2. Inserting test video into relay_videos...');
    const { data: insertData, error: insertError } = await supabase
        .from('relay_videos')
        .insert({
            account_id: TEST_ACCOUNT_ID,
            user_id: TEST_ACCOUNT_ID,
            platform: 'youtube',
            external_id: TEST_EXTERNAL_ID,
            url: TEST_VIDEO_URL,
            source: 'android_floating', // This is what Qsharer sends
            created_at: Date.now()
        })
        .select();

    if (insertError) {
        console.error('Failed to insert:', insertError);
        return;
    }

    console.log('   Inserted with id:', insertData[0]?.id);

    console.log('3. Waiting 15 seconds for worker to process...');
    await new Promise(r => setTimeout(r, 15000));

    // 4. Check if video has folder_id
    console.log('4. Checking video folder_id...');
    const { data: video } = await supabase
        .from('videos')
        .select('id, title, folder_id')
        .eq('youtube_id', TEST_EXTERNAL_ID)
        .single();

    if (video) {
        console.log('   Video found:', video.title?.substring(0, 30));
        console.log('   folder_id:', video.folder_id || 'NULL (FAIL)');
        if (video.folder_id) {
            console.log('✅ SUCCESS! Video is in Qsharer folder');
        } else {
            console.log('❌ FAIL: Video has no folder_id');
        }
    } else {
        console.log('❌ Video not found in database yet');
    }
}

testVideoInsertion();
