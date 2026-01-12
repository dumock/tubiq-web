const https = require('https');

const url = 'https://f0ogk403l5iqtd-8188.proxy.runpod.net/object_info';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const models = json['UNETLoader']?.input?.required?.unet_name?.[0] || [];
            const videoKeywords = ['video', 'svd', 'i2v', 't2v', 'cosmos', 'hunyuan', 'ltxv', 'cogvideo'];
            const videoModels = models.filter(m => videoKeywords.some(k => m.toLowerCase().includes(k)));
            console.log('Detected Video Models:', videoModels);
        } catch (e) {
            console.error('JSON Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
