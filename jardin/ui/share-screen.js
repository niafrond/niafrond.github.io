// « Continuer sur mon téléphone » : lien, QR code ou fichier pour reprendre un jardin sur un autre appareil.
import { h, toast } from './wizard.js';
import { storage } from '../storage.js';
import { encodeGarden, buildShareLink, buildAppLink, sizeInfo } from '../transfer.js';
import { qrSvg } from '../qr.js';
import { openSaveDialog, safeFilename } from './save-file.js';

/** Adresse publique de l'application (modifiable avec setPublicUrl). */
export let PUBLIC_URL = 'https://niafrond.github.io/jardin/';
export function setPublicUrl(u) { PUBLIC_URL = u; }

/** Base du lien : l'adresse publique hors ligne/local/app/artefact, sinon l'adresse courante. */
export function shareBase(loc = globalThis.location, cap = globalThis.Capacitor) {
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const host = (loc && loc.hostname) || '';
  const local = !loc || loc.protocol === 'file:' || native || !host || /^(localhost|127\.|\[?::1)/.test(host) || /claude|anthropic/i.test(host);
  if (local) return PUBLIC_URL;
  return loc.origin + loc.pathname.replace(/index\.html$/, '');
}

function copyText(text, field) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try { field.focus(); field.select(); field.setSelectionRange(0, text.length); document.execCommand('copy') ? resolve() : reject(new Error('copy')); } catch (e) { reject(e); }
  });
}

/** mountShareScreen(el, {garden, onBack}) → unmount() */
export function mountShareScreen(el, { garden, onBack }) {
  let dead = false;
  const body = h('div', { class: 'share-body' }, h('p', { class: 'muted' }, 'Préparation du lien…'));
  el.replaceChildren(h('main', { class: 'share' },
    h('div', { class: 'row' },
      onBack ? h('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'back', onclick: () => onBack() }, '← Retour') : null,
      h('h2', { class: 'grow' }, 'Continuer sur mon téléphone')),
    h('p', { class: 'muted' }, `Envoyez « ${garden.name || 'votre jardin'} » vers votre téléphone : tout reste entre vos appareils, rien n’est stocké en ligne.`),
    body));

  (async () => {
    let code;
    try { code = await encodeGarden(garden); } catch (e) { body.replaceChildren(h('p', { class: 'notice', role: 'alert' }, 'Impossible de préparer le transfert : ' + (e && e.message ? e.message : 'erreur inconnue'))); return; }
    if (dead) return;
    const link = buildShareLink(code, shareBase());
    const info = sizeInfo(code);
    const field = h('input', { type: 'text', readonly: true, value: link, id: 'share-link', 'aria-label': 'Lien de transfert', onfocus: (e) => e.target.select() });
    const actions = h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', 'data-act': 'copy', onclick: async () => {
        try { await copyText(link, field); toast('Lien copié.'); } catch { field.focus(); field.select(); toast('Sélectionné : copiez-le avec Ctrl+C.'); }
      } }, '📋 Copier'),
      typeof navigator.share === 'function' ? h('button', { class: 'btn', type: 'button', 'data-act': 'share', onclick: () => navigator.share({ title: 'Mon jardin', text: `Mon jardin : ${garden.name || ''}`, url: link }).catch(() => {}) }, '📤 Partager') : null);
    const svg = info.fitsQr ? qrSvg(link, { size: 280 }) : null;
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    const native = !!(globalThis.Capacitor && globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform());
    body.replaceChildren(
      h('section', { class: 'share-way', 'data-way': 'link' },
        h('h3', null, '1. Le lien'),
        h('p', { class: 'muted' }, 'Envoyez-le vous-même (messagerie, courriel…), puis ouvrez-le sur le téléphone.'),
        field, actions,
        h('p', { class: 'notice warn' }, '⚠️ Le lien contient votre jardin : ne le partagez qu’avec vous-même.'),
        info.length > 6000 ? h('p', { class: 'notice', 'data-role': 'long-link' }, `Ce lien est long (${Math.round(info.length / 1024)} Ko) : certaines messageries le coupent. Copiez-le puis collez-le dans une note ou un courriel, ou utilisez le fichier (3).`) : null,
        isAndroid && !native ? h('a', { class: 'btn', 'data-act': 'open-app', href: `intent://import/${code}#Intent;scheme=jardin;package=io.github.niafrond.jardin;end` }, 'Ouvrir dans l’application') : null),
      h('section', { class: 'share-way', 'data-way': 'qr' },
        h('h3', null, '2. Le QR code'),
        svg
          ? [h('p', { class: 'muted' }, 'Scannez-le avec l’appareil photo du téléphone.'), h('div', { class: 'qr-box', html: svg })]
          : h('p', { class: 'notice', 'data-role': 'qr-too-long' }, 'Ce jardin est trop détaillé pour tenir dans un QR code : utilisez le lien ou le fichier.')),
      h('section', { class: 'share-way', 'data-way': 'file' },
        h('h3', null, '3. Le fichier'),
        h('p', { class: 'muted' }, 'Téléchargez le fichier, copiez-le sur le téléphone, puis utilisez « Importer (JSON) » sur l’accueil.'),
        h('button', { class: 'btn', type: 'button', 'data-act': 'download', onclick: async () => {
          openSaveDialog({ filename: safeFilename(garden.name), text: await storage.exportGarden(garden), title: 'Fichier du jardin' });
        } }, '💾 Télécharger le fichier')));
  })();

  return () => { dead = true; el.replaceChildren(); };
}
