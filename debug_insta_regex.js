
const urls = [
    "https://www.instagram.com/jennierubyjane",
    "https://www.instagram.com/jennierubyjane/",
    "https://instagram.com/jennierubyjane",
    "https://www.instagram.com/jennierubyjane?igsh=MXZzbG...",
    "https://www.instagram.com/jennierubyjane/?igsh=MXZzbG...",
    "https://www.instagram.com/p/Cdb12345/?img_index=1",
    "https://www.instagram.com/reels/audio/12345",
    "https://www.instagram.com/stories/highlights/12345/",
    "https://www.instagram.com/sem.p.o_/"
];

const regex = /instagram\.com\/(?!p\/|reel\/|reels\/|stories\/|explore\/|tv\/)([a-zA-Z0-9_.]+)/;

console.log("--- Testing Regex ---");
urls.forEach(url => {
    const match = url.match(regex);
    const username = match ? match[1] : null;
    console.log(`URL: ${url}`);
    console.log(`  -> Username: ${username}`);
});

console.log("\n--- Testing URL Object Parsing ---");
urls.forEach(url => {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        // pathParts[0] is usually the username or 'p', 'reels', etc.
        const firstSegment = pathParts[0];

        const reserved = ['p', 'reel', 'reels', 'stories', 'explore', 'tv'];
        let username = null;

        if (firstSegment && !reserved.includes(firstSegment)) {
            username = firstSegment;
        }

        console.log(`URL: ${url}`);
        console.log(`  -> Username: ${username}`);
    } catch (e) {
        console.log(`URL: ${url} -> Invalid URL`);
    }
});
