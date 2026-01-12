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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('Checking for image_queue table...');
    const { data, error } = await supabase.from('image_queue').select('id').limit(1);
    if (error) {
        console.error('Error:', error.message);
        if (error.message.includes('relation "public.image_queue" does not exist')) {
            console.log('Table image_queue DOES NOT exist.');
        }
    } else {
        console.log('Table image_queue exists!');
    }
}

check();
