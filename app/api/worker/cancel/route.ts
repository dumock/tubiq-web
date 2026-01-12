import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const { jobId } = await req.json();

        if (!jobId) {
            return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseServer(true); // admin/service role

        // Mark the specific job as failed/cancelled
        const { error } = await supabase
            .from('video_queue')
            .update({
                status: 'failed',
                error_message: 'Cancelled by user'
            })
            .eq('id', jobId);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Job cancelled successfully' });
    } catch (error: any) {
        console.error('Failed to cancel job:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
