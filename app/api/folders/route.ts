import { NextResponse } from 'next/server';
import { getSupabaseServer, getAuthenticatedUser } from '@/lib/supabase-server';

// GET: Fetch folders for authenticated user
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Get scope from query params (default: 'channels')
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope') || 'channels';

        const { data, error } = await supabase
            .from('folders')
            .select('*')
            .eq('user_id', user.id)
            .eq('scope', scope)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Supabase GET Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create a new folder
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, parent_id, scope } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ ok: false, message: 'Name is required' }, { status: 400 });
        }

        const folderScope = scope || 'channels';

        // Get max sort_order for siblings
        let query = supabase
            .from('folders')
            .select('sort_order')
            .eq('user_id', user.id);

        if (parent_id) {
            query = query.eq('parent_id', parent_id);
        } else {
            query = query.is('parent_id', null);
        }

        const { data: siblings } = await query.order('sort_order', { ascending: false }).limit(1);
        const nextOrder = (siblings && siblings.length > 0) ? (siblings[0].sort_order || 0) + 1 : 1;

        const payload = {
            name: name.trim(),
            parent_id: parent_id || null,
            user_id: user.id,
            scope: folderScope,
            sort_order: nextOrder,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('folders')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Supabase INSERT Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data }, { status: 201 });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH: Rename a folder
export async function PATCH(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, name } = body;

        if (!id || !name) {
            return NextResponse.json({ ok: false, message: 'ID and name are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('folders')
            .update({ name: name.trim() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Supabase UPDATE Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, data });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Delete a folder
export async function DELETE(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const supabase = getSupabaseServer(false, token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ ok: false, message: 'ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('folders')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Supabase DELETE Error:', error);
            return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, message: 'Deleted' });
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ ok: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
