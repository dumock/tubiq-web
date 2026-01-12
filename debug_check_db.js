
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
    console.log('--- Checking Channels ---');
    const { data: channels, error: cError } = await supabase
        .from('channels')
        .select('*')
        .order('added_at', { ascending: false })
        .limit(5);

    if (cError) console.error('Channels Error:', cError);
    else console.log(channels);

    console.log('\n--- Checking User Channels ---');
    const { data: userChannels, error: ucError } = await supabase
        .from('user_channels')
        .select('*, channels(title, scope)')
        .order('created_at', { ascending: false })
        .limit(5);

    if (ucError) console.error('User Channels Error:', ucError);
    else console.log(JSON.stringify(userChannels, null, 2));
}

checkDB();
