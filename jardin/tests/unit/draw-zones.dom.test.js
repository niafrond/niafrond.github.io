// Éditeur de zones (DOM) : palette, démarrage guidé, création (rectangle 2 touches, cercle, forme libre),
// sélection, poignées, appui long en cm, dupliquer / supprimer, avertissements, annuler / rétablir.
import { createGarden, createZone } from '../../model.js';
import { mountZoneEditor } from '../../ui/draw.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

async function setup({ zones = [], wished = [] } = {}) {
  const el = document.createElement('div'); document.body.append(el);
  const g = createGarden('Zones');
  g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true; g.wishedZoneTypes = wished;
  zones.forEach((z) => g.zones.push(z));
  let saves = 0;
  const unmount = mountZoneEditor(el, { garden: g, onChange: () => { saves++; } });
  await sleep(100); // recadrage différé du plan
  const svg = el.querySelector('.jd-svg');
  const xy = (x, y) => {
    const vb = svg.getAttribute('viewBox').split(' ').map(Number);
    const mpp = vb[2] / 390;
    return [(x - vb[0]) / mpp, (y - vb[1]) / mpp];
  };
  const fire = (type, x, y) => {
    const [cx, cy] = xy(x, y);
    const ev = new MouseEvent(type, { clientX: cx, clientY: cy, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'touch' });
    svg.dispatchEvent(ev);
  };
  const tap = (x, y) => { fire('pointerdown', x, y); fire('pointerup', x, y); };
  const drag = (a, b) => { fire('pointerdown', a.x, a.y); fire('pointermove', (a.x + b.x) / 2, (a.y + b.y) / 2); fire('pointermove', b.x, b.y); fire('pointerup', b.x, b.y); };
  const longPress = async (x, y) => { fire('pointerdown', x, y); await sleep(560); fire('pointerup', x, y); };
  const q = (s) => el.querySelector(s);
  const click = (s) => q(s).click();
  return { el, g, svg, tap, drag, longPress, q, click, unmount, saves: () => saves };
}

describe('éditeur de zones : palette et démarrage guidé', () => {
  test('cartes des types souhaités : à dessiner / dessiné (n), accès « autres types »', async () => {
    const z = createZone('terrace', { kind: 'polygon', points: RECT(1, 1, 4, 3) });
    const t = await setup({ zones: [z], wished: ['terrace', 'lawn'] });
    expect(t.q('[data-type=terrace]').textContent).toContain('✓ dessiné (1)');
    expect(t.q('[data-type=lawn]').textContent).toContain('à dessiner');
    expect(t.q('[data-type=vegetable]')).toBeNull();
    t.click('[data-act=toggle-all]');
    expect(t.q('[data-type=vegetable]')).not.toBeNull();
    t.unmount();
  });

  test('plan sans zone : message de démarrage, disparaît dès qu’un type est choisi', async () => {
    const t = await setup({ wished: ['lawn', 'terrace'] });
    const start = t.q('[data-role=start-panel]');
    expect(start.hidden).toBe(false);
    expect(start.textContent).toContain('Choisissez une zone puis dessinez-la');
    start.querySelector('[data-start-type=lawn]').click();
    expect(start.hidden).toBe(true);
    expect(t.q('[data-type=lawn]').getAttribute('aria-pressed')).toBe('true');
    t.unmount();
  });
});

describe('éditeur de zones : création', () => {
  test('rectangle en 2 touches (coins opposés) avec aperçu des dimensions', async () => {
    const t = await setup();
    t.click('[data-type=terrace]');
    t.tap(2, 2);
    expect(t.q('[data-role=live]').hidden).toBe(false);
    t.tap(6.5, 5);
    expect(t.g.zones).toHaveLength(1);
    const z = t.g.zones[0];
    expect(z.type).toBe('terrace');
    expect(z.shape.points).toEqual(RECT(2, 2, 6.5, 5));
    expect(t.q('[data-role=zone-area]').textContent).toContain('13,50');
    expect(t.q('[data-role=zone-panel]').hidden).toBe(false);
    t.unmount();
  });

  test('bascule « forme libre » : points successifs puis Terminer', async () => {
    const t = await setup();
    t.click('[data-type=lawn]');
    t.click('[data-act=mode-free]');
    expect(t.q('[data-act=finish]').disabled).toBe(true);
    t.tap(2, 2); t.tap(6, 2); t.tap(5, 5);
    expect(t.q('[data-act=finish]').disabled).toBe(false);
    t.click('[data-act=finish]');
    expect(t.g.zones[0].shape.points).toHaveLength(3);
    t.unmount();
  });

  test('annulation du tracé en cours', async () => {
    const t = await setup();
    t.click('[data-type=terrace]');
    t.tap(2, 2);
    expect(t.q('[data-act=cancel-draw]').disabled).toBe(false);
    t.click('[data-act=cancel-draw]');
    t.tap(3, 3); t.tap(5, 6);
    expect(t.g.zones[0].shape.points).toEqual(RECT(3, 3, 5, 6));
    t.unmount();
  });

  test('cercle : toucher le centre puis toucher le bord pour le rayon', async () => {
    const t = await setup();
    t.click('[data-type=trees]');
    t.tap(6, 4);
    t.tap(7.5, 4);
    const s = t.g.zones[0].shape;
    expect(s.kind).toBe('circle');
    expect(s.center).toEqual({ x: 6, y: 4 });
    expect(s.radius).toBeCloseTo(1.5, 2);
    t.unmount();
  });

  test('cercle : toucher le centre puis glisser fixe le rayon', async () => {
    const t = await setup();
    t.click('[data-type=pond]');
    t.click('[data-act=kind-circle]');
    t.drag({ x: 6, y: 4 }, { x: 6, y: 5 });
    expect(t.g.zones[0].shape.radius).toBeCloseTo(1, 2);
    t.unmount();
  });

  test('ligne (allée) : points successifs avec largeur saisie', async () => {
    const t = await setup();
    t.click('[data-type=path]');
    expect(t.q('[data-act=kind-line]')).not.toBeNull();
    t.click('[data-act=kind-line]');
    const w = t.q('[data-role=line-width]'); w.value = '80'; w.dispatchEvent(new Event('change'));
    t.tap(2, 2); t.tap(8, 2);
    t.click('[data-act=finish]');
    expect(t.g.zones[0].shape).toMatchObject({ kind: 'line', width: 0.8 });
    t.unmount();
  });

  test('aimantation sur un sommet du contour et sur le prolongement d’un côté', async () => {
    const t = await setup();
    t.click('[data-type=terrace]');
    t.tap(0.15, 0.15); // sommet (0,0)
    t.tap(3.3, 3.3); // grille
    expect(t.g.zones[0].shape.points[0]).toEqual({ x: 0, y: 0 });
    t.click('[data-type=lawn]');
    t.tap(5.3, 7.95); // proche du côté bas (y = 8)
    t.tap(8.7, 5.2);
    const p = t.g.zones[1].shape.points;
    expect(p[0].y).toBeCloseTo(8, 2);
    t.unmount();
  });

  test('appui long sur le plan vide avec un type : création par dimensions en cm', async () => {
    const t = await setup();
    t.click('[data-type=terrace]');
    await t.longPress(3, 2);
    expect(t.q('[data-role=pop]').hidden).toBe(false);
    t.q('[data-field=w]').value = '400'; t.q('[data-field=l]').value = '250';
    t.click('[data-act=pop-ok]');
    expect(t.g.zones).toHaveLength(1);
    const pts = t.g.zones[0].shape.points;
    expect(pts[1].x - pts[0].x).toBeCloseTo(4, 3);
    expect(pts[2].y - pts[1].y).toBeCloseTo(2.5, 3);
    t.unmount();
  });
});

describe('éditeur de zones : sélection et édition', () => {
  const mk = () => createZone('terrace', { kind: 'polygon', points: RECT(2, 2, 6, 5) });

  test('toucher une zone la sélectionne (bandeau : nom, type, surface, plantes, actions)', async () => {
    const z = mk(); z.plantings = [{ plantId: 'x', count: 3 }, { plantId: 'y', count: 1 }];
    const t = await setup({ zones: [z] });
    expect(t.q('[data-role=zone-panel]').hidden).toBe(true);
    t.tap(4, 3.5);
    const p = t.q('[data-role=zone-panel]');
    expect(p.hidden).toBe(false);
    expect(t.q('[data-role=zone-name]').value).toBe('Terrasse');
    expect(t.q('[data-role=zone-area]').textContent).toContain('12,00');
    expect(t.q('[data-role=zone-plants]').textContent).toContain('2 plantes');
    ['dims', 'duplicate', 'delete-zone', 'deselect'].forEach((a) => expect(t.q(`[data-act=${a}]`)).not.toBeNull());
    t.tap(10, 7); // vide : désélection
    expect(p.hidden).toBe(true);
    t.unmount();
  });

  test('renommer et changer le type', async () => {
    const t = await setup({ zones: [mk()] });
    t.tap(4, 3.5);
    const n = t.q('[data-role=zone-name]'); n.value = 'Coin repas'; n.dispatchEvent(new Event('change'));
    expect(t.g.zones[0].label).toBe('Coin repas');
    const sel = t.q('[data-role=zone-type]'); sel.value = 'lawn'; sel.dispatchEvent(new Event('change'));
    expect(t.g.zones[0].type).toBe('lawn');
    t.unmount();
  });

  test('dupliquer puis supprimer, avec annuler / rétablir global', async () => {
    const t = await setup({ zones: [mk()] });
    t.tap(4, 3.5);
    t.click('[data-act=duplicate]');
    expect(t.g.zones).toHaveLength(2);
    expect(t.g.zones[1].label).toContain('copie');
    expect(t.g.zones[1].shape.points[0]).toEqual({ x: 2.5, y: 2.5 });
    t.click('[data-act=delete-zone]');
    expect(t.g.zones).toHaveLength(1);
    t.click('[data-act=undo]');
    expect(t.g.zones).toHaveLength(2);
    t.click('[data-act=redo]');
    expect(t.g.zones).toHaveLength(1);
    t.click('[data-act=undo]'); t.click('[data-act=undo]');
    expect(t.g.zones).toHaveLength(1);
    t.unmount();
  });

  test('appui long sur une zone : largeur × longueur en cm (rectangle)', async () => {
    const t = await setup({ zones: [mk()] });
    await t.longPress(4, 3.5);
    expect(t.q('[data-role=pop]').hidden).toBe(false);
    expect(t.q('[data-field=w]').value).toBe('400');
    expect(t.q('[data-field=l]').value).toBe('300');
    t.q('[data-field=w]').value = '550'; t.q('[data-field=l]').value = '3,2 m';
    t.q('[data-field=w]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(t.g.zones[0].shape.points).toEqual(RECT(2, 2, 7.5, 5.2));
    expect(t.q('[data-role=pop]').hidden).toBe(true);
    t.unmount();
  });

  test('appui long : rayon d’un cercle et largeur d’une ligne', async () => {
    const c = createZone('trees', { kind: 'circle', center: { x: 4, y: 4 }, radius: 1 });
    const l = createZone('path', { kind: 'line', points: [{ x: 8, y: 1 }, { x: 8, y: 7 }], width: 1 });
    const t = await setup({ zones: [c, l] });
    await t.longPress(4, 4);
    expect(t.q('[data-field=r]')).not.toBeNull();
    t.q('[data-field=r]').value = '250'; t.click('[data-act=pop-ok]');
    expect(c.shape.radius).toBeCloseTo(2.5, 3);
    await t.longPress(8, 4);
    expect(t.q('[data-field=w]')).not.toBeNull();
    t.q('[data-field=w]').value = '60'; t.click('[data-act=pop-ok]');
    expect(t.g.zones[1].shape.width).toBeCloseTo(0.6, 3);
    t.unmount();
  });

  test('bouton « Dimensions… » ouvre la même fenêtre ; valeur illisible refusée', async () => {
    const t = await setup({ zones: [mk()] });
    t.tap(4, 3.5);
    t.click('[data-act=dims]');
    t.q('[data-field=w]').value = 'abc';
    t.click('[data-act=pop-ok]');
    expect(t.q('[data-field=w]').classList.contains('bad')).toBe(true);
    expect(t.g.zones[0].shape.points).toEqual(RECT(2, 2, 6, 5));
    t.click('[data-act=pop-cancel]');
    expect(t.q('[data-role=pop]').hidden).toBe(true);
    t.unmount();
  });

  test('glisser un coin déforme en gardant un rectangle ; glisser la zone la déplace', async () => {
    const t = await setup({ zones: [mk()] });
    t.tap(4, 3.5);
    t.drag({ x: 6, y: 5 }, { x: 8, y: 6 });
    expect(t.g.zones[0].shape.points).toEqual(RECT(2, 2, 8, 6));
    t.drag({ x: 4, y: 4 }, { x: 5, y: 4.5 });
    expect(t.g.zones[0].shape.points[0]).toEqual({ x: 3, y: 2.5 });
    t.click('[data-act=undo]');
    expect(t.g.zones[0].shape.points[0]).toEqual({ x: 2, y: 2 });
    t.unmount();
  });

  test('glisser le milieu d’un côté insère un sommet', async () => {
    const t = await setup({ zones: [mk()] });
    t.tap(4, 3.5);
    t.drag({ x: 4, y: 2 }, { x: 4, y: 1 });
    const pts = t.g.zones[0].shape.points;
    expect(pts).toHaveLength(5);
    expect(pts[1]).toEqual({ x: 4, y: 1 });
    t.unmount();
  });

  test('zone non sélectionnée : glisser déplace le plan, pas la zone', async () => {
    const t = await setup({ zones: [mk()] });
    t.drag({ x: 4, y: 3.5 }, { x: 5, y: 3.5 });
    expect(t.g.zones[0].shape.points[0]).toEqual({ x: 2, y: 2 });
    t.unmount();
  });
});

describe('éditeur de zones : avertissements', () => {
  test('zone qui sort du terrain : contour rouge et avertissement', async () => {
    const z = createZone('lawn', { kind: 'polygon', points: RECT(10, 5, 14, 9) });
    const t = await setup({ zones: [z] });
    expect(t.svg.querySelector('polygon[data-out]')).not.toBeNull();
    expect(t.q('.jd-info').textContent).toContain('hors du terrain');
    t.tap(12, 7);
    expect(t.q('[data-role=zone-warnings]').textContent).toContain('Dépasse du contour');
    t.unmount();
  });

  test('chevauchement de deux zones au sol signalé', async () => {
    const a = createZone('lawn', { kind: 'polygon', points: RECT(1, 1, 5, 5) });
    const b = createZone('terrace', { kind: 'polygon', points: RECT(3, 3, 7, 7) });
    const t = await setup({ zones: [a, b] });
    expect(t.q('.jd-info').textContent).toContain('1 chevauchement');
    t.tap(6.5, 6.5);
    expect(t.q('[data-role=zone-warnings]').textContent).toContain('Chevauche');
    t.unmount();
  });

  test('unmount vide le conteneur', async () => {
    const t = await setup();
    t.unmount();
    expect(t.el.innerHTML).toBe('');
  });
});

describe('éditeur de zones : enchaîner les zones', () => {
  test('la palette reste visible après une création et pendant la sélection, pour enchaîner', async () => {
    const t = await setup({ wished: ['terrace', 'lawn', 'trees'] });
    t.click('[data-type=terrace]');
    t.tap(1, 1); t.tap(4, 3);
    // la zone créée est sélectionnée, mais la palette est toujours là (compacte)
    expect(t.q('[data-role=zone-panel]').hidden).toBe(false);
    expect(t.q('[data-role=palette]').hidden).toBe(false);
    expect(t.q('[data-role=palette]').classList.contains('compact')).toBe(true);
    // on enchaîne tout de suite avec un autre type
    t.click('[data-type=lawn]');
    t.tap(5, 1); t.tap(9, 6);
    expect(t.g.zones.map((z) => z.type)).toEqual(['terrace', 'lawn']);
    expect(t.q('[data-role=palette]').hidden).toBe(false);
    t.unmount();
  });
});
