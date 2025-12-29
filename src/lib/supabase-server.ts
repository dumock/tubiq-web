import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const getSupabaseServer = (useServiceRole = false) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = useServiceRole
        ? process.env.SUPABASE_SERVICE_ROLE_KEY!
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createClient(supabaseUrl, supabaseKey);
};

export async function getAuthenticatedUser(request: Request, supabase: SupabaseClient) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;
        return user;
    } catch (e) {
        return null;
    }
}
