
const https = require('https');

const TIKHUB_KEY = 'q7YhBZgQ/XWgs3LORNKW7BjAHRK/ZqM9ySL4tGekWPGHtlO5KyS9QAiFCQ==';
const nickname = '用户啥啥啥';

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

async function run() {
    console.log(`\n--- Searching for nickname: ${nickname} ---`);
    const searchUrl = `https://api.tikhub.io/api/v1/xiaohongshu/web/fetch_search_user?keyword=${encodeURIComponent(nickname)}`;
    try {
        const res = await fetch(searchUrl);
        console.log('Status:', res.status);
        if (res.status === 200) {
            const users = res.data.data?.user_list || res.data.data?.userList || [];
            console.log('Found users Count:', users.length);
            for (const u of users) {
                console.log(` - Nickname: ${u.nickname}, ID: ${u.user_id || u.userid}, Fans: ${u.fans || u.followerCount || u.follower_count}`);
                if (u.user_id === '56586afb82ec39252e1313f5' || u.userid === '56586afb82ec39252e1313f5') {
                    console.log('MATCH FOUND!');
                    console.log('Full User Object:', JSON.stringify(u, null, 2));
                }
            }
        } else {
            console.log('Body:', res.data);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
