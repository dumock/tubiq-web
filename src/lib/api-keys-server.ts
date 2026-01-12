import { getSupabaseServer, getAuthenticatedUser } from './supabase-server';
import { createClient } from '@supabase/supabase-js';

/**
 * 서버 사이드에서 YouTube API 키를 결정하는 유틸리티
 */
export async function getYoutubeApiKey(request: Request): Promise<string | null> {
    const headerKey = request.headers.get('X-YouTube-Api-Key');
    if (headerKey) return headerKey;

    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (user) {
            const { data } = await supabase
                .from('user_settings')
                .select('setting_value')
                .eq('user_id', user.id)
                .eq('setting_key', 'api_config')
                .single();

            if (data?.setting_value) {
                const config = data.setting_value as any;
                const youtubeKeys = config.youtube?.keys || [];
                const activeKey = youtubeKeys.find((k: any) => k.active);

                if (activeKey) {
                    return activeKey.key;
                }
            }
        }
    } catch (e) {
        console.error('[YoutubeServer] Failed to get key from DB', e);
    }

    return process.env.YOUTUBE_API_KEY || null;
}

/**
 * 서버 사이드에서 Gemini API 키를 결정하는 유틸리티
 */
export async function getGeminiApiKey(request: Request): Promise<string | null> {
    const headerKey = request.headers.get('X-Gemini-Api-Key');
    if (headerKey) {
        console.log('[GeminiServer] Using header key');
        return headerKey;
    }

    try {
        console.log('[GeminiServer] Attempting to get key from DB...');
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            console.log('[GeminiServer] No Authorization header found');
            return process.env.GEMINI_API_KEY || null;
        }

        // Create a client scoped to the user
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Verify user with the token (optional but good for debugging/validation)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (user) {
            console.log('[GeminiServer] User found:', user.id);
            const { data, error } = await supabase
                .from('user_settings')
                .select('setting_value')
                .eq('user_id', user.id)
                .eq('setting_key', 'api_config')
                .single();

            if (error) {
                console.error('[GeminiServer] DB Error:', error.message);
            }

            if (data?.setting_value) {
                const config = data.setting_value as any;
                const geminiKeys = config.gemini?.keys || [];
                const activeKey = geminiKeys.find((k: any) => k.active);

                if (activeKey) {
                    console.log('[GeminiServer] Active key found in DB');
                    return activeKey.key;
                } else {
                    console.log('[GeminiServer] No active key found in config.');
                }
            } else {
                console.log('[GeminiServer] No api_config found for user.');
            }
        } else {
            console.log('[GeminiServer] Token validation failed or no user:', userError?.message);
        }
    } catch (e) {
        console.error('[GeminiServer] Failed to get key from DB', e);
    }

    console.log('[GeminiServer] Falling back to Env...');
    return process.env.GEMINI_API_KEY || null;
}

/**
 * 서버 사이드에서 OpenAI API 키를 결정하는 유틸리티
 */
export async function getOpenaiApiKey(request: Request): Promise<string | null> {
    const headerKey = request.headers.get('X-OpenAI-Api-Key');
    if (headerKey) return headerKey;

    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (user) {
            const { data } = await supabase
                .from('user_settings')
                .select('setting_value')
                .eq('user_id', user.id)
                .eq('setting_key', 'api_config')
                .single();

            if (data?.setting_value) {
                const config = data.setting_value as any;
                const openaiKeys = config.openai?.keys || [];
                const activeKey = openaiKeys.find((k: any) => k.active);

                if (activeKey) {
                    return activeKey.key;
                }
            }
        }
    } catch (e) {
        console.error('[OpenAIServer] Failed to get key from DB', e);
    }

    return process.env.OPENAI_API_KEY || null;
}

/**
 * 서버 사이드에서 TikHub API 키를 결정하는 유틸리티
 * TikTok, Instagram, Xiaohongshu 채널 조회에 사용
 */
export async function getTikHubApiKey(request: Request): Promise<string | null> {
    const headerKey = request.headers.get('X-TikHub-Api-Key');
    if (headerKey) return headerKey;

    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (user) {
            const { data } = await supabase
                .from('user_settings')
                .select('setting_value')
                .eq('user_id', user.id)
                .eq('setting_key', 'api_config')
                .single();

            if (data?.setting_value) {
                const config = data.setting_value as any;
                const tikhubKeys = config.tikhub?.keys || [];
                const activeKey = tikhubKeys.find((k: any) => k.active);

                if (activeKey) {
                    return activeKey.key;
                }
            }
        }
    } catch (e) {
        console.error('[TikHubServer] Failed to get key from DB', e);
    }

    return process.env.TIKHUB_API_KEY || null;
}

/**
 * 서버 사이드에서 FAL API 키를 결정하는 유틸리티
 * AI 이미지/비디오 생성에 사용
 */
export async function getFalApiKey(request: Request): Promise<string | null> {
    const headerKey = request.headers.get('X-Fal-Api-Key');
    if (headerKey) return headerKey;

    try {
        const supabase = getSupabaseServer(true);
        const user = await getAuthenticatedUser(request, supabase);

        if (user) {
            const { data } = await supabase
                .from('user_settings')
                .select('setting_value')
                .eq('user_id', user.id)
                .eq('setting_key', 'api_config')
                .single();

            if (data?.setting_value) {
                const config = data.setting_value as any;
                const falKeys = config.fal?.keys || [];
                const activeKey = falKeys.find((k: any) => k.active);

                if (activeKey) {
                    return activeKey.key;
                }
            }
        }
    } catch (e) {
        console.error('[FalServer] Failed to get key from DB', e);
    }

    return process.env.FAL_KEY || null;
}
