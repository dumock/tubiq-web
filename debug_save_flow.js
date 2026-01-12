// Native fetch in Node 18+

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

async function checkYouTubeDirectly() {
    const channelId = 'UCE9LgqslvlZIySGMCKg89sQ';
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;

    console.log('Fetching from YouTube:', url.replace(YOUTUBE_API_KEY, 'HIDDEN_KEY'));

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.items && data.items.length > 0) {
            console.log('Snippet PublishedAt:', data.items[0].snippet.publishedAt);
        } else {
            console.log('Channel not found via API. Full response:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

require('dotenv').config({ path: '.env.local' });
checkYouTubeDirectly();
