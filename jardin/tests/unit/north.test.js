import { setNorthAngle, northKnown } from '../../ui/north-pop.js';
import { normAngle, northLabel } from '../../ui/draw-util.js';
import { northSVG } from '../../render-common.js';
import { createGarden } from '../../model.js';

describe('setNorthAngle', () => {
  test('met à jour northAngle et orientation ensemble', () => {
    const c = {};
    expect(setNorthAngle(c, 90)).toBe(90);
    expect(c).toEqual({ northAngle: 90, orientation: 270 });
    setNorthAngle(c, 0);
    expect(c).toEqual({ northAngle: 0, orientation: 0 });
  });
  test.each([[0, 0], [45, 315], [180, 180], [270, 90], [359, 1]])('orientation = (360 − northAngle) %% 360 pour %i', (deg, o) => {
    const c = {}; setNorthAngle(c, deg);
    expect(c.northAngle).toBe(deg); expect(c.orientation).toBe(o);
    expect((360 - c.orientation) % 360).toBe(c.northAngle);
  });
  test('normalise 0–359 (négatif, > 360, décimales)', () => {
    expect(normAngle(360)).toBe(0); expect(normAngle(-90)).toBe(270); expect(normAngle(725)).toBe(5); expect(normAngle(89.6)).toBe(90);
    const c = {}; setNorthAngle(c, -45); expect(c.northAngle).toBe(315);
  });
  test('valeur illisible : contexte inchangé', () => {
    const c = { northAngle: 10, orientation: 350 };
    expect(setNorthAngle(c, NaN)).toBeNull(); expect(setNorthAngle(c, 'abc')).toBeNull();
    expect(c).toEqual({ northAngle: 10, orientation: 350 });
  });
  test('orientation renseignée ou non', () => {
    const g = createGarden('x');
    expect(northKnown(g)).toBe(false);
    setNorthAngle(g.context, 0);
    expect(northKnown(g)).toBe(true);
  });
});

describe('libellés d\'orientation', () => {
  test.each([
    [0, 'Le nord est en haut du plan'], [45, 'Le nord est en haut à droite du plan'], [90, 'Le nord est à droite du plan'],
    [135, 'Le nord est en bas à droite du plan'], [180, 'Le nord est en bas du plan'], [225, 'Le nord est en bas à gauche du plan'],
    [270, 'Le nord est à gauche du plan'], [315, 'Le nord est en haut à gauche du plan'], [350, 'Le nord est en haut du plan'], [-90, 'Le nord est à gauche du plan'],
  ])('%i°', (a, t) => expect(northLabel(a)).toBe(t));
});

describe('convention commune éditeur / rendu', () => {
  test('le rendu final tourne la rose de northAngle degrés dans le sens horaire (SVG rotate)', () => {
    expect(northSVG(10, 20, 90)).toContain('rotate(90)');
    expect(northSVG(10, 20, 0)).toContain('rotate(0)');
  });
});
