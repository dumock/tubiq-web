
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_ACCOUNT_ID = 'a337f6d8-20fd-4c1d-9f89-b6814464f3ab';

async function mergeFolders() {
    // 1. Find both folders
    console.log('1. Finding folders...');
    const { data: folders } = await supabase
        .from('folders')
        .select('id, name')
        .eq('user_id', TEST_ACCOUNT_ID)
        .eq('scope', 'videos')
        .ilike('name', '%큐쉐어러%');

    console.log('Found folders:', folders);

    const emojiFolder = folders?.find(f => f.name.includes('📱'));
    const plainFolder = folders?.find(f => !f.name.includes('📱') && f.name === '큐쉐어러');

    if (!emojiFolder) {
        console.log('❌ Emoji folder not found');
        return;
    }
    console.log('Emoji folder:', emojiFolder);
    console.log('Plain folder:', plainFolder);

    if (plainFolder) {
        // 2. Move videos from plain folder to emoji folder
        console.log('\n2. Moving videos from plain folder to emoji folder...');
        const { data: moved, error: moveErr } = await supabase
            .from('videos')
            .update({ folder_id: emojiFolder.id })
            .eq('folder_id', plainFolder.id)
            .select('id');

        if (moveErr) {
            console.error('Move error:', moveErr);
        } else {
            console.log(`   Moved ${moved?.length || 0} videos`);
        }

        // 3. Delete the plain folder
        console.log('\n3. Deleting plain folder...');
        const { error: delErr } = await supabase
            .from('folders')
            .delete()
            .eq('id', plainFolder.id);

        if (delErr) {
            console.error('Delete error:', delErr);
        } else {
            console.log('   ✅ Deleted plain folder');
        }
    }

    console.log('\n✅ Done! Emoji folder ID:', emojiFolder.id);
}

mergeFolders();
