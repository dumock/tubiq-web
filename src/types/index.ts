export interface Asset {
    id: string;
    type: 'channel' | 'video' | 'image' | 'font';
    title: string;
    channelName?: string;
    subscribers?: number;
    views?: number;
    createdAt?: string;
    size: string;
    updatedAt: string;
    url?: string; // Thumbnail or background
    folderId?: string | null;
    avatarUrl?: string;
    channelUrl?: string;
    youtubeChannelId?: string; // YouTube channel ID (e.g., UC...)
    youtubeVideoId?: string; // YouTube video ID
    topic?: string;
    topics_cached?: string[]; // Array of topic names or codes
    publishedAt?: string;
    viewCount?: number;
    videoCount?: number;
    memo?: string; // ✅ NEW: memo from Q-Sharer app
}

export interface Folder {
    id: string;
    name: string;
    order: number;
    createdAt: string;
    parentId: string | null;
    isSystem?: boolean;
}

export interface Video {
    id: string;
    title: string;
    thumbnailUrl: string;
    views: number;
    contribution: number;
    status: 'Published' | 'Processing' | 'Scheduled' | 'Failed';
    publishedAt: string;
    rank?: number;
}
