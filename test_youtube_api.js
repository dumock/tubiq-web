
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.YOUTUBE_API_KEY_1;
const CHANNEL_HANDLE = '@dailyjihyun';

async function testYoutubeApi() {
    console.log('API Key (first 10 chars):', API_KEY?.substring(0, 10) + '...');

    if (!API_KEY) {
        console.error('❌ No API key found in env');
        return;
    }

    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${CHANNEL_HANDLE}&key=${API_KEY}`;

    console.log('Fetching:', url.replace(API_KEY, 'API_KEY_HIDDEN'));

    try {
        const res = await fetch(url);
        console.log('Status:', res.status, res.statusText);

        const text = await res.text();

        if (res.ok) {
            const json = JSON.parse(text);
            if (json.items && json.items.length > 0) {
                console.log('✅ SUCCESS! Channel found:');
                console.log('   Title:', json.items[0].snippet.title);
                console.log('   ID:', json.items[0].id);
            } else {
                console.log('⚠️ No items returned');
            }
        } else {
            console.log('❌ Error response:');
            console.log(text.substring(0, 500));
        }
    } catch (e) {
        console.error('❌ Fetch error:', e.message);
    }
}

testYoutubeApi();
