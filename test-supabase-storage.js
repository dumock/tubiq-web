
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' }); // Try local env first
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: 'apps/desktop/.env' }); // Try desktop env
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Key Length:', supabaseKey?.length);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('Error listing buckets:', error);
    } else {
        console.log('Buckets:', data.map(b => b.name));
    }

    // Test upload to 'videos'
    const testFile = Buffer.from('test');
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload('test_check.txt', testFile, { upsert: true });

    if (uploadError) {
        console.log('Upload to videos failed:', uploadError);
    } else {
        console.log('Upload to videos success:', uploadData);
    }
}

checkBuckets();
