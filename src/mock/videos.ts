export interface Video {
    id: string;
    channelId: string;
    thumbnail: string;
    title: string;
    publishedAt: string; // ISO format for better sorting
    uploadDate: string; // Display format
    todayViews: number;
    totalViews: number;
    status: 'active' | 'private' | 'deleted' | 'blocked_suspected';
}

export const MOCK_VIDEOS: Video[] = [
    {
        id: 'v1',
        channelId: '1',
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=320&h=180&fit=crop',
        title: '2024년 최고의 가성비 노트북 TOP 5',
        publishedAt: '2024-12-20T10:00:00Z',
        uploadDate: '2024.12.20',
        todayViews: 12500,
        totalViews: 450000,
        status: 'active'
    },
    {
        id: 'v2',
        channelId: '1',
        thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=320&h=180&fit=crop',
        title: 'M3 MacBook Air 한 달 사용 후기',
        publishedAt: '2024-12-15T08:30:00Z',
        uploadDate: '2024.12.15',
        todayViews: 8200,
        totalViews: 890000,
        status: 'active'
    },
    {
        id: 'v-del',
        channelId: '1',
        thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=320&h=180&fit=crop',
        title: '[삭제됨] 비공개 처리된 영상 샘플',
        publishedAt: '2024-12-12T15:00:00Z',
        uploadDate: '2024.12.12',
        todayViews: 0,
        totalViews: 150000,
        status: 'deleted'
    },
    {
        id: 'v-block',
        channelId: '1',
        thumbnail: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=320&h=180&fit=crop',
        title: '차단 의심 영상 테스트 (저작권 이슈 등)',
        publishedAt: '2024-12-05T12:00:00+09:00',
        uploadDate: '2024.12.05',
        todayViews: 50,
        totalViews: 30000,
        status: 'blocked_suspected'
    },
    // Videos for Channel 2 (Single Hit Case)
    {
        id: 'v2-1',
        channelId: '2',
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=320&h=180&fit=crop',
        title: '폭발적 조회수의 단일 영상',
        publishedAt: '2024-12-22T10:00:00Z',
        uploadDate: '2024.12.22',
        todayViews: 300000,
        totalViews: 1000000,
        status: 'active'
    },
    {
        id: 'v2-2',
        channelId: '2',
        thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=320&h=180&fit=crop',
        title: '평범한 성과의 영상 A',
        publishedAt: '2024-12-20T10:00:00Z',
        uploadDate: '2024.12.20',
        todayViews: 10000,
        totalViews: 50000,
        status: 'active'
    },
    {
        id: 'v2-3',
        channelId: '2',
        thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=320&h=180&fit=crop',
        title: '평범한 성과의 영상 B',
        publishedAt: '2024-12-18T10:00:00Z',
        uploadDate: '2024.12.18',
        todayViews: 5000,
        totalViews: 80000,
        status: 'active'
    },
    // Videos for Channel 4 (New Rising & High Efficiency)
    {
        id: 'v4-1',
        channelId: '4',
        thumbnail: 'https://picsum.photos/seed/v41/320/180',
        title: '신규 채널의 고효율 영상',
        publishedAt: '2024-12-23T10:00:00Z',
        uploadDate: '2024.12.23',
        todayViews: 50000,
        totalViews: 100000,
        status: 'active'
    }
];

// Add more mock videos for channel '1' to test slicing
for (let i = 1; i <= 100; i++) {
    MOCK_VIDEOS.push({
        id: `v-extra-${i}`,
        channelId: '1',
        thumbnail: `https://picsum.photos/seed/v${i}/320/180`,
        title: `과거 업로드 영상 #${i}`,
        publishedAt: new Date(2024, 11, 1 - i).toISOString(),
        uploadDate: `2024.11.${30 - i}`,
        todayViews: Math.floor(1000 - i * 10),
        totalViews: Math.floor(100000 - i * 1000),
        status: 'active'
    });
}

// Add the old hit at the end (beyond the first 30)
MOCK_VIDEOS.push({
    id: 'v-old-hit',
    channelId: '1',
    thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=320&h=180&fit=crop',
    title: '과거에 올렸던 전설의 영상 (역주행 중)',
    publishedAt: '2023-01-01T10:00:00Z', // Very old
    uploadDate: '2023.01.01',
    todayViews: 120000, // Higher than any other video
    totalViews: 5000000,
    status: 'active'
});
