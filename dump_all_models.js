const https = require('https');

const url = 'https://f0ogk403l5iqtd-8188.proxy.runpod.net/object_info';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const results = {};
            for (const nodeType in json) {
                const node = json[nodeType];
                if (node.input && node.input.required) {
                    for (const inputName in node.input.required) {
                        const input = node.input.required[inputName];
                        if (Array.isArray(input) && Array.isArray(input[0])) {
                            if (inputName.toLowerCase().includes('name') || inputName.toLowerCase().includes('model') || inputName.toLowerCase().includes('unet') || inputName.toLowerCase().includes('ckpt')) {
                                results[nodeType + '.' + inputName] = input[0];
                            }
                        }
                    }
                }
            }
            console.log('Detected Model Lists:');
            for (const key in results) {
                const models = results[key].filter(m => m.toLowerCase().includes('wan') || m.toLowerCase().includes('i2v') || m.toLowerCase().includes('video'));
                if (models.length > 0) {
                    console.log(`- ${key}:`, models);
                }
            }
        } catch (e) {
            console.error('JSON Error:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
