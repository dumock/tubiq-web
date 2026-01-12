const https = require('https');

const url = 'https://f0ogk403l5iqtd-8188.proxy.runpod.net/object_info';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const nodes = Object.keys(json);
            const wanNodes = nodes.filter(n => n.toLowerCase().includes('wan'));
            console.log('Available WAN Nodes:', wanNodes);
            if (json['WanImageToVideo']) {
                console.log('WanImageToVideo found');
            } else {
                console.log('WanImageToVideo NOT found');
            }
        } catch (e) {
            console.error('JSON Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
