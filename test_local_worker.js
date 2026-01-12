async function testLocalWorker() {
    const url = "https://www.tiktok.com/@yqueen_kr?is_from_webapp=1&sender_device=pc";
    const workerUrl = 'http://127.0.0.1:8000';

    console.log(`Testing against LOCAL worker ${workerUrl} with ${url}...`);
    try {
        const res = await fetch(`${workerUrl}/api/info?url=${encodeURIComponent(url)}`);
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Body:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

testLocalWorker();
