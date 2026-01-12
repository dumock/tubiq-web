
async function testRemoteWorker() {
    const url = "https://v.douyin.com/-h2_9kWnvzc/";
    const workerUrl = 'https://port-0-douyin-worker-mjk7tb329db087f3.sel3.cloudtype.app';
    const apiUrl = `${workerUrl}/api/info?url=${encodeURIComponent(url)}`;

    console.log("Fetching Remote:", apiUrl);

    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Success:", data.success);
        console.log("Title:", data.title);
        console.log("Is Profile:", data.is_profile);
    } catch (e) {
        console.error("Error:", e);
    }
}

testRemoteWorker();
