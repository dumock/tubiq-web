import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIds() {
    console.log('--- Database ID Check ---');
    const { data: channels, error } = await supabase.from('channels').select('id').limit(1);
    if (error) {
        console.error('Error fetching channels:', error);
    } else {
        console.log('Sample Channel ID:', channels?.[0]?.id);
    }

    const { data: topics, error: tErr } = await supabase.from('topics').select('id, code').limit(3);
    if (tErr) {
        console.error('Error fetching topics:', tErr);
    } else {
        console.log('Sample Topics:', topics);
    }
}

checkIds();
