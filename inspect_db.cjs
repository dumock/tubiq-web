const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://urlbadjyzrwzzaaispce.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGJhZGp5enJ3enphYWlzcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMzNDU5OSwiZXhwIjoyMDgxOTEwNTk5fQ.nf6zvD7Pin18HFYk7uq2kViMgyIY6JUD0EVvAdUmVWQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectDb() {
    console.log("--- Inspecting Triggers on relay_videos ---");
    // We can use RPC to run arbitrary SQL if any exists, but usually we don't.
    // Instead, let's try to fetch a row from auth.users to see if ANY user exists.

    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
        console.error("Error listing users:", userError);
    } else {
        console.log(`Found ${users.users.length} users.`);
        users.users.forEach(u => console.log(`- ${u.id} (${u.email})`));
    }

    console.log("\n--- Checking for existing channels ---");
    const { data: channels } = await supabase.from('channels').select('id, user_id, title').limit(5);
    console.log("Channels:", channels);

    console.log("\n--- Testing insert with user_id = null ---");
    const testId = "test_" + Date.now();
    const { error: insertError } = await supabase.from('relay_videos').insert({
        account_id: 'test_user',
        user_id: null,
        platform: 'youtube',
        external_id: testId,
        url: 'https://youtube.com/watch?v=' + testId,
        source: 'inspector'
    });

    if (insertError) {
        console.error("Insert with NULL user_id FAILED:", insertError);
    } else {
        console.log("Insert with NULL user_id SUCCEEDED.");
    }
}

inspectDb();
