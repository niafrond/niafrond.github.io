/** @jest-environment jsdom */
// Relevé GPS guidé (DOM) : parcours avec fausse géolocalisation, gating selon la précision, annulation, reprise.
import { createGarden } from '../../model.js';
import { mountContourEditor } from '../../ui/draw.js';
import { localToGps } from '../../geometry.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ORIGIN = { lat: 47.2184, lon: -1.5536 };

function fakeGeo() {
  const g = { watchers: [], cleared: 0 };
  g.watchPosition = (ok, ko) => { g.watchers.push({ ok, ko }); return g.watchers.length; };
  g.clearWatch = () => { g.cleared++; };
  g.push = (p, accuracy = 2) => {
    const q = localToGps(p, ORIGIN);
    g.watchers.forEach((w) => w.ok({ coords: { latitude: q.lat, longitude: q.lon, accuracy }, timestamp: Date.now() }));
  };
  g.fail = (code) => g.watchers.forEach((w) => w.ko({ code }));
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: g });
  return g;
}

async function setup({ boundary = null, draft = null } = {}) {
  window.__JARDIN_GPS = { captureMs: 120 };
  const geo = fakeGeo();
  const el = document.createElement('div'); document.body.append(el);
  const g = createGarden('Relevé');
  if (boundary) { g.boundary = boundary; g.boundaryClosed = true; }
  if (draft) g.context.gpsSurveyDraft = draft;
  let saves = 0;
  const unmount = mountContourEditor(el, { garden: g, onChange: () => { saves++; } });
  await sleep(100);
  const q = (s) => el.querySelector(s);
  const click = (s) => q(s).click();
  const big = () => q('[data-act=survey-point]');
  const pose = async (p, acc = 2) => { geo.push(p, acc); await sleep(10); big().click(); await sleep(260); };
  return { el, g, geo, q, click, big, pose, unmount, saves: () => saves, root: q('[data-role=contour-editor]') };
}
afterEach(() => { document.body.innerHTML = ''; delete window.__JARDIN_GPS; });

const RECT = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];

describe('relevé GPS et nord', () => {
  test('un relevé validé place le nord en haut (northAngle = orientation = 0) et le signale', async () => {
    const t = await setup();
    t.g.context.northAngle = 90; t.g.context.orientation = 270;
    t.click('[data-act=start-gps]');
    const badge = t.q('[data-role=north-badge]');
    expect(badge.dataset.angle).toBe('0'); // pendant le relevé : plan nord en haut
    t.geo.push(RECT[0]); await sleep(10);
    await t.pose(RECT[0]);
    await sleep(80);
    for (const p of RECT.slice(1)) await t.pose(p);
    t.click('[data-act=survey-finish]');
    t.click('[data-act=rv-ok]');
    expect(t.g.context.northAngle).toBe(0);
    expect(t.g.context.orientation).toBe(0);
    expect(t.q('[data-role=north-badge]').dataset.angle).toBe('0');
    expect(t.q('[data-role=north-badge]').dataset.known).toBe('1');
    expect(t.el.textContent).toContain('Le relevé GPS place le nord en haut du plan');
    t.unmount();
  });
});
