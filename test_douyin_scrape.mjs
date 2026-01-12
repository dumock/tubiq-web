import fetch from 'node-fetch';

async function scrapeDouyin(url) {
    console.log(`Scraping ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                // Mimic a mobile browser (iPhone) which often gets a simpler page
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.douyin.com/'
            },
            redirect: 'follow'
        });

        console.log(`Status: ${res.status}`);
        console.log(`Final URL: ${res.url}`);

        const html = await res.text();

        // Debug: Print the first 500 chars to see what we got
        console.log('--- HTML Preview ---');
        console.log(html.substring(0, 500));

        const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i);
        const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);
        // Sometimes title is just <title>
        const titleTag = html.match(/<title>([^<]+)<\/title>/i);

        const authors = html.match(/<meta\s+(?:property|name)=["'](?:og:site_name|author)["']\s+content=["']([^"']+)["']/i);

        console.log('--- Results ---');
        console.log('Thumbnail:', ogImage ? ogImage[1] : 'Not Found');
        console.log('Title (OG):', ogTitle ? ogTitle[1] : 'Not Found');
        console.log('Title (Tag):', titleTag ? titleTag[1] : 'Not Found');
        console.log('Author:', authors ? authors[1] : 'Not Found');

    } catch (e) {
        console.error('Error:', e);
    }
}

scrapeDouyin('https://v.douyin.com/MA0_1C1VB7g/');
