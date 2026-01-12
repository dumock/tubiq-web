'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Asset } from '@/types';
import { useAuth } from '@/lib/AuthProvider';

interface DbVideo {
    id: string;
    youtube_video_id: string;
    title: string;
    thumbnail_url: string;
    view_count: number;
    published_at: string;
    collected_at: string;
    channels: { title: string } | null;
    channel_name: string | null;
    folder_id: string | null;
    memo: string | null;
    platform?: string; // ✅ NEW
    url?: string; // ✅ NEW: Content/Redirect URL
}

function mapDbToAsset(v: DbVideo): Asset {
    return {
        id: v.id,
        type: 'video',
        title: v.title,
        platform: v.platform || 'youtube', // ✅ NEW
        redirectUrl: v.url, // ✅ NEW: Map DB content URL to Asset
        channelName: v.channel_name || v.channels?.title || '', // Mapped from joined table or direct column

        views: v.view_count,
        createdAt: v.published_at?.split('T')[0] || '',
        size: '-',
        updatedAt: v.collected_at?.split('T')[0] || '',
        url: v.thumbnail_url,
        folderId: v.folder_id || 'all', // Use DB folder_id
        youtubeVideoId: v.youtube_video_id,
        memo: v.memo || undefined
    };
}

import { useYouTubeApi } from './useYouTubeApi';

export function useVideos() {
    const { isLoggedIn, session } = useAuth();
    const { fetchYouTube } = useYouTubeApi();
    const [videos, setVideos] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVideos = useCallback(async () => {
        const token = session?.access_token;
        if (!token) {
            setVideos([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetchYouTube('/api/videos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();

            if (json.ok && Array.isArray(json.data)) {
                setVideos(json.data.map(mapDbToAsset));
            }
        } catch (err) {
            console.error('Fetch videos error:', err);
            setError('Failed to fetch videos');
        } finally {
            setIsLoading(false);
        }
    }, [session, fetchYouTube]);

    const saveVideos = useCallback(async (newVideos: Asset[]): Promise<boolean> => {
        try {
            const token = session?.access_token;
            if (!token) {
                console.error('No token for saving videos');
                return false;
            }

            const payload = newVideos.map(v => ({
                youtube_video_id: v.youtubeVideoId,
                channel_id: v.youtubeChannelId, // Required by DB
                channel_name: v.channelName, // Added for redundancy
                title: v.title,
                thumbnail_url: v.url, // Asset.url is used as thumbnail in frontend
                view_count: v.views || 0,
                published_at: v.createdAt,
                collected_at: new Date().toISOString(), // Ensure sorting works
                platform: v.platform || 'youtube', // ✅ NEW
                url: v.redirectUrl || (v.platform !== 'youtube' ? v.url : undefined) // ✅ Include content URL from redirectUrl
            }));

            console.log('Saving videos:', payload);

            const res = await fetchYouTube('/api/videos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ videos: payload })
            });

            const json = await res.json();
            console.log('Save videos response:', json);

            if (!json.ok) {
                console.error('Save videos failed:', json.message);
            }
            return json.ok;
        } catch (err) {
            console.error('Save videos error:', err);
            return false;
        }
    }, [session]);

    const deleteVideo = useCallback(async (id: string): Promise<boolean> => {
        try {
            const token = session?.access_token;
            if (!token) return false;

            const res = await fetch(`/api/videos?id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const json = await res.json();
            if (json.ok) {
                await fetchVideos();
                return true;
            }
            return false;
        } catch (err) {
            console.error('Delete video error:', err);
            return false;
        }
    }, [fetchVideos, session]);

    const updateVideoFolder = useCallback(async (videoIds: string[], folderId: string | null): Promise<boolean> => {
        try {
            const token = session?.access_token;
            if (!token) return false;

            const res = await fetch('/api/videos', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ videoIds, folderId })
            });

            const json = await res.json();
            if (json.ok) {
                // Update local state
                setVideos(prev => prev.map(video =>
                    videoIds.includes(video.id)
                        ? { ...video, folderId: folderId || 'all' }
                        : video
                ));
                return true;
            }
            return false;
        } catch (err) {
            console.error('Update video folder error:', err);
            return false;
        }
    }, [session]);

    const clearAllVideos = useCallback(async (): Promise<boolean> => {
        try {
            const token = session?.access_token;
            if (!token) return false;

            const res = await fetch('/api/videos?all=true', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const json = await res.json();
            if (json.ok) {
                setVideos([]);
                return true;
            }
            return false;
        } catch (err) {
            console.error('Clear videos error:', err);
            return false;
        }
    }, [session]);

    // Initial fetch
    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    // Real-time subscription
    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) return;

        console.log('[Realtime] Starting subscription for user:', userId);
        const channel = supabase
            .channel(`videos-realtime-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'videos',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('[Realtime] ✅ Video insert detected:', payload);
                    fetchVideos(); // Re-fetch to get joined channel data and full metadata
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Subscription status:', status);
                if (status === 'CHANNEL_ERROR') {
                    console.error('[Realtime] Channel error - check if Realtime is enabled for videos table in Supabase dashboard');
                }
            });

        return () => {
            console.log('[Realtime] Cleaning up subscription');
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id, fetchVideos]);

    return {
        videos,
        setVideos,
        isLoading,
        error,
        fetchVideos,
        saveVideos,
        deleteVideo,
        clearAllVideos,
        updateVideoFolder
    };
}
