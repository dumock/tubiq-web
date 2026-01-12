import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = getSupabaseServer(true); // admin/service role

        // Mark all processing/pending jobs as failed/cancelled
        const { error } = await supabase
            .from('video_queue')
            .update({
                status: 'failed',
                error_message: 'Manually reset by user'
            })
            .in('status', ['pending', 'processing']);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Queue reset successfully' });
    } catch (error: any) {
        console.error('Failed to reset queue:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
