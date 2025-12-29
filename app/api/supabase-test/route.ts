import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Supabase 연결 테스트 API
 * GET /api/supabase-test
 * 
 * 연결 성공 시 테이블 정보와 함께 JSON 응답 반환
 */
export async function GET() {
    try {
        // channels 테이블에서 데이터 조회 테스트
        const { data: channels, error: channelsError } = await supabase
            .from('channels')
            .select('*')
            .limit(1);

        // videos 테이블에서 데이터 조회 테스트
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .limit(1);

        // folders 테이블에서 데이터 조회 테스트
        const { data: folders, error: foldersError } = await supabase
            .from('folders')
            .select('*')
            .limit(1);

        // jobs 테이블에서 데이터 조회 테스트
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .limit(1);

        return NextResponse.json({
            success: true,
            message: 'Supabase 연결 성공!',
            connection: {
                url: process.env.NEXT_PUBLIC_SUPABASE_URL,
                status: 'connected'
            },
            tables: {
                channels: {
                    accessible: !channelsError,
                    error: channelsError?.message || null,
                    sampleCount: channels?.length ?? 0
                },
                videos: {
                    accessible: !videosError,
                    error: videosError?.message || null,
                    sampleCount: videos?.length ?? 0
                },
                folders: {
                    accessible: !foldersError,
                    error: foldersError?.message || null,
                    sampleCount: folders?.length ?? 0
                },
                jobs: {
                    accessible: !jobsError,
                    error: jobsError?.message || null,
                    sampleCount: jobs?.length ?? 0
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: 'Supabase 연결 실패',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
