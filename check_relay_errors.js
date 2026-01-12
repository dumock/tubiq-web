
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkErrors() {
    const { data, error } = await supabase
        .from('relay_channels')
        .select('id, external_id, error, processed_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching relay_channels:', error);
        return;
    }

    console.log('Recent relay_channels rows:');
    data.forEach(row => {
        console.log(`- ID: ${row.id}`);
        console.log(`  Target: ${row.external_id}`);
        console.log(`  Error: ${row.error || 'None'}`);
        console.log(`  ProcessedAt: ${row.processed_at || 'Pending'}`);
        console.log('---');
    });
}

checkErrors();
