/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import { openSaveDialog, safeFilename } from '../../ui/save-file.js';

beforeAll(() => { URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {}; });
afterEach(() => { document.body.innerHTML = ''; delete window.Capacitor; delete navigator.share; });

test('safeFilename : accents, espaces et caractères spéciaux', () => {
  expect(safeFilename('Mon jardin à Lyon !')).toBe('jardin-Mon_jardin_a_Lyon.json');
  expect(safeFilename('')).toBe('jardin-jardin.json');
});

test('la fenêtre propose un vrai lien d’enregistrement, le partage et la copie', () => {
  const d = openSaveDialog({ filename: 'jardin-x.json', text: '{"a":1}' });
  const a = document.querySelector('[data-act=save-link]');
  expect(a.tagName).toBe('A');
  expect(a.getAttribute('download')).toBe('jardin-x.json');
  expect(a.getAttribute('href')).toBe('blob:test');
  expect(document.querySelector('[data-act=save-share]')).not.toBeNull();
  expect(document.querySelector('[data-act=save-copy]')).not.toBeNull();
  document.querySelector('[data-act=save-close]').click();
  expect(document.querySelector('[data-role=save-dialog]')).toBeNull();
  expect(d.close).toBeInstanceOf(Function);
});

test('copie : message de confirmation', async () => {
  Object.assign(navigator, { clipboard: { writeText: async () => {} } });
  openSaveDialog({ filename: 'a.json', text: 'abc' });
  document.querySelector('[data-act=save-copy]').click();
  await new Promise((r) => setTimeout(r, 10));
  expect(document.querySelector('[data-role=save-status]').textContent).toContain('copié');
});

test('app Android : écrit le fichier dans le cache puis ouvre le partage natif', async () => {
  const writeFile = jest.fn(async () => ({ uri: 'file:///cache/a.json' }));
  const share = jest.fn(async () => ({}));
  window.Capacitor = { Plugins: { Filesystem: { writeFile }, Share: { share } } };
  openSaveDialog({ filename: 'a.json', text: '{}' });
  await new Promise((r) => setTimeout(r, 10));
  expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'a.json', data: '{}', directory: 'CACHE' }));
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///cache/a.json' }));
});
