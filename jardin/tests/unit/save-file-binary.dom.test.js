import { jest } from '@jest/globals';
import { openSaveDialog } from '../../ui/save-file.js';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; delete window.Capacitor; URL.createObjectURL = jest.fn(() => 'blob:x'); URL.revokeObjectURL = jest.fn(); });

describe('fenêtre Fichier prêt : fichiers binaires', () => {
  const blob = new Blob([new Uint8Array([37, 80, 68, 70, 45])], { type: 'application/pdf' });
  test('lien d\'enregistrement, taille, « Copier » masqué', () => {
    openSaveDialog({ filename: 'jardin-x-plan.pdf', blob, mime: 'application/pdf', title: 'PDF prêt' });
    const a = document.querySelector('[data-act=save-link]');
    expect(a.getAttribute('download')).toBe('jardin-x-plan.pdf'); expect(a.getAttribute('href')).toBe('blob:x');
    expect(document.querySelector('[data-act=save-copy]')).toBeNull();
    expect(document.querySelector('[data-role=save-status]').textContent).toContain('jardin-x-plan.pdf');
    expect(URL.createObjectURL.mock.calls[0][0]).toBe(blob);
  });
  test('texte : comportement inchangé (Copier présent)', () => {
    openSaveDialog({ filename: 'a.json', text: '{}' });
    expect(document.querySelector('[data-act=save-copy]')).not.toBeNull();
  });
  test('partage web avec le fichier', async () => {
    navigator.canShare = () => true; navigator.share = jest.fn(async () => {});
    openSaveDialog({ filename: 'p.pdf', blob, mime: 'application/pdf' });
    document.querySelector('[data-act=save-share]').click(); await tick();
    const arg = navigator.share.mock.calls[0][0];
    expect(arg.files[0].name).toBe('p.pdf'); expect(arg.files[0].type).toBe('application/pdf');
  });
  test('Capacitor : Filesystem.writeFile en base64 dans le cache puis Share', async () => {
    const writeFile = jest.fn(async () => ({ uri: 'file:///cache/p.pdf' })); const share = jest.fn(async () => {});
    window.Capacitor = { Plugins: { Filesystem: { writeFile }, Share: { share } } };
    if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function () { return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsArrayBuffer(this); }); };
    openSaveDialog({ filename: 'p.pdf', blob, mime: 'application/pdf' });
    await tick(30);
    expect(writeFile).toHaveBeenCalledWith({ path: 'p.pdf', data: btoa('%PDF-'), directory: 'CACHE' });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///cache/p.pdf' }));
  });
});
