import { colorName, formatBloom, priceLabel } from '../../ui/step-plants.js';

test('colorName : noms français lisibles', () => {
  expect(colorName('#ff0000')).toBe('rouge');
  expect(colorName('#ffffff')).toBe('blanc');
  expect(colorName('#000000')).toBe('noir');
  expect(colorName('#2e7d32')).toBe('vert');
  expect(colorName('#1e40af')).toBe('bleu');
  expect(colorName('#7b3fa0')).toBe('violet');
  expect(colorName('#ffd400')).toBe('jaune');
  expect(colorName('#f48fb1')).toBe('rose');
  expect(colorName('#808080')).toBe('gris');
  expect(colorName('nope')).toBe('inconnue');
  expect(colorName('#f00')).toBe('rouge');
});

test('formatBloom : plages de mois', () => {
  expect(formatBloom([3, 4, 5, 6])).toBe('mars à juin');
  expect(formatBloom([6, 3, 9])).toBe('mars, juin, septembre');
  expect(formatBloom([4, 5, 9])).toBe('avril et mai, septembre');
  expect(formatBloom([])).toBe('');
  expect(formatBloom(undefined)).toBe('');
});

test('priceLabel : « ≈ 12 € / plant, pot 3 L »', () => {
  expect(priceLabel({ priceEur: 12, priceUnit: 'plant', priceNote: 'pot 3 L' })).toBe('≈ 12 € / plant, pot 3 L');
  expect(priceLabel({ priceEur: 0.5, priceUnit: 'm2', priceNote: '' })).toBe('≈ 0,5 € / m²');
  expect(priceLabel({ priceEur: 0.4, priceUnit: 'bulb' })).toBe('≈ 0,4 € / bulbe');
  expect(priceLabel({ priceEur: null })).toBeNull();
});
