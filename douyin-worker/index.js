const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8000;

// Helper: Scrape Logic
async function scrapeDouyin(url) {
    console.log('[Worker] Scraping:', url);
    console.log('[Worker] Env ExecPath:', process.env.PUPPETEER_EXECUTABLE_PATH);
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            // In official image, PUPPETEER_EXECUTABLE_PATH is set automatically.
            // If we omit it, Puppeteer uses the bundled or env-defined path.
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();

        // Mobile User Agent for better metadata sometimes, but Desktop is better for OG tags on Douyin PC
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait a bit for dynamic rendering
        await new Promise(r => setTimeout(r, 2000));

        // Evaluate
        const data = await page.evaluate(() => {
            const getMeta = (prop) => {
                const el = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`);
                return el ? el.content : '';
            };
            const getText = (sel) => {
                const el = document.querySelector(sel);
                return el ? el.innerText : '';
            };

            let title = getMeta('og:title');
            if (!title || title.includes('Douyin')) {
                title = getText('[data-e2e="video-desc"]') || getText('.desc--1y6Tq') || document.title;
            }
            if (title) title = title.replace(' - Douyin', '').trim();

            let thumb = getMeta('og:image');
            if (!thumb) {
                const video = document.querySelector('video');
                if (video && video.poster) thumb = video.poster;
            }

            let author = getMeta('og:site_name') || getMeta('author');
            if (!author || author === 'Douyin') {
                author = getText('[data-e2e="video-author-name"]') || getText('.account-name');
            }

            return {
                title: title || 'No Title',
                thumbnail_url: thumb || '',
                author: author || 'Unknown',
                url: window.location.href
            };
        });

        return { success: true, ...data };

    } catch (e) {
        console.error('[Worker] Error:', e);
        return { success: false, error: e.message };
    } finally {
        if (browser) await browser.close();
    }
}

app.get('/', (req, res) => {
    res.send({ status: 'ok', service: 'douyin-worker' });
});

app.get('/api/info', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const result = await scrapeDouyin(url);
    res.json(result);
});

// Compatible with existing server pattern if needed
app.post('/api/video', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    const result = await scrapeDouyin(url);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Douyin Worker running on port ${PORT}`);
});
