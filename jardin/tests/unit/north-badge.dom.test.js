/** @jest-environment jsdom */
import { createGarden } from '../../model.js';
import { mountContourEditor } from '../../ui/draw-contour.js';
import { mountZoneEditor } from '../../ui/draw-zones.js';
import { mountItemEditor } from '../../ui/draw-items.js';
import { mountSunPainter } from '../../ui/draw-sun.js';
import { createNorthBadge } from '../../ui/draw-util.js';
import { setNorthAngle } from '../../ui/north-pop.js';
import { northSVG } from '../../render-common.js';

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const jardin = () => {
  const g = createGarden('Nord');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }]; g.boundaryClosed = true;
  return g;
};
const EDITEURS = [['contour', mountContourEditor], ['zones', mountZoneEditor], ['aménagements', mountItemEditor], ['ensoleillement', mountSunPainter]];

describe('pastille du nord dans chaque éditeur', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test.each(EDITEURS)('%s : présente, état inconnu en pointillés, clic → réglage → jardin et pastille mis à jour', async (_n, mount) => {
    const g = jardin();
    const el = document.createElement('div'); document.body.append(el);
    let n = 0;
    const unmount = mount(el, { garden: g, onChange: () => { n++; } });
    await wait();
    const badge = el.querySelector('[data-role=north-badge]');
    expect(badge).toBeTruthy();
    expect(badge.closest('.jd-canvas-wrap')).toBeTruthy();
    expect(badge.dataset.known).toBe('0');
    expect(badge.classList.contains('is-unknown')).toBe(true);
    expect(badge.querySelector('.jd-north-disc').getAttribute('stroke-dasharray')).toBeTruthy();
    expect(badge.title).toContain('Orientation non renseignée');
    expect(badge.getAttribute('aria-label')).toContain('Orientation non renseignée');

    badge.click();
    const dlg = el.querySelector('[data-role=north-dialog]');
    expect(dlg).toBeTruthy();
    expect(dlg.textContent).toContain('Orienter le plan');
    el.querySelector('[data-act=north-right]').click();
    expect(el.querySelector('[data-role=north-dialog]')).toBeNull();
    expect(g.context.northAngle).toBe(90);
    expect(g.context.orientation).toBe(270);
    expect(n).toBeGreaterThan(0);
    expect(badge.dataset.known).toBe('1');
    expect(badge.getAttribute('aria-label')).toContain('Le nord est à droite du plan');
    expect(badge.querySelector('.jd-north-needle').getAttribute('data-angle')).toBe('90');
    expect(badge.querySelector('.jd-north-needle').style.transform).toBe('rotate(90deg)');
    unmount();
    expect(el.querySelector('[data-role=north-badge]')).toBeNull();
  });

  test.each(EDITEURS)('%s : rotation selon northAngle déjà enregistré, saisie libre', async (_n, mount) => {
    const g = jardin(); setNorthAngle(g.context, 225);
    const el = document.createElement('div'); document.body.append(el);
    mount(el, { garden: g, onChange: () => {} });
    await wait();
    const badge = el.querySelector('[data-role=north-badge]');
    expect(badge.dataset.known).toBe('1');
    expect(badge.querySelector('.jd-north-needle').getAttribute('data-angle')).toBe('225'); // rotation CSS au plus court (−135° ≡ 225°)
    badge.click();
    const inp = el.querySelector('[data-field=north-angle]');
    expect(inp.value).toBe('225');
    inp.value = '400'; inp.dispatchEvent(new Event('input'));
    el.querySelector('[data-act=north-ok]').click();
    expect(g.context.northAngle).toBe(40);
    expect(g.context.orientation).toBe(320);
    el.querySelector('[data-role=north-badge]').click();
    el.querySelector('[data-act=north-cancel]').click();
    expect(g.context.northAngle).toBe(40);
  });

  test('saisie illisible refusée, fenêtre gardée ouverte', async () => {
    const g = jardin(); const el = document.createElement('div'); document.body.append(el);
    mountSunPainter(el, { garden: g, onChange: () => {} }); await wait();
    el.querySelector('[data-role=north-badge]').click();
    const inp = el.querySelector('[data-field=north-angle]');
    inp.value = 'abc'; el.querySelector('[data-act=north-ok]').click();
    expect(el.querySelector('[data-role=north-dialog]')).toBeTruthy();
    expect(g.context.northAngle).toBe(0);
  });

  test('boussole indisponible : message clair', async () => {
    const g = jardin(); const el = document.createElement('div'); document.body.append(el);
    mountZoneEditor(el, { garden: g, onChange: () => {} }); await wait();
    el.querySelector('[data-role=north-badge]').click();
    el.querySelector('[data-act=north-compass]').click();
    expect(el.querySelector('.jd-north-status').textContent).toMatch(/indisponible/);
  });

  test('même convention que le rendu final (rotation horaire de northAngle)', () => {
    const wrap = document.createElement('div'); document.body.append(wrap);
    for (const a of [0, 90, 200]) {
      const b = createNorthBadge(wrap, { getAngle: () => a, getKnown: () => true });
      const m = b.el.querySelector('.jd-north-needle').style.transform.match(/rotate\((-?\d+)deg\)/);
      expect(((Number(m[1]) % 360) + 360) % 360).toBe(a);
      expect(northSVG(0, 0, a)).toContain(`rotate(${a})`);
      b.destroy();
    }
  });

  test('update() suit les changements externes (annuler, import)', () => {
    const wrap = document.createElement('div'); document.body.append(wrap);
    let a = 0;
    const b = createNorthBadge(wrap, { getAngle: () => a });
    a = 135; b.update();
    expect(b.el.getAttribute('aria-label')).toContain('en bas à droite');
    expect(b.el.title).toContain('135°');
    b.destroy(); expect(wrap.children.length).toBe(0);
  });
});
