const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://urlbadjyzrwzzaaispce.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGJhZGp5enJ3enphYWlzcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMzNDU5OSwiZXhwIjoyMDgxOTEwNTk5fQ.nf6zvD7Pin18HFYk7uq2kViMgyIY6JUD0EVvAdUmVWQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAll() {
    console.log("--- Total Count relay_videos ---");
    const { count: c1, error: e1 } = await supabase.from('relay_videos').select('*', { count: 'exact', head: true });
    console.log("Count:", c1, e1 || "");

    console.log("\n--- Last 3 entries in relay_videos ---");
    const { data: relays } = await supabase.from('relay_videos').select('*').order('created_at', { ascending: false }).limit(3);
    console.log(JSON.stringify(relays, null, 2));

    console.log("\n--- Total Count videos ---");
    const { count: c2, error: e2 } = await supabase.from('videos').select('*', { count: 'exact', head: true });
    console.log("Count:", c2, e2 || "");

    console.log("\n--- Last 3 entries in videos ---");
    const { data: videos } = await supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(3);
    console.log(JSON.stringify(videos, null, 2));
}

checkAll();
