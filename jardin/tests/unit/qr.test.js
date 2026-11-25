import { qrSvg } from '../../qr.js';

test('SVG généré pour un petit texte', () => {
  const svg = qrSvg('https://niafrond.github.io/jardin/#/import/v1.abc', { size: 200 });
  expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 \d+ \d+"/);
  expect(svg).toContain('width="200"');
  expect(svg).toContain('<path d="M');
});
test('texte long mais acceptable', () => {
  expect(qrSvg('a'.repeat(1500))).toContain('<svg');
});
test('null si trop long ou vide', () => {
  expect(qrSvg('a'.repeat(2100))).toBeNull();
  expect(qrSvg('')).toBeNull();
});
