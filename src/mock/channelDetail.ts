export const MOCK_CHANNELS: Record<string, any> = {
    '1': {
        id: '1',
        name: 'Tech Insider',
        handle: '@techinsider',
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop',
        subscribers: 2500000,
        totalViews: 450000000,
        videoCount: 1200,
        avg7dViews: 125000,
        total30dViews: 3800000
    },
    '2': {
        id: '2',
        name: '미스터 비스트 한국팬',
        handle: '@mrbeastkorean',
        thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&h=100&fit=crop',
        subscribers: 850000,
        totalViews: 120000000,
        videoCount: 450,
        avg7dViews: 45000,
        total30dViews: 1200000
    }
};

export const MOCK_VIDEOS = [
    {
        id: 'v1',
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=320&h=180&fit=crop',
        title: '2024년 최고의 가성비 노트북 TOP 5',
        uploadDate: '2024.12.20',
        todayViews: 12500,
        totalViews: 450000,
        status: '활성'
    },
    {
        id: 'v2',
        thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=320&h=180&fit=crop',
        title: 'M3 MacBook Air 한 달 사용 후기',
        uploadDate: '2024.12.15',
        todayViews: 8200,
        totalViews: 890000,
        status: '활성'
    },
    {
        id: 'v3',
        thumbnail: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=320&h=180&fit=crop',
        title: '아이폰 16 Pro 데저트 티타늄 언박싱',
        uploadDate: '2024.12.10',
        todayViews: 5400,
        totalViews: 1250000,
        status: '활성'
    }
];
