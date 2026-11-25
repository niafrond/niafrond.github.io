/** @jest-environment jsdom */
// Éditeur de zones : nom + ambiance dès la création (pastilles de suggestion, champ Ambiance, détection dans le nom).
import { createGarden, createZone } from '../../model.js';
import { mountZoneEditor } from '../../ui/draw.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

async function setup({ zones = [] } = {}) {
  const el = document.createElement('div'); document.body.append(el);
  const g = createGarden('Zones');
  g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true; g.wishedZoneTypes = [];
  zones.forEach((z) => g.zones.push(z));
  const unmount = mountZoneEditor(el, { garden: g, onChange: () => {} });
  await sleep(100);
  const svg = el.querySelector('.jd-svg');
  const fire = (type, x, y) => {
    const vb = svg.getAttribute('viewBox').split(' ').map(Number); const mpp = vb[2] / 390;
    const ev = new MouseEvent(type, { clientX: (x - vb[0]) / mpp, clientY: (y - vb[1]) / mpp, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'touch' });
    svg.dispatchEvent(ev);
  };
  const tap = (x, y) => { fire('pointerdown', x, y); fire('pointerup', x, y); };
  const q = (s) => el.querySelector(s);
  return { el, g, tap, q, click: (s) => q(s).click(), unmount };
}
const type = (n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); };

describe('création d’une zone : nom et ambiance', () => {
  test('le bandeau s’ouvre sur « Donnez-lui un nom », exemple et pastilles, sans focus forcé', async () => {
    const t = await setup();
    t.click('[data-type=terrace]'); t.tap(2, 2); t.tap(6, 5);
    expect(t.g.zones).toHaveLength(1);
    const panel = t.q('[data-role=zone-panel]');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Donnez-lui un nom');
    const name = t.q('[data-role=zone-name]');
    expect(name.placeholder).toBe('ex. Massif bucolique devant la terrasse');
    expect(document.activeElement).not.toBe(name); // pas de clavier intempestif
    const sug = t.q('[data-role=name-suggestions]');
    expect(sug.querySelectorAll('[data-ambiance]').length).toBeGreaterThanOrEqual(12);
    expect(sug.textContent).toContain('bucolique'.slice(0, 1).toUpperCase() + 'ucolique');
    t.unmount();
  });

  test('toucher une pastille : « Terrasse — bucolique » + zone.ambiance, puis remplacement', async () => {
    const t = await setup();
    t.click('[data-type=terrace]'); t.tap(2, 2); t.tap(6, 5);
    t.q('[data-role=name-suggestions] [data-ambiance=bucolique]').click();
    const z = t.g.zones[0];
    expect(z.label).toBe('Terrasse — bucolique');
    expect(z.ambiance).toBe('bucolique');
    expect(t.q('[data-role=zone-name]').value).toBe('Terrasse — bucolique');
    expect(t.q('[data-role=zone-ambiance] [data-ambiance=bucolique]').getAttribute('aria-checked')).toBe('true');
    t.q('[data-role=name-suggestions] [data-ambiance=zen]').click();
    expect(z.label).toBe('Terrasse — zen');
    expect(z.ambiance).toBe('zen');
    t.unmount();
  });

  test('le champ Ambiance est distinct, modifiable, « Aucune » ; il est présent pour toute zone sélectionnée', async () => {
    const z = createZone('lawn', { kind: 'polygon', points: RECT(2, 2, 6, 5) });
    const t = await setup({ zones: [z] });
    t.tap(4, 3.5);
    expect(t.q('[data-role=naming]')).toBeNull(); // zone existante : pas de bloc de nommage
    const field = t.q('[data-role=zone-ambiance]');
    expect(field.getAttribute('role')).toBe('radiogroup');
    field.querySelector('[data-ambiance=romantique]').click();
    expect(t.g.zones[0].ambiance).toBe('romantique');
    expect(t.g.zones[0].label).toBe('Pelouse'); // le nom n’est pas touché
    t.q('[data-role=zone-ambiance] [data-ambiance=""]').click();
    expect(t.g.zones[0].ambiance).toBeNull();
    t.unmount();
  });

  test('mot d’ambiance tapé dans le nom : détecté et proposé, appliqué seulement sur demande', async () => {
    const z = createZone('midplants', { kind: 'polygon', points: RECT(2, 2, 6, 5) });
    const t = await setup({ zones: [z] });
    t.tap(4, 3.5);
    const det = t.q('[data-role=ambiance-detected]');
    expect(det.hidden).toBe(true);
    type(t.q('[data-role=zone-name]'), 'Massif méditerranéen');
    expect(det.hidden).toBe(false);
    expect(det.textContent).toContain('Ambiance détectée');
    expect(det.textContent.toLowerCase()).toContain('méditerranéen');
    expect(t.g.zones[0].ambiance == null).toBe(true); // pas imposée
    t.click('[data-act=apply-ambiance]');
    expect(t.g.zones[0].ambiance).toBe('mediterraneen');
    expect(t.g.zones[0].label).toBe('Massif méditerranéen');
    expect(t.q('[data-role=ambiance-detected]').hidden).toBe(true);
    t.unmount();
  });

  test('l’ambiance apparaît sur le plan à côté du nom', async () => {
    const z = createZone('lawn', { kind: 'polygon', points: RECT(2, 2, 6, 5) });
    z.ambiance = 'zen';
    const t = await setup({ zones: [z] });
    expect(t.el.querySelector('.jd-svg').textContent).toContain('🎋');
    t.unmount();
  });
});
