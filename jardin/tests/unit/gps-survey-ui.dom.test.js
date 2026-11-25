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

describe('relevé GPS guidé', () => {
  test('le bouton du panneau de démarrage ouvre le mode plein écran avec les consignes', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    expect(t.root.classList.contains('jd-survey-on')).toBe(true);
    expect(t.q('[data-role=survey-guide]').hidden).toBe(false);
    expect(t.q('[data-role=survey-guide]').textContent).toMatch(/Placez-vous sur le 1er angle du terrain/);
    expect(t.q('[data-role=survey-guide]').textContent).toMatch(/précision passe au vert/);
    expect(t.q('[data-role=survey-guide]').textContent).toMatch(/Mettre un point ici/);
    expect(t.big().disabled).toBe(true); // pas encore de signal
    expect(t.q('[data-role=gps-pill]').textContent).toMatch(/Recherche/);
    t.unmount();
  });

  test('gating : précision faible → bouton désactivé (rouge) ; bonne → actif (vert) ; « Poser quand même » après confirmation', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    t.geo.push({ x: 0, y: 0 }, 12);
    await sleep(10);
    expect(t.q('[data-role=gps-pill]').className).toMatch(/q-weak/);
    expect(t.q('[data-role=gps-pill]').textContent).toMatch(/±12,0 m/);
    expect(t.big().disabled).toBe(true);
    expect(t.q('[data-act=survey-force]').hidden).toBe(false);
    t.geo.push({ x: 0, y: 0 }, 5);
    expect(t.q('[data-role=gps-pill]').className).toMatch(/q-medium/);
    expect(t.big().disabled).toBe(false);
    t.geo.push({ x: 0, y: 0 }, 2);
    expect(t.q('[data-role=gps-pill]').className).toMatch(/q-good/);
    expect(t.q('[data-act=survey-force]').hidden).toBe(true);

    // retour à un signal faible : poser quand même demande confirmation
    t.geo.push({ x: 0, y: 0 }, 15);
    t.click('[data-act=survey-force]');
    expect(t.q('[data-role=survey-dialog]').hidden).toBe(false);
    expect(t.q('[data-role=dialog-text]').textContent).toMatch(/signal est faible/);
    t.click('[data-act=ask-wait]');
    expect(t.g.context.gpsSurveyDraft).toBeUndefined();
    t.click('[data-act=survey-force]');
    t.click('[data-act=ask-force]');
    expect(t.big().disabled).toBe(true); // mesure en cours
    await sleep(300);
    expect(t.g.context.gpsSurveyDraft.points).toHaveLength(1);
    t.unmount();
  });

  test('parcours complet : 4 points, instruction contextuelle, distance en direct, contour fermé', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    await t.pose(RECT[0]);
    expect(t.q('[data-role=survey-count]').textContent).toBe('1 point');
    expect(t.q('[data-role=survey-guide]').hidden).toBe(true);
    expect(t.q('[data-role=survey-instr]').textContent).toMatch(/angle 2/);
    t.geo.push({ x: 4, y: 0 });
    expect(t.q('[data-role=gps-dist]').textContent).toMatch(/4,0 m depuis le point 1/);
    await sleep(80); // le « marcheur » s'arrête avant de toucher le bouton
    for (const p of RECT.slice(1)) await t.pose(p);
    expect(t.q('[data-role=survey-count]').textContent).toBe('4 points');
    // la forme se construit sur le plan : 4 numéros, côtés en mètres
    expect(t.el.querySelectorAll('.jd-svg text').length).toBeGreaterThanOrEqual(7);
    expect(t.el.querySelector('.jd-svg').innerHTML).toMatch(/10,0 m/);
    t.click('[data-act=survey-finish]');
    expect(t.q('[data-role=survey-review]').hidden).toBe(false);
    expect(t.q('[data-role=sv-area]').textContent).toMatch(/80,0/);
    t.click('[data-act=rv-ok]');
    expect(t.root.classList.contains('jd-survey-on')).toBe(false);
    expect(t.g.boundaryClosed).toBe(true);
    expect(t.g.boundary).toHaveLength(4);
    expect(t.g.boundary[1].x).toBeCloseTo(10, 0);
    expect(t.g.boundary[2].y).toBeCloseTo(8, 0);
    expect(t.g.context.gpsOrigin.lat).toBeCloseTo(ORIGIN.lat, 4);
    expect(t.g.context.gpsSurveyDraft).toBeUndefined();
    expect(t.geo.cleared).toBeGreaterThan(0); // suivi arrêté
    expect(t.q('[data-role=area]').textContent).toBe('80,00');
    t.unmount();
  });

  test('annuler le dernier point', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    await t.pose(RECT[0]); await t.pose(RECT[1]); await t.pose(RECT[2]);
    expect(t.g.context.gpsSurveyDraft.points).toHaveLength(3);
    t.click('[data-act=survey-undo]');
    expect(t.q('[data-role=survey-count]').textContent).toBe('2 points');
    expect(t.g.context.gpsSurveyDraft.points).toHaveLength(2);
    expect(t.q('[data-act=survey-finish]').disabled).toBe(true); // moins de 3 points
    t.unmount();
  });

  test('point trop proche : confirmation demandée', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    await t.pose(RECT[0]);
    await t.pose({ x: 0.3, y: 0.2 });
    expect(t.q('[data-role=survey-dialog]').hidden).toBe(false);
    expect(t.q('[data-role=dialog-text]').textContent).toMatch(/presque pas bougé/);
    expect(t.g.context.gpsSurveyDraft.points).toHaveLength(1);
    t.click('[data-act=ask-cancel]');
    t.unmount();
  });

  test('retour au départ : « fermer le tour » mesure l\'écart de fermeture, répartition proposée', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    for (const p of RECT) await t.pose(p);
    t.geo.push({ x: 1.2, y: 0.4 });
    await sleep(10);
    expect(t.q('[data-role=survey-instr]').textContent).toMatch(/à 1,3 m du 1er point/);
    t.big().click();
    expect(t.q('[data-role=dialog-text]').textContent).toMatch(/à 1,3 m du 1er point : fermer le tour/);
    t.click('[data-act=ask-close]');
    await sleep(300);
    expect(t.q('[data-role=survey-review]').hidden).toBe(false);
    expect(t.q('[data-role=sv-gap]').textContent).toMatch(/1,2|1,3/);
    expect(t.q('[data-act=rv-gap]').getAttribute('aria-pressed')).toBe('true');
    t.click('[data-act=rv-ok]');
    expect(t.g.boundary).toHaveLength(4); // le point de fermeture n'est pas un sommet
    expect(t.g.boundary[0]).toEqual({ x: 0, y: 0 });
    t.unmount();
  });

  test('redressement des angles droits : aperçu et option réversible', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    const bruit = [{ x: 0, y: 0 }, { x: 10.3, y: 0.7 }, { x: 9.6, y: 8.5 }, { x: -0.4, y: 7.8 }];
    for (const p of bruit) await t.pose(p);
    t.click('[data-act=survey-finish]');
    const area0 = t.q('[data-role=sv-area]').textContent;
    expect(t.q('[data-act=rv-square]').textContent).toMatch(/Redresser les angles droits \(4\)/);
    t.click('[data-act=rv-square]');
    expect(t.q('[data-act=rv-square]').getAttribute('aria-pressed')).toBe('true');
    expect(t.el.querySelector('.jd-svg').innerHTML).toMatch(/stroke-dasharray="6 5"/); // relevé brut en pointillé
    t.click('[data-act=rv-square]'); // réversible avant validation
    expect(t.q('[data-role=sv-area]').textContent).toBe(area0);
    t.click('[data-act=rv-square]');
    t.click('[data-act=rv-ok]');
    const b = t.g.boundary;
    const dot = (a, c, d) => (c.x - a.x) * (d.x - c.x) + (c.y - a.y) * (d.y - c.y);
    expect(Math.abs(dot(b[0], b[1], b[2]))).toBeLessThan(0.1);
    t.unmount();
  });

  test('contour existant : confirmation « Remplacer », annulable avec ↶', async () => {
    const t = await setup({ boundary: RECT });
    t.click('[data-act=gps-point]');
    expect(t.q('[data-role=dialog-text]').textContent).toMatch(/Remplacer le contour actuel par le relevé GPS/);
    t.click('[data-act=ask-cancel]');
    expect(t.root.classList.contains('jd-survey-on')).toBe(false);
    t.click('[data-act=gps-point]');
    t.click('[data-act=ask-replace]');
    expect(t.root.classList.contains('jd-survey-on')).toBe(true);
    const tri = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 6, y: 10 }];
    for (const p of tri) await t.pose(p);
    t.click('[data-act=survey-finish]');
    t.click('[data-act=rv-ok]');
    expect(t.g.boundary).toHaveLength(3);
    t.click('[data-act=undo]');
    expect(t.g.boundary).toHaveLength(4);
    expect(t.g.boundary[1].x).toBe(10);
    t.unmount();
  });

  test('brouillon : quitter le garde, la reprise recharge les points', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    await t.pose(RECT[0]); await t.pose(RECT[1]);
    t.click('[data-act=survey-quit]');
    t.click('[data-act=ask-keep]');
    expect(t.root.classList.contains('jd-survey-on')).toBe(false);
    const draft = JSON.parse(JSON.stringify(t.g.context.gpsSurveyDraft));
    expect(draft.points).toHaveLength(2);
    t.unmount();
    document.body.innerHTML = '';

    const t2 = await setup({ draft });
    expect(t2.q('[data-act=start-gps]').textContent).toMatch(/Reprendre le relevé GPS \(2 points\)/);
    t2.click('[data-act=start-gps]');
    expect(t2.q('[data-role=dialog-text]').textContent).toMatch(/relevé GPS interrompu existe \(2 points\)/);
    t2.click('[data-act=ask-resume]');
    expect(t2.q('[data-role=survey-count]').textContent).toBe('2 points');
    await t2.pose(RECT[2]);
    expect(t2.g.context.gpsSurveyDraft.points).toHaveLength(3);
    t2.unmount();
  });

  test('abandon du relevé : le brouillon est supprimé', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    await t.pose(RECT[0]);
    t.click('[data-act=survey-quit]');
    t.click('[data-act=ask-abandon]');
    expect(t.g.context.gpsSurveyDraft).toBeUndefined();
    expect(t.g.boundary).toHaveLength(0);
    t.unmount();
  });

  test('GPS refusé : message clair et repli « saisir les côtés à la main »', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    t.geo.fail(1);
    await sleep(10);
    const err = t.q('[data-role=survey-error]');
    expect(err.hidden).toBe(false);
    expect(err.textContent).toMatch(/Localisation refusée/);
    expect(t.q('[data-role=gps-pill]').textContent).toMatch(/GPS indisponible/);
    expect(t.big().disabled).toBe(true);
    t.click('[data-act=survey-manual]');
    expect(t.root.classList.contains('jd-survey-on')).toBe(false);
    expect(t.q('[data-role=add-length]')).not.toBeNull(); // feuille des côtés ouverte
    t.unmount();
  });

  test('la position en direct « Où suis-je » reste disponible après le relevé', async () => {
    const t = await setup();
    t.click('[data-act=start-gps]');
    for (const p of RECT) await t.pose(p);
    t.click('[data-act=survey-finish]');
    t.click('[data-act=rv-ok]');
    expect(t.q('[data-act=gps-live]')).not.toBeNull();
    expect(t.q('[data-act=gps-live]').hidden).toBe(false);
    expect(t.g.context.gpsOrigin).toBeTruthy();
    t.unmount();
  });
});
