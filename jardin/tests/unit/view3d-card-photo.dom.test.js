// Fiche d'une essence en vue 3D : la photo (Wikipédia) s'affiche, sans photo la fiche reste valable.
import { createLabelsUI } from '../../ui/view3d-labels.js';

const plant = { id: 'lavande', commonName: 'Lavande vraie', latinName: 'Lavandula angustifolia' };
const group = { key: 'a', name: 'Lavande vraie', latin: 'Lavandula angustifolia', essence: 'lavande', catalog: plant, plant, renderIds: ['r1'], zones: [{ id: 'z', label: 'Massif' }], bloom: [6], priceEur: 6, count: 5, colors: { foliage: '#4a7', flower: '#86b' }, anchor: { x: 0, y: 0, z: 0 }, priority: 1, height: 0.6, source: 'zone' };
const mk = (getPhoto) => {
  document.body.innerHTML = ''; const root = document.createElement('div'); document.body.appendChild(root);
  const ui = createLabelsUI({ root, project: () => ({ x: 10, y: 10 }), viewport: () => ({ width: 800, height: 600 }), getPhoto });
  ui.setGroups([group]); return { root, ui };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

test('la photo apparaît dans la fiche', async () => {
  const { root, ui } = mk(async () => ({ url: 'http://x/a.jpg', medium: 'http://x/b.jpg', credit: 'Photo : Wikipédia' }));
  ui.select('a'); await tick();
  const img = root.querySelector('.v3d-card-photo img'); expect(img).not.toBeNull();
  img.dispatchEvent(new Event('load'));
  expect(root.querySelector('.v3d-card-photo').classList.contains('is-placeholder')).toBe(false);
  expect(root.querySelector('.v3d-card-credit').textContent).toContain('Wikipédia');
});

test('sans photo, la fiche garde un cadre de remplacement aux couleurs de la plante', async () => {
  const { root, ui } = mk(async () => null);
  ui.select('a'); await tick();
  expect(root.querySelector('.v3d-card-photo').classList.contains('is-placeholder')).toBe(true);
  expect(root.querySelector('.v3d-card-photo img')).toBeNull();
  expect(root.querySelector('[data-role=card-name]').textContent).toBe('Lavande vraie');
});

test('la fiche propose un bouton de téléchargement de la photo', async () => {
  const { root, ui } = mk(async () => ({ url: 'http://x/a.jpg', credit: 'Photo : Wikipédia' }));
  ui.select('a'); await tick();
  const btn = root.querySelector('.v3d-card-photo [data-act=card-download]');
  expect(btn).not.toBeNull(); expect(btn.textContent).toContain('Photo');
});
