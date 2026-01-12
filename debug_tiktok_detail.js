
const https = require('https');

const TIKHUB_KEY = 'q7YhBZgQ/XWgs3LORNKW7BjAHRK/ZqM9ySL4tGekWPGHtlO5KyS9QAiFCQ==';
const uniqueId = 'yuyonghan_jisig';

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'Authorization': `Bearer ${TIKHUB_KEY}` }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        }).on('error', reject);
    });
}

async function inspectTikTokApp() {
    const url = `https://api.tikhub.io/api/v1/tiktok/app/v3/handler_user_profile?unique_id=${uniqueId}`;
    console.log(`\n--- Inspecting App Handler for ${uniqueId} ---`);
    try {
        const res = await fetch(url);
        if (res.status === 200) {
            console.log('JSON Structure:', JSON.stringify(res.data, null, 2));
        } else {
            console.log('Error Status:', res.status, res.data);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

inspectTikTokApp();
