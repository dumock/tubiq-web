
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkKey() {
    const targetKey = 'AIzaSyCajbf8rSrLw9yr2qw4kMddGy8TM5AgKoc';

    console.log('Checking for key:', targetKey);

    const { data: users, error } = await supabase
        .from('user_settings')
        .select('user_id, setting_value')
        .eq('setting_key', 'api_config');

    if (error) {
        console.error('Error fetching settings:', error);
        return;
    }

    let found = false;
    for (const row of users) {
        const config = row.setting_value;
        const keys = config.youtube?.keys || [];
        const match = keys.find(k => k.key === targetKey);
        if (match) {
            console.log(`✅ Key FOUND in DB for user ${row.user_id}`);
            console.log(`   Active: ${match.active}`);
            found = true;
        }
    }

    if (!found) {
        console.log('❌ Key NOT found in any user_settings');
    }
}

checkKey();
