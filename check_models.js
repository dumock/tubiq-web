const https = require('https');

const url = 'https://f0ogk403l5iqtd-8188.proxy.runpod.net/object_info';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const unetInputs = json['UNETLoader']?.input?.required?.unet_name?.[0] || [];
            const ckptInputs = json['CheckpointLoaderSimple']?.input?.required?.ckpt_name?.[0] || [];
            console.log('UNET models:', unetInputs);
            console.log('Checkpoint models:', ckptInputs);
        } catch (e) {
            console.error('JSON Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
