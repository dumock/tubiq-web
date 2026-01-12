const https = require('https');

const url = 'https://f0ogk403l5iqtd-8188.proxy.runpod.net/object_info';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('WanImageToVideo Input Metadata:', JSON.stringify(json['WanImageToVideo'].input, null, 2));
        } catch (e) {
            console.error('JSON Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
