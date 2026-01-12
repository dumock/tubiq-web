const fetch = require('node-fetch'); // Needs node-fetch v2 or setup
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const comfyUrl = process.env.COMFYUI_API_URL ? process.env.COMFYUI_API_URL.replace(/\/$/, '') : null;

if (!comfyUrl) {
    console.error("COMFYUI_API_URL is missing from .env.local");
    process.exit(1);
}

console.log(`Checking ComfyUI at: ${comfyUrl}`);

function checkEndpoint(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `${comfyUrl}${endpoint}`;
        console.log(`GET ${url}`);

        https.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(body);
                        console.log('Response (partial):', JSON.stringify(json).substring(0, 100));
                        resolve(true);
                    } catch (e) {
                        console.log('Response Body:', body.substring(0, 100));
                        resolve(true);
                    }
                } else {
                    console.log('Error Body:', body);
                    resolve(false);
                }
            });
        }).on('error', (e) => {
            console.error(`Request Error: ${e.message}`);
            resolve(false);
        });
    });
}

async function run() {
    console.log('\n1. Checking /object_info (Server alive verify)');
    const alive = await checkEndpoint('/object_info');

    if (!alive) {
        console.error("❌ ComfyUI seems down or unreachable.");
    } else {
        console.log("✅ ComfyUI is responding to requests.");
    }
}

run();
