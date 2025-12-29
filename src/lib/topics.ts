export const YOUTUBE_TOPICS = [
    { code: '/m/0k4bw', name: '축구' },
    { code: '/m/028sqc', name: 'K-Pop' },
    { code: '/m/0b3yr', name: '과학' },
    { code: '/m/03glz', name: '기술' },
    { code: '/m/0bzvm2', name: '게임' },
    { code: '/m/02jjt', name: '엔터/유머' },
    { code: '/m/019_sj', name: '일상/브이로그' },
    { code: '/m/02vxn', name: '영화/애니' },
    { code: '/m/01k82', name: '경제/재테크' },
    { code: '/m/02wbm', name: '푸드/요리' },
    { code: '/m/01h7lh', name: '뷰티/패션' },
    { code: '/m/06ntj', name: '스포츠/운동' },
    { code: '/m/068hy', name: '동물/펫' },
    { code: '/m/05qt0', name: '뉴스/이슈' },
    { code: '/m/01k82', name: '교육/지식' },
    { code: '/m/07y_7', name: '자동차/탈것' },
];

export const TOPIC_PRESETS = [
    { label: '축구&케이팝', codes: ['/m/0k4bw', '/m/028sqc'] },
    { label: '과학&기술', codes: ['/m/0b3yr', '/m/03glz'] },
    { label: '게임', codes: ['/m/0bzvm2'] },
];

export const getTopicName = (code: string) => {
    return YOUTUBE_TOPICS.find(t => t.code === code)?.name || code;
};
