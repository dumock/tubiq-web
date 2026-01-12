const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
console.log('Testing Gemini API Key:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

function makeRequest(modelName) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- Testing ${modelName} ---`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const data = JSON.stringify({
            contents: [{ parts: [{ text: "Hello, are you working?" }] }]
        });

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(body);
                        console.log(`✅ Success! Response: ${json.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 50)}...`);
                        resolve(true);
                    } catch (e) {
                        console.error('❌ Failed to parse JSON:', e);
                        resolve(false);
                    }
                } else {
                    console.error(`❌ Failed: ${res.statusCode} ${res.statusMessage}`);
                    console.error(`   Error Body: ${body}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Network Error: ${e.message}`);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

async function runTests() {
    if (!apiKey) {
        console.error('No GEMINI_API_KEY found in .env.local');
        return;
    }

    // Test multiple models
    await makeRequest('gemini-2.0-flash-exp');
    await makeRequest('gemini-1.5-pro');
    await makeRequest('gemini-1.5-flash');
}

runTests();
