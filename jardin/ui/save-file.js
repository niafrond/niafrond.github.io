// Enregistrer / partager un fichier de façon fiable sur téléphone : ouvre une fenêtre avec un VRAI lien
// « Enregistrer » à toucher (les téléchargements déclenchés par script sont souvent ignorés sur mobile),
// « Partager… » (feuille de partage Android) et « Copier le contenu » ; dans l'app Android (Capacitor),
// le fichier est écrit dans le cache puis partagé via les plugins Filesystem et Share.
import { h } from './draw-util.js';

const cap = () => (typeof window !== 'undefined' && window.Capacitor) || null;
const plugin = (name) => { const c = cap(); return c && c.Plugins && c.Plugins[name] ? c.Plugins[name] : null; };

/** Nom de fichier sûr : `jardin-Mon_jardin.json`. */
export function safeFilename(name, ext = 'json') {
  const base = String(name || 'jardin').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'jardin';
  return `jardin-${base}.${ext}`;
}

/** Partage natif (Capacitor) : écrit le fichier dans le cache puis ouvre la feuille de partage. Renvoie true si fait. */
export async function shareNative(filename, text) {
  const FS = plugin('Filesystem'); const SH = plugin('Share');
  if (!FS || !SH) return false;
  try {
    const written = await FS.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8' });
    await SH.share({ title: filename, text: filename, url: written.uri, dialogTitle: 'Enregistrer ou envoyer le jardin' });
    return true;
  } catch (e) {
    if (e && /cancel|dismiss/i.test(String(e.message || e))) return true;
    return false;
  }
}

/** Feuille de partage du navigateur avec le fichier (Android Chrome). Renvoie true si le partage a eu lieu ou a été annulé. */
export async function shareWeb(filename, text, mime = 'application/json') {
  try {
    if (typeof navigator === 'undefined' || !navigator.share || typeof File === 'undefined') return false;
    const file = new File([text], filename, { type: mime });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch (e) {
    return !!(e && e.name === 'AbortError');
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* repli */ }
  try {
    const ta = h('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', opacity: '0' } }, text);
    document.body.append(ta); ta.select(); const ok = document.execCommand && document.execCommand('copy'); ta.remove(); return !!ok;
  } catch { return false; }
}

/**
 * Ouvre la fenêtre d'enregistrement du fichier. `text` = contenu. Renvoie `{close}`.
 * Sur l'app Android : le partage natif est lancé directement (puis la fenêtre reste en secours).
 */
export function openSaveDialog({ filename, text, mime = 'application/json', title = 'Fichier prêt', onDone } = {}) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const status = h('p', { class: 'muted small', role: 'status', 'data-role': 'save-status' }, `${filename} · ${Math.max(1, Math.round(text.length / 1024))} Ko`);
  const done = (msg) => { status.textContent = msg; if (onDone) onDone(msg); };
  const link = h('a', { class: 'btn btn-primary btn-block', href: url, download: filename, 'data-act': 'save-link', onclick: () => done('Si rien ne se passe, utilisez « Partager… » ou « Copier le contenu ». Le fichier se trouve ensuite dans le dossier Téléchargements.') }, '💾 Enregistrer le fichier');
  const share = h('button', { class: 'btn btn-block', type: 'button', 'data-act': 'save-share', onclick: async () => {
    const ok = (await shareNative(filename, text)) || (await shareWeb(filename, text, mime));
    done(ok ? 'Partage ouvert.' : 'Le partage n’est pas disponible ici : utilisez « Enregistrer le fichier » ou « Copier le contenu ».');
  } }, '📤 Partager…');
  const copy = h('button', { class: 'btn btn-block', type: 'button', 'data-act': 'save-copy', onclick: async () => {
    done((await copyText(text)) ? 'Contenu copié : collez-le dans un fichier ou un message pour vous l’envoyer.' : 'Copie impossible : utilisez « Enregistrer le fichier ».');
  } }, '📋 Copier le contenu');
  const close = () => { overlay.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = h('div', { class: 'overlay', 'data-role': 'save-dialog', onclick: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('h3', null, title), status, link, share, copy,
      h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', 'data-act': 'save-close', onclick: close }, 'Fermer'))));
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  // App Android : feuille de partage native directement (les liens blob ne se téléchargent pas dans la webview).
  if (plugin('Filesystem') && plugin('Share')) shareNative(filename, text).then((ok) => { if (ok) done('Partage ouvert.'); });
  return { close, overlay };
}
