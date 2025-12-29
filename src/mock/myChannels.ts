export interface MyChannel {
    channelId: string;
    title: string;
    handle?: string;
    thumbnailUrl: string;
    connected: boolean;
    trackingEnabled: boolean;
}

export const MOCK_MY_CHANNELS: MyChannel[] = [
    {
        channelId: 'UC_my_channel_1',
        title: '나의 일상 브이로그',
        handle: '@myvlog_daily',
        thumbnailUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vlog',
        connected: true,
        trackingEnabled: true,
    },
    {
        channelId: 'UC_my_channel_2',
        title: '게임하는 개발자',
        handle: '@dev_gamer',
        thumbnailUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=game',
        connected: true,
        trackingEnabled: false,
    },
    {
        channelId: 'UC_my_channel_3',
        title: '테크 리뷰 (Brand)',
        handle: '@tech_brand_review',
        thumbnailUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tech',
        connected: true,
        trackingEnabled: true,
    }
];
