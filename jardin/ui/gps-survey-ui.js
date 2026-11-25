// Mode « relevé GPS guidé » du contour : panneaux plein écran (consignes, précision, gros bouton, annuler/terminer,
// vérification avant validation), couches SVG (points, côtés, trace, position, segment en cours) et reprise du brouillon.
// La logique de mesure est dans ../gps-survey.js ; le suivi de position dans ../geo.js.
import { h, fr, frArea } from './draw-util.js';
import { watchFix } from '../geo.js';
import { bounds, isSimplePolygon, signedArea } from '../geometry.js';
import { createSurvey, QUALITY_LABEL, CAPTURE_MS, CLOSE_RADIUS } from '../gps-survey.js';

const NS = 'vector-effect="non-scaling-stroke"';
const QCOL = { good: '#2e7d32', medium: '#ef6c00', weak: '#c62828', none: '#757575' };
const MIN_FRAME = 14; // m : étendue minimale du cadrage automatique
const FINISH_NEAR = 6; // m : « Terminer » propose de mesurer l'écart de fermeture si on est à moins de…

const STEPS = [
  'Placez-vous sur le 1er angle du terrain.',
  'Attendez que la précision passe au vert.',
  'Touchez « Mettre un point ici » et restez immobile quelques secondes.',
  'Marchez jusqu’à l’angle suivant et recommencez.',
  'Après le dernier angle, touchez « Terminer ».',
];

function beep() {
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(); const o = ctx.createOscillator(); const gn = ctx.createGain();
    o.frequency.value = 880; gn.gain.value = 0.08; o.connect(gn); gn.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.09);
    setTimeout(() => { try { ctx.close(); } catch { /* ignoré */ } }, 300);
  } catch { /* pas de son */ }
}
function buzz() { try { if (globalThis.navigator?.vibrate) globalThis.navigator.vibrate(60); } catch { /* ignoré */ } }

const padBounds = (pts, min = MIN_FRAME) => {
  const b = bounds(pts);
  const cx = b.minX + b.width / 2; const cy = b.minY + b.height / 2;
  const w = Math.max(b.width, min); const hh = Math.max(b.height, min);
  return { minX: cx - w / 2, minY: cy - hh / 2, maxX: cx + w / 2, maxY: cy + hh / 2, width: w, height: hh };
};

/**
 * @param {object} o
 * @param {HTMLElement} o.root     racine de l'éditeur (passe en plein écran pendant le relevé)
 * @param {HTMLElement} o.wrap     conteneur du plan
 * @param {object} o.cv            canvas de l'éditeur (view, fit, apply, px)
 * @param {object} o.garden        jardin (context.gpsSurveyDraft, context.gpsOrigin)
 * @param {Function} o.persist     enregistre le jardin (brouillon)
 * @param {Function} o.redraw      redessine le plan
 * @param {Function} o.onApply     ({points, origin, stats}) : le contour est validé
 * @param {Function} [o.onManual]  repli « saisir les côtés à la main »
 * @param {Function} [o.onExit]    sortie du mode (validé ou non)
 * @param {object} [o.options]     {captureMs}
 */
export function createSurveyUI({ root, wrap, cv, garden: g, persist, redraw, onApply, onManual, onExit, options = {} }) {
  const S = {
    active: false, survey: null, stopWatch: null, follow: true, capturing: null, phase: 'walk', err: null,
    rv: { square: false, distribute: false }, msg: '', msgKind: '', selfMove: false, tick: null, lastFrame: 0,
  };
  const captureMs = () => options.captureMs ?? globalThis.__JARDIN_GPS?.captureMs ?? CAPTURE_MS;
  const btn = (label, act, onclick, cls = '', extra = {}) => h('button', { type: 'button', class: `jd-btn ${cls}`, 'data-act': act, onclick, ...extra }, label);

  // ---------- DOM ----------
  const elCount = h('span', { class: 'jd-scount', 'data-role': 'survey-count' });
  const elPill = h('span', { class: 'jd-gpill q-none', 'data-role': 'gps-pill', role: 'status', 'aria-live': 'polite' });
  const elDist = h('span', { class: 'jd-sdist', 'data-role': 'gps-dist' });
  const elInstr = h('div', { class: 'jd-sinstr', 'data-role': 'survey-instr', 'aria-live': 'polite' });
  const head = h('div', { class: 'jd-shead', hidden: true, 'data-role': 'survey-head' },
    h('div', { class: 'jd-shead-row' }, h('b', { class: 'jd-stitle' }, '📍 Relevé GPS'), elCount,
      btn('✕ Quitter', 'survey-quit', () => quit(), 'jd-sq')),
    h('div', { class: 'jd-shead-row' }, elPill, elDist),
    elInstr);

  const stepsEl = h('ol', { class: 'jd-ssteps' }, STEPS.map((t, i) => h('li', { 'data-step': i + 1 }, t)));
  const errEl = h('div', { class: 'jd-serr', hidden: true, 'data-role': 'survey-error' });
  const guide = h('div', { class: 'jd-sguide', hidden: true, 'data-role': 'survey-guide' }, stepsEl, errEl);

  const elMsg = h('div', { class: 'jd-smsg', 'data-role': 'survey-msg', 'aria-live': 'polite' });
  const elProg = h('i', {});
  const elBigT = h('span', { class: 'jd-sbig-t' }, '📍 Mettre un point ici');
  const bBig = h('button', { type: 'button', class: 'jd-sbig', 'data-act': 'survey-point', onclick: () => press(false) },
    h('span', { class: 'jd-sprog', 'data-role': 'gps-progress' }, elProg), elBigT);
  const bForce = h('button', { type: 'button', class: 'jd-slink', 'data-act': 'survey-force', hidden: true, onclick: () => press(true) }, 'Poser quand même');
  const bUndo = btn('↶ Annuler le dernier point', 'survey-undo', () => undoPoint());
  const bFinish = btn('✔ Terminer', 'survey-finish', () => finish(), 'primary');
  const bFollow = btn('🎯', 'survey-follow', () => toggleFollow(), '', { 'aria-pressed': 'true' });
  const walk = h('div', { class: 'jd-swalk', 'data-role': 'survey-walk' },
    elMsg, bBig, bForce, h('div', { class: 'jd-srow' }, bUndo, bFinish, bFollow));
  const review = h('div', { class: 'jd-sreview', hidden: true, 'data-role': 'survey-review' });
  const foot = h('div', { class: 'jd-sfoot', hidden: true, 'data-role': 'survey-foot' }, walk, review);
  const dlg = h('div', { class: 'jd-sdlg', hidden: true, 'data-role': 'survey-dialog', role: 'alertdialog', 'aria-modal': 'true' });

  root.insertBefore(head, wrap);
  root.insertBefore(foot, wrap.nextSibling);
  wrap.append(guide);
  root.append(dlg);

  // ---------- utilitaires ----------
  const self = (fn) => { S.selfMove = true; try { fn(); } finally { S.selfMove = false; S.lastView = { cx: cv.view.cx, cy: cv.view.cy, mpp: cv.view.mpp }; } };
  const say = (msg, kind = '') => { S.msg = msg; S.msgKind = kind; S.msgUntil = Date.now() + 7000; showMsg(msg, kind); };
  const showMsg = (msg, kind = '') => { if (elMsg.textContent !== msg) elMsg.textContent = msg; elMsg.className = `jd-smsg ${kind}`; };

  function ask(text, buttons) {
    dlg.innerHTML = '';
    dlg.hidden = false;
    const close = () => { dlg.hidden = true; dlg.innerHTML = ''; };
    dlg.append(h('div', { class: 'jd-sdlg-box' },
      h('div', { class: 'jd-sdlg-text', 'data-role': 'dialog-text' }, text),
      ...buttons.map((b, i) => btn(b.label, b.act || `ask-${i}`, () => { close(); if (b.fn) b.fn(); }, b.cls || (i === 0 ? 'primary' : '')))));
  }
  const closeAsk = () => { dlg.hidden = true; dlg.innerHTML = ''; };

  const toLocal = (fix) => (fix ? S.survey.currentLocal() : null);

  // ---------- cadrage ----------
  function frame(force = false) {
    if (!S.active || !cv) return;
    const now = Date.now();
    if (!force && now - S.lastFrame < 350) return;
    S.lastFrame = now;
    const pts = S.survey.points.map((p) => ({ x: p.x, y: p.y }));
    const me = toLocal(S.survey.current);
    if (me) pts.push(me);
    if (!pts.length) pts.push({ x: 0, y: 0 });
    self(() => cv.fit(padBounds(pts), 1.25));
  }
  function frameShape() {
    const res = reviewResult();
    const pts = res && res.points.length ? res.points : S.survey.points;
    if (pts.length) self(() => cv.fit(padBounds(pts, 6), 1.35));
  }
  function toggleFollow() {
    S.follow = !S.follow;
    if (S.follow) frame(true); else frameShape();
    render();
  }

  // ---------- suivi de position ----------
  function startWatch() {
    if (S.stopWatch) S.stopWatch();
    S.err = null;
    S.stopWatch = watchFix((fix) => {
      if (!S.active) return;
      S.err = null;
      S.survey.feed(fix);
      render(true);
      if (S.follow && S.phase === 'walk') frame();
      redraw();
    }, { onError: (e) => { if (!S.active) return; S.err = e; render(); } });
  }
  const onVisible = () => { if (S.active && globalThis.document?.visibilityState === 'visible') startWatch(); };

  // ---------- actions ----------
  const persistDraft = () => {
    g.context = g.context || {};
    if (S.survey.points.length) g.context.gpsSurveyDraft = S.survey.toDraft();
    else delete g.context.gpsSurveyDraft;
    persist();
  };

  function press(force) {
    if (!S.active || S.capturing || S.phase !== 'walk') return;
    const st = S.survey.status();
    if (!force && !st.canCapture) return;
    if (force && !st.canCapture) {
      if (!S.survey.current) return;
      ask(`Le signal est faible (${st.accuracy != null ? `±${fr(st.accuracy, 1)} m` : 'précision inconnue'}) : le point risque d’être décalé de plusieurs mètres. Poser quand même ?`, [
        { label: 'Poser quand même', act: 'ask-force', fn: () => beginCapture({ force: true }) },
        { label: 'Attendre un meilleur signal', act: 'ask-wait' },
      ]);
      return;
    }
    if (S.survey.points.length >= 3) {
      const ns = S.survey.nearStart();
      if (ns.near) {
        ask(`Vous êtes à ${fr(ns.distance, 1)} m du 1er point : fermer le tour ?`, [
          { label: 'Fermer le tour', act: 'ask-close', fn: () => beginCapture({ force, asClosing: true }) },
          { label: 'Poser un point ici', act: 'ask-point', fn: () => beginCapture({ force }) },
          { label: 'Annuler', act: 'ask-cancel' },
        ]);
        return;
      }
    }
    beginCapture({ force });
  }

  function beginCapture({ force = false, asClosing = false }) {
    S.capturing = { t0: Date.now(), force, asClosing };
    say('Mesure en cours : restez immobile…');
    if (S.tick2) clearInterval(S.tick2);
    S.tick2 = setInterval(() => {
      if (!S.capturing) return;
      if (Date.now() - S.capturing.t0 >= captureMs()) completeCapture(); else render(true);
    }, 100);
    render(true);
  }

  function accept(fixes, c, force) {
    const res = S.survey.capturePoint(fixes, { force, asClosing: c.asClosing });
    if (res.ok) {
      buzz(); beep();
      if (res.closing) { say(`Retour au départ mesuré (±${fr(res.point.accuracy, 1)} m).`); persistDraft(); enterReview(); return; }
      persistDraft();
      const w = res.warn.includes('weak') ? ' Précision faible : vérifiez ce côté plus tard.' : '';
      say(`Point ${res.index + 1} posé (±${fr(res.point.accuracy, 1)} m).${w}`, w ? 'warn' : '');
    } else if (res.reason === 'too-close') {
      ask(`Vous êtes à ${fr(res.distance, 1)} m du point précédent : vous n’avez presque pas bougé. Poser quand même ?`, [
        { label: 'Poser quand même', act: 'ask-force', fn: () => { accept(fixes, c, true); render(); redraw(); } },
        { label: 'Je marche jusqu’au prochain angle', act: 'ask-cancel' },
      ]);
      say('Point trop proche du précédent : avancez jusqu’à l’angle suivant.', 'warn');
    } else if (res.reason === 'weak') say('Signal trop faible : attendez que la précision s’améliore.', 'warn');
    else say('Aucune position reçue : réessayez dans quelques secondes.', 'err');
  }

  function completeCapture() {
    const c = S.capturing;
    clearInterval(S.tick2); S.tick2 = null; S.capturing = null;
    if (!c || !S.active) return;
    const ms = Date.now() - c.t0 + 50;
    accept(S.survey.recentFixes(ms), c, c.force);
    render(); redraw();
    if (S.follow && S.phase === 'walk') frame(true);
  }

  function undoPoint() {
    if (S.capturing || !S.active) return;
    if (S.phase === 'review') return;
    if (!S.survey.undo()) return;
    persistDraft();
    say(S.survey.points.length ? `Dernier point annulé : il reste ${S.survey.points.length} point${S.survey.points.length > 1 ? 's' : ''}.` : 'Relevé vide : recommencez au 1er angle.');
    render(); redraw();
    if (S.follow) frame(true);
  }

  function finish() {
    if (!S.active || S.capturing || S.survey.points.length < 3) return;
    const ns = S.survey.nearStart(undefined, FINISH_NEAR);
    if (!S.survey.closing && ns.near && S.survey.status().canCapture) {
      ask(`Vous êtes à ${fr(ns.distance, 1)} m du 1er point : fermer le tour ? La mesure sert à calculer l’écart de fermeture.`, [
        { label: 'Fermer le tour ici', act: 'ask-close', fn: () => beginCapture({ asClosing: true }) },
        { label: 'Terminer sans fermer', act: 'ask-skip', fn: () => enterReview() },
        { label: 'Continuer', act: 'ask-cancel' },
      ]);
      return;
    }
    enterReview();
  }

  // ---------- vérification avant validation ----------
  const reviewOpts = () => ({ square: S.rv.square, distribute: S.rv.distribute && !!S.survey.closing });
  function reviewResult() { return S.phase === 'review' ? S.survey.result(reviewOpts()) : null; }

  function enterReview() {
    S.phase = 'review';
    S.rv = { square: false, distribute: !!S.survey.closing };
    S.follow = false;
    renderReview();
    render();
    frameShape();
    redraw();
  }
  function backToWalk() {
    S.survey.clearClosing();
    S.phase = 'walk'; S.follow = true;
    persistDraft();
    render(); frame(true); redraw();
  }
  function renderReview() {
    const raw = S.survey.result({});
    const cur = S.survey.result(reviewOpts());
    const sq = S.survey.result({ ...reviewOpts(), square: true });
    review.innerHTML = '';
    const unc = cur.uncertainty >= 0.05 ? ` ±${fr(cur.uncertainty, cur.uncertainty >= 10 ? 0 : 1)} m²` : '';
    review.append(
      h('div', { class: 'jd-rtitle' }, 'Vérifiez le contour'),
      h('div', { class: 'jd-rstats', 'data-role': 'survey-stats' },
        h('span', {}, 'Surface ', h('b', { 'data-role': 'sv-area' }, frArea(cur.area)), unc),
        h('span', {}, 'Périmètre ', h('b', { 'data-role': 'sv-perimeter' }, `${fr(cur.perimeter, 1)} m`)),
        S.survey.closing ? h('span', {}, 'Écart de fermeture ', h('b', { 'data-role': 'sv-gap' }, `${fr(raw.closureGap ?? 0, 2)} m`)) : null,
        h('span', {}, `${S.survey.points.length} points`)),
      ...(cur.simple ? [] : [h('div', { class: 'jd-smsg err', 'data-role': 'survey-cross' }, '⚠ Le contour se croise : reprenez le relevé et annulez le dernier point, ou validez puis corrigez un sommet.')]));
    if (S.survey.closing && raw.closureGap > 0.005) {
      review.append(btn(`${S.rv.distribute ? '☑' : '☐'} Répartir l’écart de fermeture (${fr(raw.closureGap, 2)} m)`, 'rv-gap', () => { S.rv.distribute = !S.rv.distribute; renderReview(); redraw(); }, 'jd-rtoggle', { 'aria-pressed': String(S.rv.distribute) }));
    }
    review.append(sq.squared > 0
      ? btn(`${S.rv.square ? '☑' : '☐'} Redresser les angles droits (${sq.squared}) : ${frArea(S.rv.square ? raw.area : cur.area)} → ${frArea(sq.area)}`, 'rv-square', () => { S.rv.square = !S.rv.square; renderReview(); redraw(); }, 'jd-rtoggle', { 'aria-pressed': String(S.rv.square) })
      : h('div', { class: 'jd-rhint' }, 'Aucun angle proche de 90° à redresser.'));
    review.append(
      h('div', { class: 'jd-rhint' }, S.rv.square || S.rv.distribute ? 'En pointillé : relevé brut. En vert : contour proposé.' : 'Les côtés restent modifiables ensuite (cote en cm).'),
      h('div', { class: 'jd-srow' },
        btn('← Reprendre le relevé', 'rv-back', () => backToWalk()),
        btn(cur.simple ? '✔ Valider le contour' : '✔ Valider quand même', 'rv-ok', () => validate(), 'primary')));
  }
  function validate() {
    const res = S.survey.close(reviewOpts());
    if (!res) return;
    deactivate();
    onApply({ points: res.points.map((p) => ({ x: p.x, y: p.y })), origin: res.origin, stats: res });
  }

  // ---------- sortie ----------
  function quit() {
    if (!S.active) return;
    if (S.survey.points.length) {
      ask(`Quitter le relevé ? Vos ${S.survey.points.length} point${S.survey.points.length > 1 ? 's sont conservés' : ' est conservé'} : vous pourrez le reprendre.`, [
        { label: 'Garder le brouillon et quitter', act: 'ask-keep', fn: () => { persistDraft(); deactivate(); } },
        { label: 'Abandonner le relevé', act: 'ask-abandon', cls: 'danger', fn: () => { delete g.context.gpsSurveyDraft; persist(); deactivate(); } },
        { label: 'Continuer', act: 'ask-cancel' },
      ]);
    } else { delete g.context.gpsSurveyDraft; persist(); deactivate(); }
  }
  function deactivate() {
    const was = S.active;
    S.active = false;
    if (S.stopWatch) { S.stopWatch(); S.stopWatch = null; }
    if (S.tick) { clearInterval(S.tick); S.tick = null; }
    if (S.tick2) { clearInterval(S.tick2); S.tick2 = null; }
    S.capturing = null;
    try { globalThis.document?.removeEventListener('visibilitychange', onVisible); } catch { /* ignoré */ }
    closeAsk();
    head.hidden = true; foot.hidden = true; guide.hidden = true;
    root.classList.remove('jd-survey-on');
    self(() => cv.apply());
    redraw();
    if (was && onExit) onExit();
  }

  // ---------- affichage ----------
  function render(light = false) {
    if (!S.active) return;
    const sv = S.survey; const n = sv.points.length;
    const st = sv.status();
    const q = S.err ? 'none' : st.quality;
    elPill.className = `jd-gpill q-${q}`;
    elPill.textContent = S.err ? '● GPS indisponible'
      : q === 'none' ? (sv.current ? '● Signal ancien : patientez' : '● Recherche du signal…')
        : `● ±${fr(st.accuracy, 1)} m · ${QUALITY_LABEL[q]}`;
    elCount.textContent = n ? `${n} point${n > 1 ? 's' : ''}` : 'Aucun point';
    const d = sv.distanceToLast();
    elDist.textContent = d != null && S.phase === 'walk' ? `${fr(d, 1)} m depuis le point ${n}` : '';

    const ns = n >= 3 ? sv.nearStart() : { near: false };
    let instr;
    if (S.phase === 'review') instr = 'Vérifiez le contour puis validez.';
    else if (ns.near) instr = `Vous êtes à ${fr(ns.distance, 1)} m du 1er point : touchez « Mettre un point ici » pour fermer le tour.`;
    else if (!n) instr = st.canCapture ? '1er angle : restez immobile puis touchez « Mettre un point ici ».' : 'Placez-vous sur le 1er angle du terrain et attendez que la précision passe au vert.';
    else instr = `Marchez jusqu’à l’angle ${n + 1}, puis touchez « Mettre un point ici ».`;
    elInstr.textContent = instr;
    stepsEl.querySelectorAll('li').forEach((li) => {
      const k = Number(li.dataset.step);
      const cur = !n ? (st.canCapture ? 3 : (sv.current ? 2 : 1)) : 4;
      li.className = k < cur ? 'done' : k === cur ? 'now' : '';
    });
    guide.hidden = !(S.phase === 'walk' && (n === 0 || S.err));
    stepsEl.hidden = !!S.err;
    errEl.hidden = !S.err;
    if (S.err && errEl.dataset.code !== S.err.code) {
      errEl.dataset.code = S.err.code;
      errEl.innerHTML = '';
      errEl.append(
        h('div', { class: 'jd-serr-t' }, S.err.message),
        h('div', { class: 'jd-srow' },
          btn('↻ Réessayer', 'survey-retry', () => { errEl.dataset.code = ''; startWatch(); render(); }, 'primary'),
          btn('✏️ Saisir les côtés à la main', 'survey-manual', () => { const keep = S.survey.points.length; if (!keep) { delete g.context.gpsSurveyDraft; persist(); } deactivate(); if (onManual) onManual(); })));
    }
    if (!S.err) errEl.dataset.code = '';

    const capturing = !!S.capturing;
    bBig.disabled = !st.canCapture || capturing || S.phase !== 'walk';
    bBig.classList.toggle('is-weak', !st.canCapture);
    bBig.classList.toggle('is-capturing', capturing);
    if (capturing) {
      const left = Math.max(0, Math.ceil((captureMs() - (Date.now() - S.capturing.t0)) / 1000));
      elProg.style.width = `${Math.min(100, ((Date.now() - S.capturing.t0) / captureMs()) * 100)}%`;
      elBigT.textContent = `⏳ Mesure… ${left} s · restez immobile`;
    } else {
      elProg.style.width = '0%';
      elBigT.textContent = ns.near ? '📍 Fermer le tour ici' : '📍 Mettre un point ici';
    }
    bForce.hidden = st.canCapture || capturing || !sv.current || S.phase !== 'walk';
    bUndo.disabled = capturing || (!n && !sv.closing);
    bFinish.disabled = capturing || n < 3;
    bFollow.setAttribute('aria-pressed', String(S.follow));
    bFollow.textContent = S.follow ? '🎯 Je suis' : '🎯 Recentrer';
    bFollow.hidden = S.phase !== 'walk';
    walk.hidden = S.phase !== 'walk';
    review.hidden = S.phase !== 'review';

    let auto = ''; let autoKind = '';
    if (S.phase === 'walk' && !capturing) {
      if (n >= 4 && !isSimplePolygon(sv.points.map((p) => ({ x: p.x, y: p.y })))) { auto = '⚠ Le contour se croise : annulez le dernier point ou reprenez l’angle.'; autoKind = 'err'; }
      else if (!st.canCapture && sv.current && q === 'weak') { auto = `Signal faible (±${fr(st.accuracy, 1)} m) : attendez ou sortez à découvert.`; autoKind = 'warn'; }
    }
    if (capturing || Date.now() < (S.msgUntil || 0)) showMsg(S.msg, S.msgKind); else showMsg(auto, autoKind);
    void light;
  }

  // ---------- couches SVG ----------
  function label(a, b, fs, fill = '#0d47a1', sign = 1) {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 1e-6) return '';
    const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
    const dx = b.x - a.x; const dy = b.y - a.y;
    const nx = (dy / L) * sign; const ny = (-dx / L) * sign;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
    const off = fs * 1.15;
    return `<text transform="translate(${mx + nx * off} ${my + ny * off}) rotate(${ang})" font-size="${fs}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" stroke="var(--jd-canvas,#fff)" stroke-width="${fs * 0.28}" paint-order="stroke" font-weight="600">${fr(L, 1)} m</text>`;
  }
  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  function svg() {
    if (!S.active) return null;
    const sv = S.survey; const fs = cv.px(13); const hr = cv.px(12);
    const pts = sv.points.map((p) => ({ x: p.x, y: p.y, accuracy: p.accuracy }));
    const n = pts.length;
    let main = ''; let top = '';
    const res = S.phase === 'review' ? reviewResult() : null;
    if (res) {
      const changed = S.rv.square || S.rv.distribute;
      if (changed) main += `<polygon points="${poly(pts)}" fill="none" stroke="#757575" stroke-width="2" stroke-dasharray="6 5" ${NS}/>`;
      main += `<polygon points="${poly(res.points)}" fill="var(--jd-accent,#2e7d32)" fill-opacity=".16" stroke="var(--jd-accent,#2e7d32)" stroke-width="3" stroke-linejoin="round" ${NS}/>`;
      const sgn = Math.sign(signedArea(res.points)) || 1;
      res.points.forEach((p, i) => { main += label(p, res.points[(i + 1) % res.points.length], fs, '#0d47a1', sgn); });
      res.points.forEach((p, i) => {
        main += `<circle cx="${p.x}" cy="${p.y}" r="${hr}" fill="#fff" stroke="#2e7d32" stroke-width="2.5" ${NS}/><text x="${p.x}" y="${p.y}" font-size="${cv.px(11)}" text-anchor="middle" dominant-baseline="central" fill="#2e7d32" font-weight="700">${i + 1}</text>`;
      });
      if (sv.closing) main += `<circle cx="${sv.closing.x}" cy="${sv.closing.y}" r="${cv.px(5)}" fill="#ef6c00" ${NS}/>`;
      return { main, top };
    }
    if (n >= 3) main += `<polygon points="${poly(pts)}" fill="var(--jd-accent,#2e7d32)" fill-opacity=".10" stroke="none"/>`;
    // précision de chaque point
    pts.forEach((p) => { if (p.accuracy > 0) main += `<circle cx="${p.x}" cy="${p.y}" r="${p.accuracy}" fill="#2e7d32" fill-opacity=".06" stroke="#2e7d32" stroke-opacity=".25" stroke-width="1" ${NS}/>`; });
    if (n >= 2) main += `<polyline points="${poly(pts)}" fill="none" stroke="var(--jd-fg,#222)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" ${NS}/>`;
    if (n >= 3) main += `<line x1="${pts[n - 1].x}" y1="${pts[n - 1].y}" x2="${pts[0].x}" y2="${pts[0].y}" stroke="#757575" stroke-width="1.5" stroke-dasharray="3 5" ${NS}/>`;
    for (let i = 0; i < n - 1; i++) main += label(pts[i], pts[i + 1], fs);
    pts.forEach((p, i) => {
      main += `<circle cx="${p.x}" cy="${p.y}" r="${hr}" fill="${i === 0 ? '#2e7d32' : '#fff'}" stroke="#2e7d32" stroke-width="2.5" ${NS}/><text x="${p.x}" y="${p.y}" font-size="${cv.px(11)}" text-anchor="middle" dominant-baseline="central" fill="${i === 0 ? '#fff' : '#2e7d32'}" font-weight="700">${i + 1}</text>`;
    });
    // trace du chemin parcouru
    const o = sv.frameOrigin();
    if (o && sv.trail.length > 1) {
      const loc = sv.trail.map((t) => localOfLatLon(t, o));
      top += `<polyline points="${poly(loc)}" fill="none" stroke="#1e88e5" stroke-opacity=".45" stroke-width="2" stroke-linejoin="round" ${NS}/>`;
    }
    const me = toLocal(sv.current);
    if (me) {
      const q = sv.status().quality;
      const last = pts[n - 1];
      if (last) {
        top += `<line x1="${last.x}" y1="${last.y}" x2="${me.x}" y2="${me.y}" stroke="#1e88e5" stroke-width="2.5" stroke-dasharray="7 5" ${NS}/>`;
        top += label(last, me, fs, '#1565c0', -1);
      }
      if (n >= 3 && sv.nearStart().near) top += `<circle cx="${pts[0].x}" cy="${pts[0].y}" r="${hr * 1.9}" fill="none" stroke="#ef6c00" stroke-width="3" ${NS}/>`;
      const acc = Number(sv.current.accuracy) || 0;
      top += `<circle cx="${me.x}" cy="${me.y}" r="${Math.max(acc, cv.px(8))}" fill="${QCOL[q]}" fill-opacity=".14" stroke="${QCOL[q]}" stroke-width="1.5" ${NS}/>`;
      top += `<circle cx="${me.x}" cy="${me.y}" r="${cv.px(8)}" fill="#1e88e5" stroke="#fff" stroke-width="2.5" ${NS}/>`;
    }
    return { main, top };
  }
  function localOfLatLon(t, o) {
    const R = 6371008.8; const rad = Math.PI / 180;
    return { x: (t.lon - o.lon) * rad * R * Math.cos(o.lat * rad), y: -(t.lat - o.lat) * rad * R };
  }

  // ---------- démarrage ----------
  function activate(draft) {
    S.survey = createSurvey({ draft });
    S.survey.start();
    S.active = true; S.phase = 'walk'; S.follow = true; S.err = null; S.capturing = null; S.msg = ''; S.msgKind = '';
    root.classList.add('jd-survey-on');
    head.hidden = false; foot.hidden = false;
    self(() => cv.apply());
    say('');
    render();
    startWatch();
    S.tick = setInterval(() => render(true), 1000);
    try { globalThis.document?.addEventListener('visibilitychange', onVisible); } catch { /* ignoré */ }
    self(() => cv.fit(padBounds(S.survey.points.length ? S.survey.points : [{ x: 0, y: 0 }]), 1.25));
    redraw();
  }
  const draftOf = () => {
    const d = g.context && g.context.gpsSurveyDraft;
    return d && Array.isArray(d.points) && d.points.length ? d : null;
  };

  /** Point d'entrée : reprise d'un brouillon éventuel, confirmation de remplacement, puis relevé guidé. */
  function start() {
    if (S.active) return;
    const proceed = () => {
      if (g.boundary && g.boundary.length) {
        ask('Remplacer le contour actuel par le relevé GPS ? (Vous pourrez annuler avec ↶.)', [
          { label: 'Remplacer', act: 'ask-replace', fn: () => activate(null) },
          { label: 'Annuler', act: 'ask-cancel' },
        ]);
      } else activate(null);
    };
    const d = draftOf();
    if (d) {
      ask(`Un relevé GPS interrompu existe (${d.points.length} point${d.points.length > 1 ? 's' : ''}). Le reprendre ?`, [
        { label: 'Reprendre', act: 'ask-resume', fn: () => activate(d) },
        { label: 'Recommencer', act: 'ask-restart', fn: () => { delete g.context.gpsSurveyDraft; persist(); proceed(); } },
        { label: 'Annuler', act: 'ask-cancel' },
      ]);
    } else proceed();
  }

  return {
    start,
    isActive: () => S.active,
    draft: draftOf,
    svg,
    /** À appeler à chaque changement de vue : un geste de l'utilisateur libère le recentrage automatique. */
    viewChanged() {
      const v = S.lastView; const w = cv.view;
      if (v && Math.abs(v.cx - w.cx) < 1e-6 && Math.abs(v.cy - w.cy) < 1e-6 && Math.abs(v.mpp - w.mpp) < 1e-9) return; // simple redimensionnement
      if (S.active && !S.selfMove && S.follow && S.phase === 'walk') { S.follow = false; render(true); } },
    destroy() { if (S.active) { try { persistDraftSafe(); } catch { /* ignoré */ } } S.active = false; if (S.stopWatch) S.stopWatch(); if (S.tick) clearInterval(S.tick); if (S.tick2) clearInterval(S.tick2); try { globalThis.document?.removeEventListener('visibilitychange', onVisible); } catch { /* ignoré */ } },
    _state: S,
  };
  function persistDraftSafe() { if (S.survey && S.survey.points.length) { g.context.gpsSurveyDraft = S.survey.toDraft(); persist(); } }
}
