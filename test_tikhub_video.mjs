// Test TikHub Hybrid API directly
const testUrls = [
    'https://www.tiktok.com/@tiktok/video/7123456789012345678', // Example TikTok
    'https://www.instagram.com/reel/DEmWE6ZvQzC/', // Example Instagram reel
    'https://www.xiaohongshu.com/explore/6788d5c7000000002201d632' // Example Xiaohongshu
];

async function testTikHub() {
    // Get API key from DB (replace with actual key from check_all_api_keys.js)
    const apiKey = process.env.TIKHUB_API_KEY || 'i7wTvz2skRIoY2d0T4MU6z7c56YjaTxVEVWM1q4XpfJKw==';

    for (const url of testUrls) {
        console.log('\n=== Testing URL:', url, '===');

        // Hybrid API - auto-detects platform
        const hybridEndpoint = `https://api.tikhub.io/api/v1/hybrid/video_data?url=${encodeURIComponent(url)}`;

        console.log('API Endpoint:', hybridEndpoint);

        try {
            const res = await fetch(hybridEndpoint, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });

            console.log('Status:', res.status);
            const data = await res.json();
            console.log('Response:', JSON.stringify(data, null, 2).slice(0, 3000));
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

testTikHub();
