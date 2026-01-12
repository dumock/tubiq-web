const https = require('https');

const url = 'https://f0ogk403l5iqtd-8188.proxy.runpod.net/queue';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Queue Status:', data);
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
