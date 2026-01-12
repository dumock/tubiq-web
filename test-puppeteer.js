/**
 * Test script for puppeteer-extra
 * Run with: node test-puppeteer.js
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function test() {
    console.log('Starting puppeteer test...');

    try {
        const browser = await puppeteer.launch({
            headless: false,  // Open visible browser for testing
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1280,900'
            ],
            defaultViewport: {
                width: 1280,
                height: 900
            }
        });

        console.log('Browser launched successfully!');

        const page = await browser.newPage();
        console.log('Page created!');

        await page.goto('https://grok.com', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('Navigated to grok.com');
        console.log('Current URL:', page.url());

        // Wait 10 seconds so you can see the browser
        console.log('Waiting 10 seconds for you to see the browser...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        await browser.close();
        console.log('Browser closed. Test completed successfully!');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
