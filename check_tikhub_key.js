const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTikHubKey() {
    // Get all user_settings with api_config
    const { data, error } = await supabase
        .from('user_settings')
        .select('user_id, setting_value')
        .eq('setting_key', 'api_config');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found', data.length, 'user configs');

    data.forEach((row, i) => {
        const config = row.setting_value;
        console.log(`\n--- User ${i + 1} (${row.user_id.substring(0, 8)}...) ---`);
        console.log('Has tikhub config:', !!config.tikhub);
        if (config.tikhub) {
            console.log('TikHub keys:', config.tikhub.keys?.length || 0);
            config.tikhub.keys?.forEach((k, j) => {
                console.log(`  Key ${j + 1}: ${k.maskedKey} (active: ${k.active})`);
            });
        }
    });
}

checkTikHubKey().then(() => process.exit(0));
