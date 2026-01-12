const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
    console.log('Verifying image_queue table...');

    // Check if table exists
    const { error } = await supabase.from('image_queue').select('id').limit(1);

    if (error) {
        if (error.code === '42P01' || error.message.includes('relation "public.image_queue" does not exist')) {
            console.log('TABLE MISSING. Please run the SQL in c:/tubiq-web/sql/create_image_queue.sql manually in Supabase SQL Editor.');
            console.log('I cannot run SQL directly via regular API calls without RDS access or similar.');
        } else {
            console.error('Unexpected DB Error:', error);
        }
    } else {
        console.log('TABLE image_queue EXISTS!');
    }
}

setup();
