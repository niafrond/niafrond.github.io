// Fenêtre « Exporter en PDF » : options (format du plan, niveaux, photos, vues isométriques, calques, mois de floraison),
// génération avec progression annulable, puis fenêtre « Fichier prêt » (enregistrer / partager).
import { h } from './draw-util.js';
import { openSaveDialog } from './save-file.js';
import { MONTHS } from '../render-common.js';
import { emitPdf } from '../pdf-ready.js';
import { setPdfCancel } from './pdf-ready.js';

const KEY = 'jardin-pdf-options';
const DEFAULTS = { format: 'a4', l1: true, l2: true, l3: true, zonePages: true, advice: true, shopping: true, photos: true, iso: false, layers: true, month: '' };
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } };
const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* facultatif */ } };

/** Options du dialogue → options de `buildGardenPdf`. */
export function toPdfOptions(o) {
  return { simplified: !!o.simplified, format: o.format === 'a3' ? 'a3' : 'a4', levels: { 1: !!o.l1, 2: !!o.l2, 3: !!o.l3 }, zonePages: !!o.zonePages, advice: !!o.advice, shopping: !!o.shopping, photos: !!o.photos, iso: !!o.iso, layers: !!o.layers, month: o.month ? Number(o.month) : null };
}

/**
 * Ouvre la fenêtre. `deps` (tests) : {build, rasterize, photo, openSave}. Renvoie {close, overlay}.
 */
export function openPdfDialog({ garden, appVersion = '', deps = {}, onDone } = {}) {
  const st = load();
  let ctrl = null; let closed = false; let bg = false; // bg : fenêtre quittée, la génération continue et prévient par notification
  const chk = (key, label, hint) => h('label', { class: 'pdf-opt', style: { display: 'flex', gap: '8px', alignItems: 'flex-start', minHeight: '32px' } },
    h('input', { type: 'checkbox', 'data-opt': key, checked: !!st[key], onchange: (e) => { st[key] = e.target.checked; } }), h('span', {}, label, hint ? h('small', { class: 'muted', style: { display: 'block' } }, hint) : null));
  const format = h('select', { 'data-opt': 'format', 'aria-label': 'Format du plan', onchange: (e) => { st.format = e.target.value; } }, h('option', { value: 'a4' }, 'A4 paysage'), h('option', { value: 'a3' }, 'A3 paysage'));
  format.value = st.format;
  const month = h('select', { 'data-opt': 'month', 'aria-label': 'Mois de référence de la floraison', onchange: (e) => { st.month = e.target.value; } }, h('option', { value: '' }, 'Pleine floraison'), MONTHS.map((m, i) => h('option', { value: String(i + 1) }, m)));
  month.value = String(st.month || '');
  const bar = h('progress', { max: '100', value: '0', 'data-role': 'pdf-progress', style: { width: '100%' } });
  const label = h('p', { role: 'status', 'aria-live': 'polite', class: 'muted small', 'data-role': 'pdf-status' }, '');
  const err = h('p', { class: 'notice', role: 'alert', hidden: true, 'data-role': 'pdf-error' });
  const diagBox = h('pre', { hidden: true, 'data-role': 'pdf-diag', style: { whiteSpace: 'pre-wrap', fontSize: '11px', maxHeight: '160px', overflow: 'auto', background: 'var(--card, #f4f4f0)', padding: '6px', borderRadius: '6px' } });
  const copyDiag = h('button', { class: 'btn', type: 'button', hidden: true, 'data-act': 'pdf-copy-diag', onclick: async () => { try { await navigator.clipboard.writeText(diagBox.textContent); copyDiag.textContent = 'Diagnostic copié'; } catch { const r = document.createRange(); r.selectNodeContents(diagBox); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); copyDiag.textContent = 'Sélectionné : copiez-le'; } } }, 'Copier le diagnostic');
  const retry = h('button', { class: 'btn', type: 'button', hidden: true, 'data-act': 'pdf-simple', onclick: () => run({ simplified: true }) }, 'Réessayer en mode simplifié');
  let lastStep = '';
  const form = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' }, 'data-role': 'pdf-form' },
    h('label', {}, 'Format du plan ', format),
    h('fieldset', { style: { border: '1px solid var(--line, #ccc)', borderRadius: '8px' } }, h('legend', {}, 'Niveaux du plan (cumulatifs)'),
      chk('l1', 'Niveau 1 : terrain et mobilier'), chk('l2', 'Niveau 2 : + zones'), chk('l3', 'Niveau 3 : + plantations')),
    chk('zonePages', 'Une fiche par zone'), chk('advice', 'Conseils de plantation, calendrier, entretien, arrosage'), chk('shopping', 'Listes de courses'),
    chk('layers', 'Plan complet à calques PDF', 'Calques activables dans Acrobat, Foxit… (ignorés par beaucoup de lecteurs mobiles)'),
    chk('photos', 'Inclure les photos des essences', 'Photos Wikipédia déjà en cache ou téléchargées ; sinon pastilles de couleur'),
    chk('iso', 'Inclure les vues isométriques'),
    h('label', {}, 'Floraison représentée ', month), err, diagBox, h('div', { class: 'row' }, copyDiag, retry));
  const go = h('button', { class: 'btn btn-primary', type: 'button', 'data-act': 'pdf-go', onclick: () => run() }, 'Générer le PDF');
  const cancel = h('button', { class: 'btn', type: 'button', 'data-act': 'pdf-cancel', onclick: () => { if (ctrl) { ctrl.abort(); label.textContent = 'Annulation…'; } else close(); } }, 'Annuler');
  const detach = h('button', { class: 'btn', type: 'button', 'data-act': 'pdf-background', onclick: () => goBackground() }, '🔔 Continuer en arrière-plan');
  const progress = h('div', { hidden: true, 'data-role': 'pdf-run' }, bar, label,
    h('p', { class: 'muted small' }, 'Ça peut être long : vous pouvez quitter cette fenêtre, une notification « Le PDF est prêt » vous préviendra, puis vous le téléchargerez en revenant dans l’app.'), detach);
  const close = () => { if (closed) return; closed = true; if (ctrl) ctrl.abort(); overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') cancel.click(); };
  const overlay = h('div', { class: 'overlay', 'data-role': 'pdf-dialog' },
    h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Exporter en PDF', style: { maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('h3', {}, '📄 Exporter en PDF'), h('p', { class: 'muted small' }, 'Un PDF complet, utilisable seul sur le terrain : plans en niveaux, fiches par zone, conseils et listes de courses. Tout est généré sur votre appareil, sans connexion.'),
      form, progress, h('div', { class: 'row end' }, cancel, go)));
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);

  /** Quitte la fenêtre sans interrompre la génération ; le bandeau global prend le relais. */
  function goBackground() {
    if (bg || closed || !ctrl) return;
    bg = true; overlay.remove(); document.removeEventListener('keydown', onKey);
    const c = ctrl; setPdfCancel(() => c.abort());
    emitPdf({ type: 'running', pct: Math.round(bar.value || 0), label: label.textContent });
  }

  /** Texte de diagnostic : étape, cause, taille du SVG, éléments, résolution, appareil, version. */
  function diagnose(e, version) {
    const d = (e && e.diag) || {};
    const lines = [
      `Erreur : ${(e && e.message) || e}`, `Étape : ${(e && e.step) || lastStep || 'inconnue'}`,
      d.causes && d.causes.length ? `Cause(s) : ${d.causes.join(' | ')}` : null,
      d.svgKb != null ? `SVG : ${d.svgKb} Ko, ${d.elements} éléments` : null, d.pxWidth ? `Résolution tentée : ${d.pxWidth}×${d.pxHeight} (échelles ${(d.scales || []).join(', ') || '1'})` : null,
      e && e.firstCause && e.firstCause.diag ? `Premier essai (plan complet) : ${(e.firstCause.diag.causes || []).join(' | ')} ; SVG ${e.firstCause.diag.svgKb} Ko` : null,
      `Options : ${JSON.stringify(toPdfOptions(st))}`, `Navigateur : ${navigator.userAgent}`, `Mémoire : ${navigator.deviceMemory || '?'} Go`, `Application : ${version || '?'}`,
    ];
    return lines.filter(Boolean).join('\n');
  }

  async function run(over = {}) {
    if (over.simplified) { Object.assign(st, { photos: false, iso: false, layers: false }); }
    const opts = toPdfOptions({ ...st, ...over });
    save(st);
    diagBox.hidden = true; copyDiag.hidden = true; retry.hidden = true; copyDiag.textContent = 'Copier le diagnostic';
    err.hidden = true; form.hidden = true; progress.hidden = false; go.disabled = true; cancel.textContent = 'Annuler la génération';
    ctrl = new AbortController();
    Promise.resolve().then(async () => (deps.ensurePermission || (await import('../notify.js')).ensurePermission)()).catch(() => {}); // permission demandée pendant le geste, sans bloquer
    try {
      const build = deps.build || (await import('../pdf-content.js')).buildGardenPdf;
      const rasterize = deps.rasterize || (await import('../pdf-raster.js')).rasterizeSVG;
      const photo = deps.photo !== undefined ? deps.photo : (await import('../pdf-raster.js')).loadPhotoThumb;
      let version = appVersion;
      if (!version) { try { version = (await import('../../version.js')).getVersion(); } catch { /* hors dépôt (APK) */ } }
      const res = await build(garden, opts, {
        rasterize, photo, signal: ctrl.signal, appVersion: version,
        onProgress: ({ label: l, step, total }) => { lastStep = l; label.textContent = l; bar.value = Math.round((step / Math.max(1, total)) * 100); if (bg) emitPdf({ type: 'progress', pct: bar.value, label: l }); },
      });
      if (closed) return;
      if (bg || document.hidden) { await finishInBackground(res); return; }
      const blob = new Blob([res.bytes], { type: 'application/pdf' });
      close();
      (deps.openSave || openSaveDialog)({ filename: res.filename, blob, mime: 'application/pdf', title: 'PDF du jardin prêt' });
      if (onDone) onDone(res);
    } catch (e) {
      if (closed) return;
      if (bg) { ctrl = null; setPdfCancel(null); if (e && e.name === 'AbortError') emitPdf({ type: 'cleared' }); else { console.error(e); emitPdf({ type: 'error', message: (e && e.message) || 'erreur' }); await notify('Jardin : PDF impossible', 'La génération du PDF a échoué. Rouvrez l’app pour réessayer.'); } return; }
      ctrl = null; go.disabled = false; cancel.textContent = 'Fermer'; progress.hidden = true; form.hidden = false;
      if (e && e.name === 'AbortError') { err.hidden = false; err.textContent = 'Génération annulée.'; }
      else {
        err.hidden = false; err.textContent = `Impossible de générer le PDF sur cet appareil (${(e && e.message) || 'erreur'}). Étape : ${(e && e.step) || lastStep || 'inconnue'}.`; console.error(e);
        let version = appVersion; if (!version) { try { version = (await import('../../version.js')).getVersion(); } catch { /* */ } }
        diagBox.textContent = diagnose(e, version); diagBox.hidden = false; copyDiag.hidden = false; retry.hidden = false;
      }
    }
  }
  async function notify(title, body) { try { return await (deps.notify || (await import('../notify.js')).notifyNow)({ title, body }); } catch { return false; } }
  /** Génération finie hors fenêtre : on garde le PDF, on prévient, et le bandeau propose le téléchargement. */
  async function finishInBackground(res) {
    ctrl = null; setPdfCancel(null);
    await (deps.saveReady || (await import('../pdf-ready.js')).saveReady)({ filename: res.filename, bytes: res.bytes, name: (garden && garden.name) || '' });
    emitPdf({ type: 'ready', filename: res.filename });
    await notify('Jardin : le PDF est prêt', 'Ouvrez l’app pour le télécharger.');
    if (!closed) { closed = true; overlay.remove(); document.removeEventListener('keydown', onKey); }
    if (onDone) onDone(res);
  }
  return { close, overlay, run, goBackground };
}
