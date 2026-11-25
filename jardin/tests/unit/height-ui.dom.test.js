/** @jest-environment jsdom */
// Hauteurs réglables (DOM) : « Dans cette zone », bandeau piscine / terrasse, fenêtre et bandeau d’un aménagement, obstacles, existants.
import { mountPlants } from '../../ui/step-plants.js';
import { mountZoneEditor } from '../../ui/draw.js';
import { mountItemEditor } from '../../ui/draw-items.js';
import { mountContourEditor } from '../../ui/draw-contour.js';
import { createGarden, createZone } from '../../model.js';
import { allPlants } from '../../catalog.js';

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const change = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('change', { bubbles: true })); };

afterEach(() => { document.body.innerHTML = ''; });

describe('« Dans cette zone »', () => {
  const tree = allPlants().find((p) => p.category === 'tree' && p.heightAdult >= 6 && p.heightAdult <= 12);
  function monter() {
    document.body.innerHTML = '<div id="toast" hidden></div>';
    const el = document.createElement('div'); document.body.append(el);
    const g = createGarden('P'); g.context.departement = '75';
    g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true; g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const z = createZone('trees', { kind: 'polygon', points: RECT(0, 0, 6, 4) }); z.label = 'Arbres';
    z.plantings = [{ plantId: tree.id, count: 1 }];
    g.zones = [z];
    let n = 0;
    mountPlants(el, { garden: g, onChange: () => { n++; }, getPhoto: async () => null, IO: null });
    return { el, g, z, count: () => n };
  }
  test('champ en cm, placeholder = hauteur du catalogue, état « catalogue »', () => {
    const { el } = monter();
    const inp = el.querySelector('.chosen-row [data-field=plant-height]');
    expect(inp).not.toBeNull();
    expect(inp.getAttribute('inputmode')).toBe('numeric');
    expect(inp.placeholder).toBe(String(Math.round(tree.heightAdult * 100)));
    expect(inp.getAttribute('aria-label')).toMatch(/^Hauteur de .* en centimètres$/);
    expect(el.querySelector('[data-role=height-state]').dataset.state).toBe('catalog');
    expect(el.querySelector('[data-act=height-reset]').disabled).toBe(true);
  });
  test('saisie : hauteur enregistrée, état « personnalisée », valeur par défaut restaure', () => {
    const { el, z, count } = monter();
    change(el.querySelector('[data-field=plant-height]'), '1500');
    expect(z.plantings[0].height).toBe(15);
    expect(el.querySelector('[data-role=height-state]').dataset.state).toBe('custom');
    expect(el.querySelector('[data-role=height-state]').textContent).toContain('personnalisée');
    expect(count()).toBeGreaterThan(0);
    el.querySelector('[data-act=height-reset]').click();
    expect('height' in z.plantings[0]).toBe(false);
    expect(el.querySelector('[data-field=plant-height]').value).toBe('');
    expect(el.querySelector('[data-role=height-state]').dataset.state).toBe('catalog');
  });
  test('bornes : valeur arrondie signalée ; saisie illisible refusée ; saisie = catalogue efface le réglage', () => {
    const { el, z } = monter();
    change(el.querySelector('[data-field=plant-height]'), '9000');
    expect(z.plantings[0].height).toBe(40);
    expect(el.querySelector('.height-note').textContent).toBe('Hauteur plausible : 0,5 à 40 m ; valeur arrondie');
    change(el.querySelector('[data-field=plant-height]'), 'abc');
    expect(z.plantings[0].height).toBe(40);
    expect(el.querySelector('[data-field=plant-height]').classList.contains('bad')).toBe(true);
    change(el.querySelector('[data-field=plant-height]'), String(Math.round(tree.heightAdult * 100)));
    expect('height' in z.plantings[0]).toBe(false);
  });
  test('Entrée valide et la fiche détail affiche « Hauteur : 4,50 m (personnalisée) »', () => {
    const { el, z } = monter();
    const inp = el.querySelector('[data-field=plant-height]');
    inp.value = '450'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(z.plantings[0].height).toBe(4.5);
    el.querySelector('.chosen-row .plant-thumb').click();
    expect(document.querySelector('[data-role=plant-detail]').textContent).toContain('Hauteur : 4,50 m (personnalisée)');
  });
});

describe('bandeau de zone : piscine hors sol et terrasse', () => {
  async function setup(zones) {
    const el = document.createElement('div'); document.body.append(el);
    const g = createGarden('Z'); g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true; zones.forEach((z) => g.zones.push(z));
    const unmount = mountZoneEditor(el, { garden: g, onChange: () => {} });
    await wait(100);
    const svg = el.querySelector('.jd-svg');
    const tap = (x, y) => {
      const vb = svg.getAttribute('viewBox').split(' ').map(Number); const mpp = vb[2] / 390;
      for (const type of ['pointerdown', 'pointerup']) {
        const ev = new MouseEvent(type, { clientX: (x - vb[0]) / mpp, clientY: (y - vb[1]) / mpp, bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'touch' }); svg.dispatchEvent(ev);
      }
    };
    return { el, g, tap, q: (s) => el.querySelector(s), unmount };
  }
  test('piscine enterrée : aucun champ ; hors sol : champ « Hauteur de la paroi (cm) » + défaut', async () => {
    const z = createZone('pool', { kind: 'polygon', points: RECT(2, 2, 6, 5) });
    const t = await setup([z]);
    t.tap(4, 3.5);
    expect(t.q('[data-field=zone-height]')).toBeNull();
    t.q('[data-variant=above]').click();
    const f = t.q('[data-field=zone-height]');
    expect(f).not.toBeNull(); expect(f.value).toBe('120');
    expect(t.q('[data-role=height-field]').textContent).toContain('Hauteur de la paroi (cm)');
    expect(t.q('[data-act=height-reset]').disabled).toBe(true);
    change(f, '160');
    expect(t.g.zones[0].height).toBe(1.6);
    expect(t.q('[data-role=height-state]').dataset.state).toBe('custom');
    t.q('[data-act=height-plus]').click();
    expect(t.g.zones[0].height).toBe(1.7);
    change(t.q('[data-field=zone-height]'), '900');
    expect(t.g.zones[0].height).toBe(2);
    t.q('[data-act=height-reset]').click();
    expect('height' in t.g.zones[0]).toBe(false);
    expect(t.q('[data-field=zone-height]').value).toBe('120');
    t.unmount();
  });
  test('terrasse : « Surélévation (cm) », 0 = au sol, bornée à 1,5 m', async () => {
    const z = createZone('terrace', { kind: 'polygon', points: RECT(2, 2, 6, 5) });
    const t = await setup([z]);
    t.tap(4, 3.5);
    expect(t.q('[data-role=height-field]').textContent).toContain('Surélévation (cm)');
    expect(t.q('[data-field=zone-height]').value).toBe('0');
    change(t.q('[data-field=zone-height]'), '40');
    expect(t.g.zones[0].height).toBe(0.4);
    change(t.q('[data-field=zone-height]'), '500');
    expect(t.g.zones[0].height).toBe(1.5);
    t.q('[data-act=height-reset]').click();
    expect('height' in t.g.zones[0]).toBe(false);
    t.unmount();
  });
});

describe('aménagements', () => {
  function monter() {
    const el = document.createElement('div'); document.body.append(el);
    const g = createGarden('I'); g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true;
    const unmount = mountItemEditor(el, { garden: g, onChange: () => {} });
    const svg = el.querySelector('.jd-svg');
    const ptr = (type, x, y) => { const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number); svg.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: ((x - vx) / vw) * 390, clientY: ((y - vy) / vh) * 520 })); };
    return { el, g, unmount, tap: (x, y) => { ptr('pointerdown', x, y); ptr('pointerup', x, y); }, long: async (x, y) => { ptr('pointerdown', x, y); await wait(560); ptr('pointerup', x, y); }, click: (s) => el.querySelector(s).click() };
  }
  test('fenêtre d’un élément : Hauteur en cm (pergola 240 par défaut), enregistrée, bornée, défaut', async () => {
    const m = monter();
    m.click('[data-kind=pergola]'); m.tap(6, 4);
    await m.long(6, 4);
    const f = m.el.querySelector('[data-role=pop] [data-field=ht]');
    expect(f.value).toBe('240');
    expect(f.getAttribute('inputmode')).toBe('numeric');
    f.value = '320'; m.click('[data-act=pop-ok]');
    expect(m.g.items[0].height).toBe(3.2);
    await m.long(6, 4);
    m.el.querySelector('[data-field=ht]').value = '900'; m.click('[data-act=pop-ok]');
    expect(m.g.items[0].height).toBe(4);
    await m.long(6, 4);
    m.click('[data-act=pop-height-default]');
    expect('height' in m.g.items[0]).toBe(false);
    await m.long(6, 4);
    m.el.querySelector('[data-field=ht]').value = '240'; m.click('[data-act=pop-ok]');
    expect('height' in m.g.items[0]).toBe(false);
    m.unmount();
  });
  test('bandeau : champ Hauteur (cm), ± et valeur par défaut', () => {
    const m = monter();
    m.click('[data-kind=pergola]'); m.tap(6, 4);
    const f = m.el.querySelector('[data-field=item-height]');
    expect(f.value).toBe('240');
    change(f, '300');
    expect(m.g.items[0].height).toBe(3);
    m.click('[data-act=height-minus]');
    expect(m.g.items[0].height).toBe(2.9);
    m.click('[data-act=height-reset]');
    expect('height' in m.g.items[0]).toBe(false);
    expect(m.el.querySelector('[data-field=item-height]').value).toBe('240');
    m.unmount();
  });
  test('clôture libre : hauteur bornée (30 cm – 3 m) et valeur par défaut', () => {
    const m = monter();
    m.g.obstacles.push({ id: 'o_f', kind: 'fence', points: [{ x: 2, y: 2 }, { x: 8, y: 2 }], height: 1.2 });
    m.click('[data-tab=edges]');
    m.tap(5, 2);
    const f = m.el.querySelector('[data-field=free-height]');
    expect(f).not.toBeNull(); expect(f.value).toBe('120');
    change(f, '900');
    expect(m.g.obstacles[0].height).toBe(3);
    m.click('[data-act=free-height-reset]');
    expect(m.g.obstacles[0].height).toBe(1.2);
    m.unmount();
  });
});

describe('éditeur de contour : obstacles', () => {
  test('hauteur en cm, bornes de heights.js, valeur par défaut', async () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = createGarden('C'); g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true;
    g.obstacles.push({ id: 'o_h', kind: 'house', points: RECT(1, 1, 5, 4), height: 6 });
    const unmount = mountContourEditor(el, { garden: g, onChange: () => {} });
    await wait(60);
    el.querySelector('[data-act=tool]').click();
    const f = el.querySelector('[data-field=obst-height-0]');
    expect(f).not.toBeNull(); expect(f.value).toBe('600');
    change(f, '5000');
    expect(g.obstacles[0].height).toBe(15);
    el.querySelector('[data-act=obst-height-reset-0]').click();
    expect(g.obstacles[0].height).toBe(6);
    unmount();
  });
});
