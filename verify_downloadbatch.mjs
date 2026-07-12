import { chromium } from '@playwright/test';

const consoleMsgs = [];
const pageErrors = [];
const failedRequests = [];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('response', (res) => { if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`); });

await page.goto('http://localhost:8099/dj-mix/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForSelector('[data-tab="filrouge"]', { timeout: 15000 });
await page.waitForTimeout(1000);

await page.evaluate(() => document.querySelector('[data-tab="filrouge"]').click());
await page.waitForTimeout(500);

const btnInfo = await page.evaluate(() => {
  const dl = document.getElementById('filrouge-download-all-btn');
  const mix = document.getElementById('filrouge-mixinfo-btn');
  const rectDl = dl?.getBoundingClientRect();
  return {
    dlText: dl?.textContent,
    mixText: mix?.textContent,
    rectDl: rectDl && { w: rectDl.width, h: rectDl.height },
  };
});
console.log('BTN_INFO', JSON.stringify(btnInfo));

// Click "Tout télécharger" with an empty Fil Rouge -> should hit the "already downloaded" toast path harmlessly.
await page.click('#filrouge-download-all-btn', { timeout: 10000 });
await page.waitForTimeout(800);

const toastText = await page.evaluate(() => {
  const el = document.querySelector('.toast, #toast, [class*="toast"]');
  return el ? el.textContent : null;
});
console.log('TOAST_TEXT', JSON.stringify(toastText));

await page.screenshot({ path: '/tmp/downloadbatch-smoke.png', fullPage: false });

console.log('CONSOLE_LOG_COUNT', consoleMsgs.length);
console.log('CONSOLE_ERRORS', JSON.stringify(consoleMsgs.filter(m => m.startsWith('[error]'))));
console.log('PAGE_ERRORS', JSON.stringify(pageErrors));
console.log('FAILED_REQUESTS', JSON.stringify(failedRequests));

await browser.close();
