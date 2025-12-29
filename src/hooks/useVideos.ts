'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Asset } from '@/types';

interface DbVideo {
    id: string;
    youtube_video_id: string;
    title: string;
    thumbnail_url: string;
    view_count: number;
    published_at: string;
    collected_at: string;
    channels: { title: string } | null;
    folder_id: string | null;
}

function mapDbToAsset(v: DbVideo): Asset {
    return {
        id: v.id,
        type: 'video',
        title: v.title,
        channelName: v.channels?.title || '', // Mapped from joined table

        views: v.view_count,
        createdAt: v.published_at?.split('T')[0] || '',
        size: '-',
        updatedAt: v.collected_at?.split('T')[0] || '',
        url: v.thumbnail_url,
        folderId: v.folder_id || 'all', // Use DB folder_id
        youtubeVideoId: v.youtube_video_id
    };
}

export function useVideos() {
    const [videos, setVideos] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVideos = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setVideos([]);
                setIsLoading(false);
                return;
            }

            const res = await fetch('/api/videos', {
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
    }, []);

    const saveVideos = useCallback(async (newVideos: Asset[]): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                console.error('No token for saving videos');
                return false;
            }

            const payload = newVideos.map(v => ({
                youtube_video_id: v.youtubeVideoId,
                channel_id: v.youtubeChannelId, // Required by DB
                title: v.title,
                thumbnail_url: v.url,
                view_count: v.views || 0,
                published_at: v.createdAt
            }));

            console.log('Saving videos:', payload);

            const res = await fetch('/api/videos', {
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
    }, []);

    const deleteVideo = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
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
    }, [fetchVideos]);

    const updateVideoFolder = useCallback(async (videoIds: string[], folderId: string | null): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
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
    }, []);

    const clearAllVideos = useCallback(async (): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
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
    }, []);

    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

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
