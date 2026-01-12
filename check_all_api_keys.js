const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllApiKeys() {
    const { data, error } = await supabase
        .from('user_settings')
        .select('user_id, setting_value')
        .eq('setting_key', 'api_config');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('=== API Keys Storage Check ===\n');

    data.forEach((row, i) => {
        const config = row.setting_value;
        console.log(`User: ${row.user_id.substring(0, 8)}...`);
        console.log('-'.repeat(40));

        const platforms = ['youtube', 'gemini', 'openai', 'tikhub', 'fal'];
        platforms.forEach(platform => {
            const pConfig = config[platform];
            if (pConfig && pConfig.keys && pConfig.keys.length > 0) {
                console.log(`✅ ${platform.toUpperCase()}: ${pConfig.keys.length} key(s)`);
                pConfig.keys.forEach((k, j) => {
                    console.log(`   └─ ${k.maskedKey} (active: ${k.active})`);
                });
            } else {
                console.log(`❌ ${platform.toUpperCase()}: No keys`);
            }
        });
        console.log('');
    });
}

checkAllApiKeys().then(() => process.exit(0));
