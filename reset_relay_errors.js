
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetErrors() {
    console.log('Resetting errors in relay_channels...');
    const { error, count } = await supabase
        .from('relay_channels')
        .update({ error: null, processed_at: null })
        .neq('error', null);

    if (error) {
        console.error('Failed:', error.message);
    } else {
        console.log('✅ Reset complete. Worker will retry on next poll.');
    }
}

resetErrors();
