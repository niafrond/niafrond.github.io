/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { mountWished } from '../../ui/step-wished.js';
import { mountZoneEditor } from '../../ui/draw.js';
import { mountPlants } from '../../ui/step-plants.js';
import { bedModeOf, createGarden, createZone, validateGarden } from '../../model.js';
import { proposeBeds, bedsToZones } from '../../massifs.js';
import { gardenA } from './massif-fixtures.js';

const click = (n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let el;
beforeEach(() => { document.body.innerHTML = '<div id="toast" hidden></div>'; el = document.createElement('div'); document.body.append(el); });

describe('étape « Zones souhaitées » : mode des massifs', () => {
  test('deux cartes ; passer en auto retire les types massif sans perte, retour en manuel les restitue', () => {
    const g = createGarden();
    g.wishedZoneTypes = ['terrace', 'midplants'];
    const onChange = jest.fn();
    mountWished(el, { garden: g, onChange });
    const cards = el.querySelectorAll('[data-bed-mode]');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Je dessine mes massifs moi-même');
    expect(cards[1].textContent).toContain('L’app calcule les massifs');
    expect(el.querySelector('#wish-midplants')).not.toBeNull();
    expect(el.querySelector('[data-bed-mode=manual]').getAttribute('aria-checked')).toBe('true');
    click(el.querySelector('[data-bed-mode=auto]'));
    expect(g.context.bedMode).toBe('auto');
    expect(onChange).toHaveBeenCalled();
    ['lowplants', 'midplants', 'tallplants'].forEach((t) => expect(el.querySelector(`#wish-${t}`)).toBeNull());
    expect(el.querySelector('#wish-terrace')).not.toBeNull();
    expect(el.querySelector('[data-role=wished-auto-note]').textContent).toContain('Massifs');
    expect(g.wishedZoneTypes).toEqual(['terrace', 'midplants']); // rien de perdu
    click(el.querySelector('[data-bed-mode=manual]'));
    expect(bedModeOf(g)).toBe('manual');
    expect(el.querySelector('#wish-midplants').checked).toBe(true);
  });
  test('en mode auto, une zone souhaitée « massif » ne provoque plus d’avertissement', () => {
    const g = gardenA();
    g.wishedZoneTypes = ['midplants'];
    expect(validateGarden(g).warnings.some((w) => /Massif de plantes moyennes/.test(w))).toBe(true);
    g.context.bedMode = 'auto';
    expect(validateGarden(g).warnings.some((w) => /Massif de plantes moyennes/.test(w))).toBe(false);
  });
});

describe('éditeur de zones en mode auto', () => {
  const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  test('les types massif ne sont plus proposés (message), les massifs auto restent sélectionnables', async () => {
    const g = createGarden('Z');
    g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true; g.context.bedMode = 'auto';
    g.wishedZoneTypes = ['terrace', 'midplants'];
    const auto = createZone('midplants', { kind: 'polygon', points: RECT(1, 1, 4, 3) });
    auto.auto = true; auto.label = 'Massif n°1';
    g.zones = [auto];
    const unmount = mountZoneEditor(el, { garden: g, onChange() {} });
    await wait(50);
    const pal = el.querySelector('[data-role=palette]');
    ['lowplants', 'midplants', 'tallplants'].forEach((t) => expect(pal.querySelector(`[data-type=${t}]`)).toBeNull());
    expect(pal.querySelector('[data-type=terrace]')).not.toBeNull();
    const note = pal.querySelector('[data-role=beds-note]');
    expect(note.textContent).toContain('Les massifs fleuris sont calculés à l’étape Massifs');
    expect(note.getAttribute('href')).toMatch(/\/beds$/);
    el.querySelector('[data-act=toggle-all]').click();
    await wait(5);
    expect(pal.querySelector('[data-type=midplants]')).toBeNull();
    expect(el.textContent).not.toContain('À dessiner : Massif');
    unmount();
  });
});

describe('étape Essences : massif calculé', () => {
  test('badge « ✨ auto », explication et « Recalculer ce massif »', () => {
    const g = gardenA();
    const beds = proposeBeds(g, { seed: 3, coverage: 0.3 });
    const zones = bedsToZones(g, beds.slice(0, 1));
    g.zones = [...g.zones, ...zones];
    const z = zones[0];
    const mount = (zid) => mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 1 });
    mount();
    el.querySelector('#zone-sel').value = z.id;
    el.querySelector('#zone-sel').dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.querySelector('[data-role=auto-badge]').textContent).toContain('auto');
    expect(el.querySelector('[data-role=auto-info]').textContent).toContain(z.autoInfo.why.slice(0, 20));
    const avant = JSON.stringify(z.plantings);
    click(el.querySelector('[data-act=recalc-bed]'));
    expect(JSON.stringify(z.plantings)).not.toBe(avant);
    expect(z.auto).toBe(true);
    expect(z.plantings.length).toBeGreaterThan(2);
    // une zone ordinaire n'a ni badge ni explication
    el.querySelector('#zone-sel').value = g.zones[0].id;
    el.querySelector('#zone-sel').dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.querySelector('[data-role=auto-badge]')).toBeNull();
    expect(el.querySelector('[data-role=auto-info]')).toBeNull();
  });
});
