import { createGarden, createZone } from '../../model.js';
import { mountContourEditor, mountZoneEditor, mountSunPainter } from '../../ui/draw.js';
import { mountPlanStep } from '../../ui/plan-step.js';
import { mountAdvice } from '../../ui/advice-screen.js';
import { mountSettings } from '../../ui/settings.js';
import { allPlants } from '../../catalog.js';

const click = (el, sel) => el.querySelector(sel).click();

function carre() {
  const g = createGarden('Dom');
  g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
  return g;
}

describe('éditeur de contour (DOM)', () => {
  test('ferme le contour, affiche surface/périmètre, côtés éditables, annuler/rétablir', () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = carre();
    let n = 0;
    const un = mountContourEditor(el, { garden: g, onChange: () => n++ });
    expect(el.querySelector('[data-role=count]').textContent).toBe('4');
    expect(el.querySelector('[data-role=area]').textContent).toBe('80,00');
    click(el, '[data-act=close]'); // lacet : 4 sommets, écart = un côté -> fermeture directe
    expect(g.boundaryClosed).toBe(true);
    expect(n).toBe(1);
    click(el, '[data-act=sides]');
    const len = el.querySelector('.side-len');
    len.value = '12'; len.dispatchEvent(new Event('change'));
    expect(el.querySelector('[data-role=area]').textContent).toBe('96,00'); // rectangle conservé
    click(el, '[data-act=undo]');
    expect(el.querySelector('[data-role=area]').textContent).toBe('80,00');
    click(el, '[data-act=redo]');
    expect(g.boundary[1].x).toBeCloseTo(12, 5);
    un();
    expect(el.innerHTML).toBe('');
  });

  test('ajout d\'un côté par longueur et direction', () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = createGarden('Cotes');
    mountContourEditor(el, { garden: g, onChange() {} });
    click(el, '[data-act=sides]');
    for (const [l, d] of [['5', '90'], ['4', '180']]) {
      el.querySelector('[data-role=add-length]').value = l;
      el.querySelector('[data-role=add-bearing]').value = d;
      click(el, '[data-act=add-side]');
    }
    expect(g.boundary).toHaveLength(3);
    expect(g.boundary[1].x).toBeCloseTo(5, 3);
    expect(g.boundary[2].y).toBeCloseTo(4, 3);
  });
});

describe('autres écrans (DOM)', () => {
  test('zones : palette des types souhaités et zone existante sélectionnable', () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = carre(); g.boundaryClosed = true; g.wishedZoneTypes = ['terrace', 'lawn'];
    g.zones.push(createZone('terrace', { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 3 }, { x: 1, y: 3 }] }));
    mountZoneEditor(el, { garden: g, onChange() {} });
    expect(el.querySelector('[data-type=terrace]').className).toContain('done');
    el.querySelector('[data-type=lawn]').click();
    expect(el.querySelector('[data-act=finish]')).not.toBeNull();
  });

  test('ensoleillement : bascule des modes', () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = carre();
    mountSunPainter(el, { garden: g, onChange() {} });
    click(el, '[data-act=mode-uniform]');
    expect(g.sun.mode).toBe('uniform');
    click(el, '[data-act=uniform-shade]');
    expect(g.sun.uniform).toBe('shade');
  });

  test('rendu : valider enregistre le plan', () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = carre(); g.boundaryClosed = true;
    let ok = 0;
    mountPlanStep(el, { garden: g, onValidate: () => ok++, onBack() {} });
    expect(el.querySelector('svg')).not.toBeNull();
    click(el, '[data-act=validate]');
    expect(g.status).toBe('validated');
    expect(g.plan.svg).toContain('<svg');
    expect(ok).toBe(1);
  });

  test('rendu : un contour non fermé bloque la validation', () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = carre();
    mountPlanStep(el, { garden: g, onValidate() { throw new Error('ne doit pas valider'); } });
    click(el, '[data-act=validate]');
    expect(g.status).toBe('draft');
    expect(el.querySelector('[data-role=plan-issues]').hidden).toBe(false);
  });

  test('conseils : calendrier 12 mois et tâche cochable', () => {
    const el = document.createElement('div'); document.body.append(el);
    const g = carre(); g.boundaryClosed = true;
    const z = createZone('midplants', { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 4 }, { x: 1, y: 4 }] });
    z.plantings = [{ plantId: allPlants().find((p) => p.category === 'perennial').id, count: 5 }];
    g.zones.push(z);
    let saved = 0;
    mountAdvice(el, { garden: g, onChange: () => saved++ });
    expect(el.querySelectorAll('.jd-month')).toHaveLength(12);
    // un mois avec des tâches
    const mois = [...el.querySelectorAll('.jd-month')].find((b) => b.querySelector('small').textContent !== '—');
    mois.click();
    const cb = el.querySelector('.jd-task input');
    cb.checked = true; cb.dispatchEvent(new Event('change'));
    expect(Object.keys(g.tasksDone)).toHaveLength(1);
    expect(saved).toBe(1);
    el.querySelector('[data-tab=water]').click();
    expect(el.textContent).toContain('ordres de grandeur');
  });

  test('réglages : formulaire des notifications', async () => {
    const el = document.createElement('div'); document.body.append(el);
    mountSettings(el);
    expect(el.querySelector('[data-act=test-notification]')).not.toBeNull();
    expect(el.querySelector('[data-setting=frost]')).not.toBeNull();
  });
});
