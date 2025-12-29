const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testRelay() {
    const url = "https://port-0-tubiq-web-relay-mjk7tb329db087f3.sel3.cloudtype.app/share";
    const body = {
        url: "https://youtube.com/shorts/lnYAaBkXbbU",
        source: "node_test_script"
    };

    console.log("Sending request to:", url);
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': 'DEMO_API_KEY_123',
            'X-Account-Id': 'test_node_automator'
        },
        body: JSON.stringify(body)
    });

    console.log("Status:", resp.status);
    const json = await resp.json();
    console.log("Response Body:", JSON.stringify(json, null, 2));
}

testRelay();
