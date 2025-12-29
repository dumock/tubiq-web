export interface Video {
    id: string;
    title: string;
    views: number;
    publishedAt: string;
    thumbnailUrl: string;
    contribution: number;
    status: 'Published' | 'Processing' | 'Scheduled' | 'Failed';
    channelName: string;
}

export const mockVideos: Video[] = [
    {
        id: 'v1',
        title: 'Amazing Tech Review 2024',
        views: 1200000,
        publishedAt: '2025.12.18',
        thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=225&fit=crop',
        contribution: 15.2,
        status: 'Published',
        channelName: 'TubiQ Official'
    },
    {
        id: 'v2',
        title: 'How to code in React 19',
        views: 45000,
        publishedAt: '2025.12.15',
        thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
        contribution: -5.4,
        status: 'Processing',
        channelName: 'Code with Me'
    },
    {
        id: 'v3',
        title: 'Deepmind AI Update',
        views: 350000,
        publishedAt: '2025.12.10',
        thumbnailUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=225&fit=crop',
        contribution: 22.1,
        status: 'Published',
        channelName: 'Deepmind AI'
    },
    {
        id: 'v4',
        title: 'Vlog: Life as a Developer',
        views: 80000,
        publishedAt: '2025.11.20',
        thumbnailUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=225&fit=crop',
        contribution: 2.8,
        status: 'Published',
        channelName: 'Daily Vloggers'
    },
    {
        id: 'v5',
        title: 'Gaming Setup Tour',
        views: 2500000,
        publishedAt: '2025.12.19',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=225&fit=crop',
        contribution: 45.0,
        status: 'Published',
        channelName: 'Gaming Heaven'
    },
    {
        id: 'v6',
        title: 'Cooking Masterclass',
        views: 600000,
        publishedAt: '2025.12.05',
        thumbnailUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=225&fit=crop',
        contribution: 12.5,
        status: 'Scheduled',
        channelName: 'Foodie Heaven'
    },
    {
        id: 'v7',
        title: 'Travel to Japan',
        views: 150000,
        publishedAt: '2025.12.12',
        thumbnailUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=225&fit=crop',
        contribution: -1.2,
        status: 'Published',
        channelName: 'Travel Diaries'
    },
    {
        id: 'v8',
        title: 'New Gadget Unboxing',
        views: 90000,
        publishedAt: '2025.12.01',
        thumbnailUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=225&fit=crop',
        contribution: 8.9,
        status: 'Published',
        channelName: 'Tech Reviews'
    },
    {
        id: 'v9',
        title: 'My Morning Routine',
        views: 32000,
        publishedAt: '2025.12.17',
        thumbnailUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=225&fit=crop',
        contribution: -15.5,
        status: 'Published',
        channelName: 'Morning Vibes'
    },
    {
        id: 'v10',
        title: 'Study With Me 4H',
        views: 550000,
        publishedAt: '2025.11.15',
        thumbnailUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=225&fit=crop',
        contribution: 30.2,
        status: 'Published',
        channelName: 'Study Lab'
    },
];
