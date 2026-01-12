
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_CHANNEL_URL = 'https://youtube.com/@dailyjihyun?si=ty81tU_YDcIzpSdZ';
const TEST_EXTERNAL_ID = '@dailyjihyun';
const TEST_ACCOUNT_ID = 'a337f6d8-20fd-4c1d-9f89-b6814464f3ab'; // From user's screenshot

async function testChannelInsertion() {
    console.log('1. Inserting channel link into relay_channels...');

    const { data: insertData, error: insertError } = await supabase
        .from('relay_channels')
        .insert({
            account_id: TEST_ACCOUNT_ID,
            user_id: TEST_ACCOUNT_ID,
            platform: 'youtube',
            external_id: TEST_EXTERNAL_ID,
            url: TEST_CHANNEL_URL,
            source: 'test_script',
            created_at: Date.now()
        })
        .select();

    if (insertError) {
        console.error('❌ Insert failed:', insertError);
        return;
    }

    console.log('✅ Inserted into relay_channels:', insertData[0]?.id);

    console.log('\n2. Waiting 15 seconds for worker to process...');
    await new Promise(r => setTimeout(r, 15000));

    console.log('\n3. Checking relay_channels for errors...');
    const { data: relayRow } = await supabase
        .from('relay_channels')
        .select('*')
        .eq('external_id', TEST_EXTERNAL_ID)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (relayRow) {
        console.log('   Still in relay_channels (not processed yet or errored):');
        console.log('   Error:', relayRow.error || 'None');
        console.log('   ProcessedAt:', relayRow.processed_at || 'Pending');
    } else {
        console.log('✅ Row deleted from relay_channels (means it was successfully processed!)');
    }

    console.log('\n4. Checking channels table...');
    const { data: channelRow, error: channelError } = await supabase
        .from('channels')
        .select('*')
        .eq('user_id', TEST_ACCOUNT_ID)
        .ilike('youtube_channel_id', '%dailyjihyun%')
        .limit(1);

    if (channelError) {
        console.error('❌ Error querying channels:', channelError);
    } else if (channelRow && channelRow.length > 0) {
        console.log('✅ SUCCESS! Channel found in channels table:');
        console.log('   ID:', channelRow[0].id);
        console.log('   Title:', channelRow[0].title);
        console.log('   YouTube ID:', channelRow[0].youtube_channel_id);
    } else {
        console.log('❌ Channel NOT found in channels table');
    }

    console.log('\n5. Checking user_channels table...');
    const { data: userChannelRow } = await supabase
        .from('user_channels')
        .select('*')
        .eq('user_id', TEST_ACCOUNT_ID)
        .limit(5);

    if (userChannelRow && userChannelRow.length > 0) {
        console.log('✅ Found entries in user_channels:', userChannelRow.length);
    } else {
        console.log('❌ No entries in user_channels for this user');
    }
}

testChannelInsertion().catch(console.error);
