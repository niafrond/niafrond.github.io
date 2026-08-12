import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

await page.addInitScript(() => {
  let fake = 0;
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get() { return fake; },
    set(v) { fake = v; },
  });
  window.__setFakeTime = (v) => { fake = v; };
});

await page.goto('http://127.0.0.1:9100/theme-party/', { waitUntil: 'networkidle' });
await page.click('#btn-launch-game');
await page.waitForSelector('#screen-picker:not(.hidden)');
await page.click('.theme-card');
await page.waitForSelector('#screen-round:not(.hidden)');
await page.waitForTimeout(300);

// PLAY_MAX=45s, EXTEND_LEAD=10s -> prompt should appear once elapsed >= 35s, well before the 45s stop.
await page.evaluate(() => window.__setFakeTime(34));
await page.waitForTimeout(200);
console.log('AT_34S (should be false):', await page.isVisible('#btn-extend-play'));
console.log('PLAY_ICON_AT_34S (should still be playable/paused icon, not force-paused):', await page.textContent('#btn-play-pause'));

await page.evaluate(() => window.__setFakeTime(36));
await page.waitForTimeout(200);
console.log('AT_36S (should be true, before the 45s cap):', await page.isVisible('#btn-extend-play'));
await page.screenshot({ path: '/tmp/shots/extend-prompt-early.png' });

await page.evaluate(() => window.__setFakeTime(46));
await page.waitForTimeout(200);
console.log('AT_46S (past cap, should still be true):', await page.isVisible('#btn-extend-play'));

await browser.close();
console.log('DONE');
