import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ApiKey {
    id: string;
    key: string;
    maskedKey: string;
    quota: number;
    active: boolean;
}

interface ApiConfig {
    youtube: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
    gemini: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
    openai: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
    tikhub: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
    fal: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
    kei: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
    voice: {
        typecast: string;
        elevenlabs: string;
        minimax: string;
    };
}

const DEFAULT_CONFIG: ApiConfig = {
    youtube: { keys: [], rotationEnabled: false },
    gemini: { keys: [], rotationEnabled: false },
    openai: { keys: [], rotationEnabled: false },
    tikhub: { keys: [], rotationEnabled: false },
    fal: { keys: [], rotationEnabled: false },
    kei: { keys: [], rotationEnabled: false },
    voice: { typecast: '', elevenlabs: '', minimax: '' }
};

export function useYouTubeApi() {
    const [userId, setUserId] = useState<string | null>(null);
    const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);

    // 0. 인증 상태 감지
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUserId(session?.user?.id || null);
        };
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 1. DB에서 설정 로드
    const loadConfig = useCallback(async () => {
        if (!userId) return;

        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('setting_value')
                .eq('user_id', userId)
                .eq('setting_key', 'api_config')
                .single();

            if (data?.setting_value) {
                setConfig(data.setting_value as ApiConfig);
            } else {
                // DB에 없으면 로컬스토리지에서 마이그레이션 시도
                const saved = localStorage.getItem('tubiq_api_config');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setConfig(parsed);
                    // 마이그레이션 시 즉시 DB 저장
                    saveConfigToDb(parsed, userId);
                }
            }
        } catch (e) {
            console.error('[useYouTubeApi] Failed to load config', e);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    // 2. DB에 설정 저장
    const saveConfigToDb = async (newConfig: ApiConfig, currentUserId?: string) => {
        const uid = currentUserId || userId;
        if (!uid) return;

        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: uid,
                    setting_key: 'api_config',
                    setting_value: newConfig,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,setting_key' });

            if (error) throw error;

            // 로컬스토리지도 동기화 (오프라인 캐시용)
            localStorage.setItem('tubiq_api_config', JSON.stringify(newConfig));
        } catch (e) {
            console.error('[useYouTubeApi] Failed to save config', e);
        }
    };

    const updateConfig = (newConfig: ApiConfig) => {
        setConfig(newConfig);
        saveConfigToDb(newConfig);
    };

    // 3. 현재 사용 가능한 최적의 키 가져오기
    const getActiveYoutubeKey = useCallback(() => {
        const activeKeys = config.youtube.keys.filter(k => k.active);
        if (activeKeys.length === 0) return null;
        if (config.youtube.rotationEnabled) {
            const idx = Math.floor(Math.random() * activeKeys.length);
            return activeKeys[idx].key;
        }
        return activeKeys[0].key;
    }, [config.youtube]);

    const getActiveGeminiKey = useCallback(() => {
        const activeKeys = config.gemini.keys.filter(k => k.active);
        if (activeKeys.length === 0) return null;
        if (config.gemini.rotationEnabled) {
            const idx = Math.floor(Math.random() * activeKeys.length);
            return activeKeys[idx].key;
        }
        return activeKeys[0].key;
    }, [config.gemini]);

    const getActiveTikHubKey = useCallback(() => {
        const tikhubConfig = config.tikhub || { keys: [], rotationEnabled: false };
        const activeKeys = tikhubConfig.keys.filter(k => k.active);
        if (activeKeys.length === 0) return null;
        if (tikhubConfig.rotationEnabled) {
            const idx = Math.floor(Math.random() * activeKeys.length);
            return activeKeys[idx].key;
        }
        return activeKeys[0].key;
    }, [config.tikhub]);

    const getActiveKeiKey = useCallback(() => {
        const keiConfig = config.kei || { keys: [], rotationEnabled: false };
        const activeKeys = keiConfig.keys.filter(k => k.active);
        if (activeKeys.length === 0) return null;
        if (keiConfig.rotationEnabled) {
            const idx = Math.floor(Math.random() * activeKeys.length);
            return activeKeys[idx].key;
        }
        return activeKeys[0].key;
    }, [config.kei]);

    // 4. API 호출 래퍼 (YouTube 전용 래퍼 유지 - 하위 호환성)
    const fetchYouTube = useCallback(async (url: string, options: RequestInit = {}) => {
        const ytKey = getActiveYoutubeKey();
        const gmKey = getActiveGeminiKey();
        const thKey = getActiveTikHubKey();

        const headers = new Headers(options.headers);
        if (ytKey) headers.set('X-YouTube-Api-Key', ytKey);
        if (gmKey) headers.set('X-Gemini-Api-Key', gmKey);
        if (thKey) headers.set('X-TikHub-Api-Key', thKey);

        // Supabase 인증 토큰 자동 추가
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers.set('Authorization', `Bearer ${session.access_token}`);
        }

        return fetch(url, { ...options, headers });
    }, [getActiveYoutubeKey, getActiveGeminiKey, getActiveTikHubKey]);

    // 더 명확한 범용 래퍼
    const apiFetch = fetchYouTube;

    return {
        config,
        updateConfig,
        fetchYouTube,
        apiFetch,
        isLoading,
        hasYoutubeKey: config.youtube.keys.some(k => k.active),
        hasGeminiKey: config.gemini.keys.some(k => k.active),
        hasTikHubKey: (config.tikhub?.keys || []).some(k => k.active),
        hasKeiKey: (config.kei?.keys || []).some(k => k.active),
        getActiveKeiKey
    };
}
