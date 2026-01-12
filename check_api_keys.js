// Check API keys stored in database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Manual loading to ensure keys are present
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Keys missing even after manual load');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkApiKeys() {
    console.log('=== Checking API Keys in Database ===\n');

    // Get all user_settings with api_config
    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('setting_key', 'api_config');

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No API config found in database.');
        return;
    }

    for (const row of data) {
        console.log(`User ID: ${row.user_id}`);
        console.log(`Updated At: ${row.updated_at}`);
        console.log('\n--- API Config ---');

        const config = row.setting_value;

        // Gemini Keys - PRINT FULL KEY
        console.log('\n[Gemini API]');
        if (config.gemini?.keys) {
            config.gemini.keys.forEach((k, i) => {
                console.log(`    ${i + 1}. KEY=${k.key} (active: ${k.active})`);
            });
        }
        console.log('\n' + '='.repeat(50) + '\n');
    }
}

checkApiKeys();
