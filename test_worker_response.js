
// Native fetch in Node 18+

// If node-fetch is not available (since I removed it before), use native fetch if node version supports it, 
// or simple http. But since previous steps suggested environment issues, I'll rely on native fetch.
// Actually, I'll just use the same pattern as debug_save_flow.js but for the worker.

async function testWorker() {
    // URL for "卡露儿" video (from previous logs: https://v.douyin.com/-h2_9kWnvzc/)
    // The worker takes a video URL and falling back to profile
    const url = 'https://v.douyin.com/-h2_9kWnvzc/';
    const workerUrl = `http://127.0.0.1:8001/api/info?url=${encodeURIComponent(url)}`;

    console.log(`Testing Worker URL: ${workerUrl}`);

    try {
        const res = await fetch(workerUrl);
        const data = await res.json();

        console.log('Worker Response Status:', res.status);
        console.log('Worker Response Data:', JSON.stringify(data, null, 2));

        if (data.follower_count !== undefined) {
            console.log(`✅ follower_count found: ${data.follower_count}`);
        } else {
            console.log('❌ follower_count MISSING');
        }
    } catch (e) {
        console.error('Error fetching from worker:', e);
    }
}

testWorker();
