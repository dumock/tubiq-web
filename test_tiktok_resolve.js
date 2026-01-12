async function testVideo() {
    const url = "https://www.tiktok.com/@yqueen_kr?is_from_webapp=1&sender_device=pc";
    const workerUrl = 'https://port-0-douyin-worker-mjk7tb329db087f3.sel3.cloudtype.app';

    console.log(`Testing ${url}...`);
    try {
        // Node 18+ has native fetch
        const res = await fetch(`${workerUrl}/api/info?url=${encodeURIComponent(url)}`);
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Body:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

testVideo();
