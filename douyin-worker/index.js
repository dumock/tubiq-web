
const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8000;

const fs = require('fs');

// Force usage of the standard image path
process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';

// Helper: Scrape Logic
async function scrapeDouyin(url) {
    console.log('[Worker] Scraping:', url);
    let browser = null;
    try {
        browser = await chromium.launch({
            headless: true
        });
        // Mobile context often gets better metadata for short video platforms
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            viewport: { width: 375, height: 812 }
        });
        const page = await context.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait a bit for dynamic rendering
        await page.waitForTimeout(2000);

        // Evaluate
        const data = await page.evaluate(() => {
            const getMeta = (prop) => {
                const el = document.querySelector(`meta[property = "${prop}"]`) || document.querySelector(`meta[name = "${prop}"]`);
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

        // Debug: List files to find browser
        const debugDirs = ['/ms-playwright', '/root/.cache/ms-playwright', '/app', '/usr/bin'];
        const fsDebug = {};

        debugDirs.forEach(dir => {
            try {
                if (fs.existsSync(dir)) {
                    fsDebug[dir] = fs.readdirSync(dir);
                    // If /ms-playwright exists, dig one level deeper to see chromium version
                    if (dir === '/ms-playwright') {
                        fsDebug[dir].forEach(sub => {
                            try {
                                const subPath = `${dir}/${sub}`;
                                if (fs.lstatSync(subPath).isDirectory()) {
                                    fsDebug[subPath] = fs.readdirSync(subPath);
                                }
                            } catch (err) { }
                        });
                    }
                } else {
                    fsDebug[dir] = 'NOT_FOUND';
                }
            } catch (err) {
                fsDebug[dir] = err.message;
            }
        });

        // Debug: Return Env vars
        const envDebug = Object.keys(process.env)
            .filter(k => k.includes('PATH') || k.includes('CHROME') || k.includes('PUPPETEER') || k.includes('PLAYWRIGHT'))
            .reduce((obj, k) => { obj[k] = process.env[k]; return obj; }, {});

        return { success: false, error: e.message, env: envDebug, fs: fsDebug };
    } finally {
        if (browser) await browser.close();
    }
}

app.get('/', (req, res) => {
    res.send({ status: 'ok', service: 'douyin-worker-playwright' });
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
    console.log(`Douyin Worker running on port ${PORT} `);
});
