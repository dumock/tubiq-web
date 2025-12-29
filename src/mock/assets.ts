export interface Asset {
    id: string;
    type: 'image' | 'video' | 'font' | 'other' | 'channel';
    title: string;
    size: string;
    dimensions?: string;
    updatedAt: string;
    url: string; // Color utility for now
    folderId?: string;
    // Channel specific props
    channelName?: string;
    subscribers?: number;
    createdAt?: string; // YYYY-MM-DD
    avatarUrl?: string;
    channelUrl?: string;
    views?: number;
}

export const mockAssets: Asset[] = [
    {
        id: '1',
        type: 'channel',
        title: 'Channel Banner 2024',
        channelName: 'TubiQ Official',
        subscribers: 12500,
        createdAt: '2023-01-15',
        size: '-',
        updatedAt: '2024-12-15',
        url: 'bg-indigo-100',
        folderId: 'favorites',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TubiQ',
        channelUrl: 'https://youtube.com/@tubiq'
    },
    {
        id: '2',
        type: 'channel',
        title: 'Profile Logo',
        channelName: 'Gaming Live',
        subscribers: 452000,
        createdAt: '2022-05-20',
        size: '-',
        updatedAt: '2024-11-20',
        url: 'bg-rose-100',
        folderId: 'favorites',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gaming',
        channelUrl: 'https://youtube.com/@gaminglive'
    },
    {
        id: '3',
        type: 'channel',
        title: 'Brand Font - Bold',
        channelName: 'Tech Reviews',
        subscribers: 8900,
        createdAt: '2024-03-10',
        size: '-',
        updatedAt: '2024-10-05',
        url: 'bg-gray-100',
        folderId: 'clients',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tech',
        channelUrl: 'https://youtube.com/@techreviews'
    },
    {
        id: '4',
        type: 'channel',
        title: 'Watermark',
        channelName: 'Daily Vlogs',
        subscribers: 120,
        createdAt: '2024-11-01',
        size: '-',
        updatedAt: '2024-09-12',
        url: 'bg-blue-100',
        folderId: 'clients',
        channelUrl: 'https://youtube.com/@dailyvlogs'
        // No avatarUrl to test fallback
    },
    {
        id: '5',
        type: 'channel',
        title: 'Intro Animation Project',
        channelName: 'Cooking Mama',
        subscribers: 1540000,
        createdAt: '2020-08-15',
        size: '-',
        updatedAt: '2024-12-01',
        url: 'bg-purple-100',
        folderId: 'collab',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cooking',
        channelUrl: 'https://youtube.com/@cookingmama'
    },
    {
        id: '6',
        type: 'channel',
        title: 'Thumbnail Template V2',
        channelName: 'Music Core',
        subscribers: 5000,
        createdAt: '2023-12-25',
        size: '-',
        updatedAt: '2024-12-18',
        url: 'bg-emerald-100',
        folderId: 'archive',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Music',
        channelUrl: 'https://youtube.com/@musiccore'
    },
];
