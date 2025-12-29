import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase 클라이언트 (브라우저/클라이언트 컴포넌트용)
 * 
 * 사용 가능한 테이블:
 * - channels: 채널 정보 (채널분석, 채널에셋, 채널수집 공통)
 * - videos: 영상 정보 (영상에셋 등)
 * - folders: 폴더 구조 (모든 페이지에서 공통)
 * - jobs: 수집/분석 작업 상태
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
