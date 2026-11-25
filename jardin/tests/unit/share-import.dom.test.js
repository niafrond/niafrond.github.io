import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'node:util';

// jsdom n'expose ni TextEncoder ni les flux de compression : l'encodage retombe sur le code non compressé « v1u. ».
globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;
import { mountShareScreen, shareBase, PUBLIC_URL } from '../../ui/share-screen.js';
import { mountImportScreen } from '../../ui/import-screen.js';
import { encodeGarden } from '../../transfer.js';
import { createGarden, createZone } from '../../model.js';
import { storage } from '../../storage.js';

const jardin = () => {
  const g = createGarden('Partagé');
  g.boundary = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }];
  g.zones.push(createZone('lawn', { kind: 'polygon', points: g.boundary }));
  return g;
};
const attendre = async (fn) => { for (let i = 0; i < 100; i++) { try { if (fn()) return; } catch { /* encore */ } await new Promise((r) => setTimeout(r, 10)); } throw new Error('délai dépassé'); };

describe('écran de partage', () => {
  test('lien, QR, fichier, avertissement', async () => {
    const el = document.createElement('div'); document.body.append(el);
    const back = jest.fn();
    const un = mountShareScreen(el, { garden: jardin(), onBack: back });
    await attendre(() => el.querySelector('#share-link'));
    const link = el.querySelector('#share-link');
    expect(link.readOnly).toBe(true);
    expect(link.value).toBe(PUBLIC_URL + '#/import/' + link.value.split('#/import/')[1]);
    expect(el.querySelector('.qr-box svg')).toBeTruthy();
    expect(el.querySelector('[data-act=download]')).toBeTruthy();
    expect(el.textContent).toMatch(/ne le partagez qu’avec vous-même/);
    expect(el.querySelector('[data-act=share]')).toBeNull(); // pas de navigator.share en jsdom
    el.querySelector('[data-act=back]').click();
    expect(back).toHaveBeenCalled();
    un();
    expect(el.children.length).toBe(0);
  });
  test('shareBase', () => {
    expect(shareBase({ protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:4173', pathname: '/jardin/' }, undefined)).toBe(PUBLIC_URL);
    expect(shareBase({ protocol: 'https:', hostname: 'x.example', origin: 'https://x.example', pathname: '/app/index.html' }, undefined)).toBe('https://x.example/app/');
    expect(shareBase({ protocol: 'https:', hostname: 'x.example', origin: 'https://x.example', pathname: '/a/' }, { isNativePlatform: () => true })).toBe(PUBLIC_URL);
  });
});

describe('écran d’import', () => {
  test('aperçu puis import', async () => {
    const g = jardin();
    const code = await encodeGarden(g);
    const el = document.createElement('div'); document.body.append(el);
    const onDone = jest.fn();
    const un = mountImportScreen(el, { code, onDone, onCancel: () => {} });
    await attendre(() => el.querySelector('[data-role=preview]'));
    expect(el.querySelector('[data-role=preview]').textContent).toMatch(/Partagé/);
    expect(el.querySelector('[data-role=preview]').textContent).toMatch(/30 m²/);
    expect(el.querySelector('[data-act=open-app]').getAttribute('href')).toBe('jardin://import/' + code);
    el.querySelector('[data-act=import]').click();
    await attendre(() => onDone.mock.calls.length);
    const nouveau = await storage.getGarden(onDone.mock.calls[0][0]);
    expect(nouveau.name).toBe('Partagé');
    expect(nouveau.id).not.toBe(g.id);
    un();
  });
  test('code invalide : erreur claire et annulation', async () => {
    const el = document.createElement('div'); document.body.append(el);
    const onCancel = jest.fn();
    mountImportScreen(el, { code: 'v1.@@', onDone: () => {}, onCancel });
    await attendre(() => el.querySelector('[data-role=import-error]'));
    expect(el.querySelector('[data-role=import-error]').textContent).toMatch(/illisible/);
    el.querySelector('[data-act=cancel]').click();
    expect(onCancel).toHaveBeenCalled();
  });
  test('masque « Ouvrir dans l’application » dans l’app', async () => {
    window.Capacitor = { isNativePlatform: () => true };
    try {
      const el = document.createElement('div');
      mountImportScreen(el, { code: await encodeGarden(jardin()), onDone() {}, onCancel() {} });
      await attendre(() => el.querySelector('[data-act=import]'));
      expect(el.querySelector('[data-act=open-app]')).toBeNull();
    } finally { delete window.Capacitor; }
  });
});
