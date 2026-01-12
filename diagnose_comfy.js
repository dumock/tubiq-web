const https = require('https');
require('dotenv').config({ path: '.env.local' });

const comfyUrl = process.env.COMFYUI_API_URL ? process.env.COMFYUI_API_URL.replace(/\/$/, '') : null;

if (!comfyUrl) {
    console.error("COMFYUI_API_URL is missing");
    process.exit(1);
}

function getObjectInfo(nodeClass) {
    return new Promise((resolve) => {
        https.get(`${comfyUrl}/object_info/${nodeClass}`, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(body);
                        resolve(json);
                    } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    console.log('--- Diagnosing ComfyUI Options ---');

    // Check Checkpoints
    const ckptInfo = await getObjectInfo('CheckpointLoaderSimple');
    if (ckptInfo && ckptInfo[Object.keys(ckptInfo)[0]]?.input?.required?.ckpt_name) {
        const models = ckptInfo[Object.keys(ckptInfo)[0]].input.required.ckpt_name[0];
        console.log(`\nAvailable Checkpoints (${models.length}):`);
        console.log(JSON.stringify(models, null, 2));
    } else {
        console.log('\n❌ Failed to get Checkpoint list');
    }

    // Check Samplers
    const samplerInfo = await getObjectInfo('KSampler');
    if (samplerInfo && samplerInfo[Object.keys(samplerInfo)[0]]?.input?.required?.sampler_name) {
        const samplers = samplerInfo[Object.keys(samplerInfo)[0]].input.required.sampler_name[0];
        console.log(`\nAvailable Samplers (${samplers.length}):`);
        console.log(JSON.stringify(samplers, null, 2));
    } else {
        console.log('\n❌ Failed to get Sampler list');
    }
}

run();
