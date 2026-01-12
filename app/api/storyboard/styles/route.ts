
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Get user's custom styles
export async function GET(request: Request) {
    // Note: If using real auth, we should get user_id from session.
    // For now we assume RLS policies handle the "my styles" logic or we fetch all if public.

    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase
        .from('storyboard_styles')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }); // Fallback

    if (error) {
        // If table doesn't exist yet, return empty array instead of crashing
        if (error.code === '42P01') return NextResponse.json([]);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// Add a new style
export async function POST(request: Request) {
    const body = await request.json();

    // Support single object or array for seeding
    const items = Array.isArray(body) ? body : [body];

    const preparedItems = items.map((item, index) => ({
        id: item.id || `custom-${Date.now()}-${index}`,
        name: item.name,
        prompt: item.prompt,
        preview_color: item.previewColor || item.preview_color || 'bg-gray-500',
        sort_order: item.sort_order || 0
    }));

    const { data, error } = await supabase
        .from('storyboard_styles')
        .upsert(preparedItems)
        .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// Reorder styles or update content
export async function PATCH(request: Request) {
    const body = await request.json();
    const { updates } = body; // Expect array of { id, sort_order?, name?, prompt?, preview_color? }

    if (!Array.isArray(updates)) {
        return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
    }

    // Process updates in parallel
    const promises = updates.map(update => {
        const updateData: any = {};
        if (update.sort_order !== undefined) updateData.sort_order = update.sort_order;
        if (update.name !== undefined) updateData.name = update.name;
        if (update.prompt !== undefined) updateData.prompt = update.prompt;
        if (update.preview_color !== undefined) updateData.preview_color = update.preview_color;

        return supabase
            .from('storyboard_styles')
            .update(updateData)
            .eq('id', update.id);
    });

    await Promise.all(promises);
    return NextResponse.json({ success: true });
}

// Delete a style
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const { error } = await supabase
        .from('storyboard_styles')
        .delete()
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
