
const https = require('https');

const TIKHUB_KEY = 'q7YhBZgQ/XWgs3LORNKW7BjAHRK/ZqM9ySL4tGekWPGHtlO5KyS9QAiFCQ==';
const userId = '570a47bf4775a737e80f8035';

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

async function testWorkingEP() {
    const url = `https://api.tikhub.io/api/v1/xiaohongshu/web/get_user_info?user_id=${userId}`;
    console.log(`\n--- Testing ${url} ---`);
    const res = await fetch(url);
    console.log('Status:', res.status);
    if (res.status === 200) {
        console.log('JSON:', JSON.stringify(res.data, null, 2));
    } else {
        console.log('Body:', res.data);
    }
}

testWorkingEP();
