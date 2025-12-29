const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://urlbadjyzrwzzaaispce.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGJhZGp5enJ3enphYWlzcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMzNDU5OSwiZXhwIjoyMDgxOTEwNTk5fQ.nf6zvD7Pin18HFYk7uq2kViMgyIY6JUD0EVvAdUmVWQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log("--- Schema info for relay_videos ---");
    // We can't easily get schema via JS client without SQL, 
    // but we can look at the diagnostic row again and check types as best as we can.

    const { data, error } = await supabase.from('relay_videos').select('*').limit(1);
    if (data && data.length > 0) {
        const row = data[0];
        for (const key in row) {
            console.log(`${key}: ${typeof row[key]} (Value: ${row[key]})`);
        }
    } else {
        console.log("No data found to inspect.");
    }
}

checkSchema();
