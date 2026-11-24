// Réglages : notifications locales (arrosage, gel, canicule, tâches du mois, mode vacances).
import { storage, defaultSettings } from '../storage.js';
import { ensurePermission } from '../notify.js';
import { injectStyles, h } from './draw-util.js';

const pad = (n) => String(n).padStart(2, '0');

export function mountSettings(el, { onChange } = {}) {
  injectStyles();
  let destroyed = false;
  let settings = defaultSettings();
  const root = h('div', { class: 'jd jd-page', 'data-role': 'settings' });
  el.innerHTML = '';
  el.appendChild(root);
  const msgEl = h('div', { class: 'jd-msg', role: 'status', 'aria-live': 'polite', 'data-role': 'settings-msg' });

  const say = (m, k = '') => { msgEl.textContent = m; msgEl.className = `jd-msg ${k}`; };
  async function save() {
    try { await storage.saveSettings(settings); } catch { say('Enregistrement impossible.', 'err'); }
    if (onChange) onChange(settings);
  }

  const toggle = (label, hint, key, extra) => {
    const n = settings.notifications;
    const cb = h('input', { type: 'checkbox', checked: !!n[key], 'data-setting': key, 'aria-label': label });
    cb.addEventListener('change', async () => {
      if (extra) { const ok = await extra(cb.checked); if (!ok) { cb.checked = !cb.checked; return; } }
      n[key] = cb.checked; await save(); render();
    });
    return h('label', { class: 'jd-switch' }, h('span', {}, h('b', {}, label), hint ? h('div', { class: 'jd-msg', style: { padding: 0 } }, hint) : null), cb);
  };

  async function testNotification() {
    const ok = await ensurePermission();
    if (!ok) { say('Notifications refusées : autorisez-les dans les réglages du téléphone.', 'err'); return; }
    const title = 'Jardin : test'; const body = 'Les rappels d\'arrosage s\'afficheront ainsi.';
    try {
      const p = globalThis.Capacitor && globalThis.Capacitor.Plugins && globalThis.Capacitor.Plugins.LocalNotifications;
      if (p && p.schedule) {
        await p.schedule({ notifications: [{ id: 4242, title, body, schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true } }] });
        say('Notification de test dans quelques secondes.');
      } else if (globalThis.Notification) {
        setTimeout(() => { try { new Notification(title, { body }); } catch { /* ignoré */ } }, 1500);
        say('Notification de test envoyée.');
      } else say('Les notifications ne sont pas disponibles ici.', 'warn');
    } catch { say('Échec de la notification de test.', 'err'); }
  }

  function render() {
    if (destroyed) return;
    const n = settings.notifications;
    root.innerHTML = '';
    const timeIn = h('input', { class: 'jd-input', type: 'time', value: `${pad(n.hour ?? 19)}:${pad(n.minute ?? 0)}`, 'aria-label': 'Heure de la notification quotidienne', 'data-setting': 'time', style: { maxWidth: '160px' } });
    timeIn.addEventListener('change', async () => { const [hh, mm] = (timeIn.value || '19:00').split(':').map(Number); n.hour = hh; n.minute = mm; await save(); });
    const vac = h('input', { class: 'jd-input', type: 'date', value: n.vacationUntil ? String(n.vacationUntil).slice(0, 10) : '', 'aria-label': 'Fin des vacances', 'data-setting': 'vacationUntil', style: { maxWidth: '200px' } });
    vac.addEventListener('change', async () => { n.vacationUntil = vac.value || null; await save(); render(); });
    root.append(
      h('h2', { style: { margin: '4px 0' } }, 'Réglages'),
      h('section', { class: 'jd-card' },
        h('h3', {}, 'Notifications'),
        toggle('Activer les notifications', 'Rappels d\'arrosage calculés d\'après la météo, sur votre téléphone (aucun serveur).', 'enabled', async (on) => {
          if (!on) return true;
          const ok = await ensurePermission();
          if (!ok) { say('Autorisation refusée : activez les notifications dans les réglages Android.', 'err'); return false; }
          say('Notifications activées.'); return true;
        }),
        h('div', { class: 'jd-switch' }, h('b', {}, 'Heure du rappel'), timeIn),
        toggle('Alerte gel', 'Prévient quand le gel menace les plantes frileuses.', 'frost'),
        toggle('Alerte canicule', 'Prévient avant les fortes chaleurs.', 'heat'),
        toggle('Tâches du mois', 'Taille, plantation, fertilisation du calendrier.', 'monthlyTasks'),
        h('div', { class: 'jd-switch' }, h('span', {}, h('b', {}, 'Mode vacances'), h('div', { class: 'jd-msg', style: { padding: 0 } }, 'Aucune notification jusqu\'à cette date.')), vac),
        n.vacationUntil ? h('button', { type: 'button', class: 'jd-btn', 'data-act': 'vacation-clear', onclick: async () => { n.vacationUntil = null; await save(); render(); } }, 'Fin du mode vacances') : null,
        h('div', { class: 'jd-row' }, h('button', { type: 'button', class: 'jd-btn primary', 'data-act': 'test-notification', onclick: testNotification }, '🔔 Tester la notification')),
      ),
      msgEl,
      h('p', { class: 'jd-note' }, 'Android peut retarder les notifications en mode économie d\'énergie. Les montants d\'eau sont des ordres de grandeur.'),
    );
  }

  render();
  (async () => {
    try { const s = await storage.getSettings(); if (s && !destroyed) { settings = { ...defaultSettings(), ...s, notifications: { ...defaultSettings().notifications, ...(s.notifications || {}) } }; render(); } } catch { /* défauts */ }
  })();
  return function unmount() { destroyed = true; el.innerHTML = ''; };
}
