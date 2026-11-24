import { parseLength, toCm } from '../../ui/draw-util.js';

describe('parseLength (saisie en cm)', () => {
  test.each([
    ['350', 3.5], ['1000', 10], ['350 cm', 3.5], ['3,5 m', 3.5], ['3,5', 3.5], ['3.5', 3.5], ['12m', 12], ['  45 ', 0.45],
  ])('%s → %s m', (txt, m) => expect(parseLength(txt)).toBeCloseTo(m, 6));
  test.each(['', 'abc', '0', '-5', '3 5 x'])('%j est refusé', (txt) => expect(Number.isNaN(parseLength(txt))).toBe(true));
  test('toCm arrondit au centimètre', () => expect(toCm(3.456)).toBe('346'));
});
