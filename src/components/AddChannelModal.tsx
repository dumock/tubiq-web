'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Youtube, Loader2, Check } from 'lucide-react';
import { useYouTubeApi } from '@/hooks/useYouTubeApi';

// Extend ChannelData to match backend requirements
export interface ChannelData {
    id: string; // Internal ID or Channel ID
    title: string;
    handle: string;
    thumbnailUrl: string;
    subscriberCount?: number;
    viewCount?: number;
    videoCount?: number;
    publishedAt?: string | null; // ISO date string
    platform?: 'youtube' | 'tiktok' | 'douyin' | 'instagram' | 'xiaohongshu'; // Platform type
    channelUrl?: string; // Original URL
}

interface AddChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (channel: ChannelData) => void;
}

export default function AddChannelModal({ isOpen, onClose, onSave }: AddChannelModalProps) {
    const { fetchYouTube, config } = useYouTubeApi();
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resolvedChannel, setResolvedChannel] = useState<ChannelData | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Restore focus to input when loading finishes, so user can press Enter again to save
    useEffect(() => {
        if (!isLoading && isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isLoading, isOpen]);

    if (!isOpen) return null;

    const handleCheckOrSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // 1. If we already have a resolved channel, perform the "Save" action
        if (resolvedChannel) {
            console.log('[Modal] Saving resolved channel:', resolvedChannel);
            try {
                await onSave(resolvedChannel);
                console.log('[Modal] Save complete, resetting state.');
                resetAndClose();
            } catch (err) {
                console.error('[Modal] Save error:', err);
                setError('채널 저장 중 오류가 발생했습니다.');
            }
            return;
        }

        // 2. Otherwise, perform the "Check" (Resolve) action
        if (!input.trim()) {
            setError('채널 링크 또는 핸들명을 입력해주세요.');
            return;
        }

        setIsLoading(true);

        // Extract URL if input contains mixed text (e.g. Douyin share text)
        let queryInput = input;
        const urlMatch = input.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            queryInput = urlMatch[0];
        }

        const url = queryInput.trim();
        let platform = 'youtube';
        if (url.includes('tiktok.com')) platform = 'tiktok';
        else if (url.includes('instagram.com')) platform = 'instagram';
        else if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) platform = 'xiaohongshu';
        else if (url.includes('douyin.com')) platform = 'douyin';

        try {
            // --- NON-YOUTUBE PLATFORMS ---
            if (platform !== 'youtube') {
                const tikHubKeys = config?.tikhub?.keys || [];
                const activeKeyEntry = tikHubKeys.find((k: any) => k.active);
                const activeKey = activeKeyEntry?.key;

                let foundChannel: ChannelData | null = null;
                let specificError = ''; // Track specific errors

                // 1. TikTok Profile
                if (platform === 'tiktok') {
                    if (!activeKey) throw new Error('TikHub API Key required for TikTok');
                    console.log('[Client] Fetching TikTok Profile via TikHub...');

                    // Robust TikTok handle extraction
                    let uniqueId: string | null = null;
                    try {
                        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
                        const segments = urlObj.pathname.split('/').filter(Boolean);
                        if (segments.length > 0) {
                            uniqueId = segments[0].replace(/^@/, '');
                        }
                    } catch (e) {
                        // Regex fallback
                        const match = url.match(/(?:@|tiktok\.com\/|^)([a-zA-Z0-9_.]+)/);
                        if (match) uniqueId = match[1];
                    }

                    if (uniqueId) {
                        console.log('[Client] Extracted TikTok uniqueId:', uniqueId);

                        // Retry logic for TikTok
                        // Use Web API first
                        const endpoints = [
                            `https://api.tikhub.io/api/v1/tiktok/web/fetch_user_profile?unique_id=${uniqueId}`,
                            `https://api.tikhub.io/api/v1/tiktok/app/v3/handler_user_profile?unique_id=${uniqueId}`,
                        ];

                        let json: any = null;
                        for (const endpoint of endpoints) {
                            try {
                                const res = await fetch(endpoint, {
                                    headers: { 'Authorization': `Bearer ${activeKey}` }
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    const userData = data?.data?.userInfo || data?.data;
                                    if (userData && (userData.user || userData.uniqueId || userData.secUid || userData.unique_id)) {
                                        json = data;
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.warn(`[Client] TikTok fetch failed for ${endpoint}:`, e);
                            }
                        }

                        const data = json?.data?.userInfo || json?.data;
                        console.log('[Client] TikTok final json response:', json);

                        if (data && (data.user || data.uniqueId || data.secUid || data.unique_id)) {
                            const user = data.user || data;
                            const stats = data.stats || user || data; // stats can be nested or direct in App V3

                            // Handle various avatar structures (Web camelCase vs App snake_case + url_list)
                            const rawThumb = user.avatarThumb?.url_list?.[0] ||
                                user.avatar_thumb?.url_list?.[0] ||
                                user.avatarThumb ||
                                user.avatar_thumb ||
                                user.avatarMedium ||
                                user.avatar;

                            const proxyThumb = rawThumb && typeof rawThumb === 'string'
                                ? `https://wsrv.nl/?url=${encodeURIComponent(rawThumb)}&output=webp`
                                : '';

                            foundChannel = {
                                id: String(user.id || user.uid || user.uniqueId || user.unique_id || user.secUid || user.sec_uid),
                                title: user.nickname || user.uniqueId || user.unique_id || uniqueId,
                                handle: '@' + (user.uniqueId || user.unique_id || uniqueId),
                                thumbnailUrl: proxyThumb,
                                subscriberCount: Number(stats?.followerCount || stats?.follower_count || stats?.followers || 0),
                                videoCount: Number(stats?.videoCount || stats?.awemeCount || stats?.aweme_count || 0),
                                platform: 'tiktok',
                                channelUrl: `https://www.tiktok.com/@${uniqueId}`
                            };
                        } else {
                            console.warn('[Client] TikTok user not found or structure mismatch:', json);
                            // Fallback: Create basic channel info if API fails
                            foundChannel = {
                                id: `tiktok-${uniqueId}`,
                                title: uniqueId,
                                handle: '@' + uniqueId,
                                thumbnailUrl: '',
                                platform: 'tiktok',
                                channelUrl: `https://www.tiktok.com/@${uniqueId}`
                            };
                            specificError = `(주의) 상세 정보를 가져올 수 없어 기본 정보로 저장합니다.`;
                        }
                    }
                }

                // 2. Instagram Profile
                else if (platform === 'instagram') {
                    if (!activeKey) throw new Error('TikHub API Key required for Instagram');
                    console.log('[Client] Fetching Instagram Profile via TikHub...');

                    let username: string | null = null;
                    try {
                        const urlObj = new URL(url);
                        // Pathname is usually /username/ or /username
                        const segments = urlObj.pathname.split('/').filter(Boolean);
                        if (segments.length > 0) {
                            const first = segments[0];
                            const reserved = ['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'direct', 'accounts'];
                            if (!reserved.includes(first)) {
                                username = first;
                            }
                        }
                    } catch (e) {
                        console.warn('Invalid URL for parsing:', url);
                        // Fallback to regex if URL parsing fails (e.g. partial URL)
                        const userMatch = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
                        if (userMatch) username = userMatch[1];
                    }

                    console.log('[Client] Extracted Instagram username:', username);

                    if (username && username.length > 1) {
                        if (!activeKey) throw new Error('TikHub API Key required for Instagram');
                        console.log('[Client] Extracted Instagram username:', username);

                        // Try multiple TikHub API versions for robustness
                        const endpoints = [
                            `https://api.tikhub.io/api/v1/instagram/v1/fetch_user_info_by_username?username=${username}`,
                            `https://api.tikhub.io/api/v1/instagram/v1/fetch_user_info_by_username_v2?username=${username}`,
                            `https://api.tikhub.io/api/v1/instagram/v1/fetch_user_info_by_username_v3?username=${username}`
                        ];

                        let json: any = null;
                        for (const endpoint of endpoints) {
                            try {
                                const res = await fetch(endpoint, {
                                    headers: { 'Authorization': `Bearer ${activeKey}` }
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    const userData = data?.data?.user || data?.data;
                                    if (userData && (userData.username || userData.id || userData.user_id || userData.pk)) {
                                        json = data;
                                        break; // Success!
                                    }
                                }
                            } catch (e) {
                                console.warn(`[Client] Instagram fetch failed for ${endpoint}:`, e);
                            }
                        }

                        // TikHub V1/V2/V3 response parsing
                        const userData = json?.data?.user || json?.data;
                        console.log('[Client] Instagram final json response:', json);

                        if (userData && (userData.username || userData.id || userData.user_id || userData.pk)) {
                            const uname = userData.username || username;

                            // Map fields flexibly across different TikHub/Instagram API versions
                            const rawThumb = userData.avatar_url || userData.avatar || userData.profile_pic_url_hd || userData.profile_pic_url;
                            const proxyThumb = rawThumb ? `https://wsrv.nl/?url=${encodeURIComponent(rawThumb)}&output=webp` : '';

                            const followers = userData.followers || userData.follower_count || userData.edge_followed_by?.count || 0;
                            const posts = userData.posts_count || userData.media_count || userData.edge_owner_to_timeline_media?.count || 0;
                            const name = userData.full_name || userData.nickname || userData.name || uname;

                            foundChannel = {
                                id: String(userData.pk || userData.id || userData.user_id || `instagram-${uname}`),
                                title: name,
                                handle: '@' + uname,
                                thumbnailUrl: proxyThumb,
                                subscriberCount: Number(followers),
                                videoCount: Number(posts),
                                platform: 'instagram',
                                channelUrl: `https://www.instagram.com/${uname}/`,
                                publishedAt: userData.join_date || userData.created_at || null
                            };
                        } else {
                            console.warn('[Client] Instagram user not found or structure mismatch:', json);
                            // Fallback: Create basic channel info if API fails
                            foundChannel = {
                                id: `instagram-${username}`,
                                title: username, // Use username as title
                                handle: '@' + username,
                                thumbnailUrl: '', // No avatar
                                platform: 'instagram',
                                channelUrl: `https://www.instagram.com/${username}/`
                            };
                            specificError = `(주의) 상세 정보를 가져올 수 없어 기본 정보로 저장합니다.`;
                        }
                    } else {
                        console.warn('[Client] Failed to extract valid Instagram username from URL:', url);
                        specificError = 'URL에서 인스타그램 사용자 이름을 찾을 수 없습니다. 프로필 URL이 맞는지 확인해주세요.';
                    }
                }

                // 3. Xiaohongshu Profile
                else if (platform === 'xiaohongshu') {
                    if (!activeKey) throw new Error('TikHub API Key required for Xiaohongshu');
                    // 1. Sanitize input (strip hidden chars/bullet points)
                    let cleanUrl = url.trim().replace(/^[^h]+/, ''); // Strip anything before 'http' if present
                    if (!cleanUrl.startsWith('http')) {
                        // If it doesn't start with http, maybe it's just a path or ID, but let's try to keep it as is for regex
                        cleanUrl = url.trim();
                    }

                    // Robust XHS user_id extraction
                    let userId: string | null = null;
                    try {
                        const targetUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
                        const urlObj = new URL(targetUrl);
                        const segments = urlObj.pathname.split('/').filter(Boolean);

                        // Case 1: /user/profile/USER_ID
                        if (segments.includes('profile')) {
                            const idx = segments.indexOf('profile');
                            if (segments[idx + 1]) userId = segments[idx + 1];
                        }
                        // Case 2: /user/USER_ID
                        else if (segments.includes('user')) {
                            const idx = segments.indexOf('user');
                            if (segments[idx + 1]) userId = segments[idx + 1];
                        }
                        // Case 3: Just the last segment
                        else if (segments.length > 0) {
                            userId = segments[segments.length - 1];
                        }
                    } catch (e) {
                        console.warn('[Client] URL parsing failed for XHS, falling back to regex:', cleanUrl);
                    }

                    // Regex fallback covers cases where URL is partial or corrupted
                    if (!userId) {
                        const match = cleanUrl.match(/(?:profile\/|user\/|^)([a-zA-Z0-9]{24})/); // XHS IDs are 24 chars hex
                        if (match) userId = match[1];
                    }

                    if (userId) {
                        console.log('[Client] Extracted Xiaohongshu userId:', userId);

                        const endpoints = [
                            `https://api.tikhub.io/api/v1/xiaohongshu/web/get_user_info?user_id=${userId}`,
                            `https://api.tikhub.io/api/v1/xiaohongshu/web/fetch_user_profile?user_id=${userId}`,
                            `https://api.tikhub.io/api/v1/xiaohongshu/web_v2/fetch_home_notes?user_id=${userId}`
                        ];

                        let json: any = null;
                        for (const endpoint of endpoints) {
                            try {
                                const res = await fetch(endpoint, {
                                    headers: { 'Authorization': `Bearer ${activeKey}` }
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    // Handle both direct profile responses and home_notes list responses
                                    const hasProfile = data?.data && (data.data.nickname || data.data.basic_info || data.data.user_info);
                                    const hasNotes = data?.data?.notes && data.data.notes.length > 0;

                                    if (hasProfile || hasNotes) {
                                        json = data;
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.warn(`[Client] Xiaohongshu fetch failed for ${endpoint}:`, e);
                            }
                        }

                        console.log('[Client] Xiaohongshu final json response:', json);
                        const data = json?.data;
                        if (data) {
                            const info = data.basic_info || data.user_info || (data.notes?.[0]?.user || data.notes?.[0]?.author) || data;
                            const stats = data.interactions || data;

                            let rawThumb = info.images || info.avatar || info.avatar_url || '';
                            if (Array.isArray(rawThumb) && rawThumb.length > 0) {
                                rawThumb = rawThumb[0];
                            }
                            const proxyThumb = rawThumb && typeof rawThumb === 'string'
                                ? `https://wsrv.nl/?url=${encodeURIComponent(rawThumb)}&output=webp`
                                : (typeof rawThumb === 'string' ? rawThumb : '');

                            // XHS stats can be very nested
                            let followers = data.fans || info.fans || 0;
                            if (Array.isArray(stats)) {
                                const fansObj = stats.find((s: any) => s.type === 'fans' || s.name === '粉丝');
                                if (fansObj) followers = fansObj.count;
                            }

                            foundChannel = {
                                id: userId,
                                title: info.nickname || 'Xiaohongshu User',
                                handle: info.red_id || info.userid || info.user_id || userId,
                                thumbnailUrl: proxyThumb,
                                subscriberCount: Number(followers),
                                platform: 'xiaohongshu',
                                channelUrl: `https://www.xiaohongshu.com/user/profile/${userId}`
                            };
                        } else {
                            console.warn('[Client] Xiaohongshu metadata resolve failed, using fallback.');
                            // Fallback
                            foundChannel = {
                                id: userId,
                                title: `XHS-${userId.slice(-4)}`,
                                handle: userId,
                                thumbnailUrl: '',
                                platform: 'xiaohongshu',
                                channelUrl: `https://www.xiaohongshu.com/user/profile/${userId}`
                            };
                        }
                    } else {
                        console.warn('[Client] Failed to extract XHS ID from:', cleanUrl);
                        specificError = 'URL에서 사용자 ID를 추출할 수 없습니다. 프로필 주소 전체를 입력해주세요.';
                    }
                }

                // 4. Douyin Profile
                else if (platform === 'douyin') {
                    if (!activeKey) throw new Error('TikHub API Key required for Douyin');
                    // Try to extract sec_user_id from URL if possible
                    const secMatch = url.match(/douyin\.com\/user\/([a-zA-Z0-9_-]+)/);
                    const secUserId = secMatch ? secMatch[1] : null;

                    if (secUserId) {
                        try {
                            const res = await fetch(`https://api.tikhub.io/api/v1/douyin/web/fetch_user_profile?sec_user_id=${secUserId}`, {
                                headers: { 'Authorization': `Bearer ${activeKey}` }
                            });
                            const json = await res.json();
                            const data = json?.data?.user_info || json?.data;

                            if (data && (data.nickname || data.sec_uid)) {
                                foundChannel = {
                                    id: data.sec_uid || secUserId,
                                    title: data.nickname || 'Douyin User',
                                    handle: 'Douyin',
                                    thumbnailUrl: data.avatar_thumb?.url_list?.[0] || data.avatar,
                                    subscriberCount: Number(data.m_follower_count || data.follower_count || 0),
                                    platform: 'douyin',
                                    channelUrl: url
                                };
                            }
                        } catch (e) {
                            console.warn('[Client] Douyin fetch failed:', e);
                        }
                    }

                    if (!foundChannel) {
                        // Fallback logic for Douyin
                        foundChannel = {
                            id: secUserId || `douyin-${Date.now()}`,
                            title: 'Douyin Channel',
                            handle: 'Douyin User',
                            thumbnailUrl: '',
                            platform: 'douyin',
                            channelUrl: url
                        };
                        if (secUserId) {
                            specificError = `(주의) 상세 정보를 가져올 수 없어 기본 정보로 저장합니다.`;
                        }
                    }
                }

                if (foundChannel) {
                    console.log('[Modal] Resolved channel metadata:', foundChannel);
                    setResolvedChannel(foundChannel);
                } else {
                    console.warn('[Modal] No channel found after resolve process.');
                    // Use the specific error if one was set during the process
                    // (We can't check 'error' state here because it hasn't updated yet)
                    if (specificError) {
                        setError(specificError);
                    } else {
                        setError(`${platform} 채널 정보를 가져올 수 없습니다. URL을 확인해주세요.`);
                    }
                }

            } else {
                // --- YOUTUBE LOGIC (Existing) ---
                const res = await fetchYouTube(`/api/youtube/resolve-channel?input=${encodeURIComponent(queryInput)}`)
                const data = await res.json();

                if (!res.ok || !data.ok) {
                    if (res.status === 404) {
                        setError('채널을 찾을 수 없습니다. 핸들명(@...)이나 URL을 확인해주세요.');
                    } else if (res.status === 400 && data.message === 'missing api key') {
                        setError('서버에 YouTube API Key가 설정되지 않았습니다.');
                    } else {
                        setError(data.message || '채널 정보를 가져오는 중 오류가 발생했습니다.');
                    }
                    setResolvedChannel(null);
                } else {
                    setResolvedChannel({
                        ...data.channel,
                        platform: 'youtube', // Ensure platform is set
                        channelUrl: data.channel.channelUrl || `https://youtube.com/${data.channel.handle}`
                    });
                }
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || '네트워크 오류가 발생했습니다.');
            setResolvedChannel(null);
        } finally {
            setIsLoading(false);
        }
    };

    const resetAndClose = () => {
        setInput('');
        setError('');
        setResolvedChannel(null);
        setIsLoading(false);
        onClose();
    };

    const handleInputChange = (val: string) => {
        setInput(val);
        if (resolvedChannel) {
            setResolvedChannel(null);
        }
        if (error) setError('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 transform transition-all">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <Youtube className="w-6 h-6 text-red-600 dark:text-red-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            채널 저장
                        </h3>
                    </div>
                    <button
                        onClick={resetAndClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleCheckOrSave} className="p-6">
                    <div className="mb-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                채널 링크 또는 핸들명
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => handleInputChange(e.target.value)}
                                placeholder="YouTube/TikTok/Insta/RED 채널 URL"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400 dark:placeholder-zinc-500 disabled:opacity-50"
                                autoFocus
                                disabled={isLoading}
                            />
                            {error && (
                                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                    {error}
                                </p>
                            )}
                            {!error && !resolvedChannel && (
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    지원: YouTube, TikTok, Instagram, Xiaohongshu, Douyin
                                </p>
                            )}
                        </div>

                        {/* Resolved Channel Card */}
                        {resolvedChannel && (
                            <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                                <img
                                    src={resolvedChannel.thumbnailUrl || '/placeholder-user.png'}
                                    alt={resolvedChannel.title}
                                    className="w-12 h-12 rounded-full object-cover bg-gray-200"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + resolvedChannel.title;
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                        {resolvedChannel.title}
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        {resolvedChannel.handle}
                                    </p>
                                    <div className="flex gap-2 text-xs text-gray-400 mt-1">
                                        <span className="capitalize">{resolvedChannel.platform}</span>
                                        {resolvedChannel.subscriberCount && (
                                            <span>• 구독자 {resolvedChannel.subscriberCount.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-indigo-600 dark:text-indigo-400">
                                    <Check className="w-5 h-5" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            disabled={isLoading}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || (!input.trim() && !resolvedChannel)}
                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 dark:shadow-none transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>확인 중...</span>
                                </>
                            ) : resolvedChannel ? (
                                '저장하기'
                            ) : (
                                '채널 확인'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
