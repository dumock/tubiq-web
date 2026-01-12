import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        // Use service role to access auth.users
        const supabase = getSupabaseServer(true);

        // Get all users from auth.users
        const { data: { users }, error } = await supabase.auth.admin.listUsers();

        if (error) {
            console.error('Error fetching users:', error);
            return NextResponse.json(
                { ok: false, message: 'Failed to fetch users', error: error.message },
                { status: 500 }
            );
        }

        // Transform user data for admin dashboard
        const transformedUsers = users.map(user => ({
            id: user.id,
            email: user.email || '',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            email_confirmed_at: user.email_confirmed_at,
            // Additional metadata if available
            user_metadata: user.user_metadata,
        }));

        return NextResponse.json({
            ok: true,
            data: transformedUsers,
            total: transformedUsers.length
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}
