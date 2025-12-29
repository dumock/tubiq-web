const { createClient } = require('@supabase/supabase-js');

// Config from User
const SUPABASE_URL = "https://urlbadjyzrwzzaaispce.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGJhZGp5enJ3enphYWlzcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMzNDU5OSwiZXhwIjoyMDgxOTEwNTk5fQ.nf6zvD7Pin18HFYk7uq2kViMgyIY6JUD0EVvAdUmVWQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
    console.log("🔍 Starting Supabase Diagnostics...");
    console.log("URL:", SUPABASE_URL);

    const testId = "diag_" + Date.now();

    // 1. Try to INSERT a dummy row into relay_videos
    console.log("\n[1] Attempting INSERT into 'relay_videos'...");
    const payload = {
        account_id: "diagnostic",
        platform: "test_platform",
        external_id: testId,
        url: "https://test.com/" + testId,
        source: "diagnostic_script",
        created_at: Date.now()
    };

    const { data: insertData, error: insertError } = await supabase
        .from('relay_videos')
        .insert([payload])
        .select();

    if (insertError) {
        console.error("❌ INSERT Failed:", insertError);
        if (insertError.code === '42P01') {
            console.error("   -> This means the table 'relay_videos' DOES NOT EXIST.");
        }
    } else {
        console.log("✅ INSERT Initial Success. Data:", insertData);
    }

    // 2. Try to SELECT it back
    console.log("\n[2] Attempting SELECT from 'relay_videos'...");
    const { data: selectData, error: selectError } = await supabase
        .from('relay_videos')
        .select('*')
        .eq('external_id', testId);

    if (selectError) {
        console.error("❌ SELECT Failed:", selectError);
    } else {
        if (selectData && selectData.length > 0) {
            console.log("✅ SELECT Success! Row found:", selectData[0]);
        } else {
            console.log("❌ SELECT returned empty list (Row missing despite successful insert?)");
        }
    }
}

diagnose();
