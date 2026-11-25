import { test } from '@playwright/test';
const S = '/tmp/claude-0/-home-user-niafrond-github-io/0dd2fbde-dd7e-58cc-b4c6-ae8bbf827b1e/scratchpad';
test.use({ viewport: { width: 390, height: 844 } });
const px = (p, x, y) => [p.ox + (x - p.vx) * p.k, p.oy + (y - p.vy) * p.k];
const projeter = (page) => page.evaluate(() => { const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect(); const k = Math.min(r.width / vb.width, r.height / vb.height); return { ox: r.left + (r.width - vb.width * k) / 2, oy: r.top + (r.height - vb.height * k) / 2, k, vx: vb.x, vy: vb.y }; });
test('captures', async ({ page }) => {
  await page.goto('/jardin/'); await page.waitForFunction(() => window.__jardin);
  const id = await page.evaluate(async () => {
    const { createGarden } = await import('./model.js');
    const g = createGarden('Captures'); g.boundary = [{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}]; g.boundaryClosed = true; g.wishedZoneTypes = ['terrace','pool'];
    await window.__jardin.storage.saveGarden(g); return g.id; });
  await page.goto('/jardin/#/garden/' + id + '/zones'); await page.waitForSelector('[data-role=zone-editor]'); await page.waitForTimeout(400);
  await page.locator('[data-type=terrace]').click();
  let p = await projeter(page); let [x,y] = px(p,1,1); await page.mouse.click(x,y); [x,y] = px(p,5,4); await page.mouse.click(x,y);
  await page.locator('[data-role=zone-rot]').fill('25'); await page.locator('[data-role=zone-rot]').press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({ path: S + '/rot-selection.png' });
  await page.locator('[data-role=zone-rotation]').scrollIntoViewIfNeeded();
  await page.locator('[data-role=zone-panel]').screenshot({ path: S + '/rot-bandeau.png' });
  await page.locator('[data-act=deselect]').click();
  await page.locator('[data-type=pool]').click(); p = await projeter(page);
  await page.locator('[data-act=kind-circle]').click();
  [x,y] = px(p,8,5); await page.mouse.click(x,y); [x,y] = px(p,9.7,5); await page.mouse.click(x,y);
  await page.locator('[data-variant=above]').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: S + '/pool-pastilles.png' });
  await page.evaluate(async () => { await window.__jardin.flush?.(); });
  const svgs = await page.evaluate(async (i) => {
    const g = await window.__jardin.storage.getGarden(i);
    const { renderPlanSVG } = await import('./render.js'); const { renderViewSVG } = await import('./render3d.js');
    return { plan: renderPlanSVG(g, { view: 'illustrated', width: 390, height: 520 }), iso: renderViewSVG(g, { view: 'iso-se', width: 390, height: 520 }) };
  }, id);
  for (const k of ['plan', 'iso']) { await page.setContent('<body style="margin:0;background:#fff">' + svgs[k] + '</body>'); await page.waitForTimeout(100); await page.screenshot({ path: S + '/pool-' + k + '.png' }); }
});
