// Écran « Conseils » : plantation, entretien, arrosage, engrais + calendrier 12 mois et tâches cochables.
import { buildAdvice, calendar, frostProtection } from '../advice.js';
import { hydrozones, monthlySchedule, planWatering } from '../watering.js';
import { climateForDepartement, adjustTminForAltitude } from '../climate.js';
import { WATER_LABELS } from '../model.js';
import { injectStyles, h, fr } from './draw-util.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const KIND = { plant: '🌱 Planter', prune: '✂️ Tailler', fertilize: '🧪 Fertiliser', water: '💧 Arroser', harvest: '🧺 Récolter', protect: '❄️ Protéger' };
const TABS = [['plant', 'Plantation'], ['care', 'Entretien'], ['water', 'Arrosage'], ['fert', 'Engrais']];
const monthList = (arr) => (arr && arr.length ? arr.map((m) => MONTHS_SHORT[m - 1]).join(', ') : '—');

export function mountAdvice(el, { garden, onChange } = {}) {
  injectStyles();
  const g = garden;
  g.tasksDone = g.tasksDone || {};
  const now = new Date();
  const st = { tab: 'plant', month: now.getMonth() + 1 };
  const year = now.getFullYear();
  let destroyed = false;

  const root = h('div', { class: 'jd jd-page', 'data-role': 'advice' });
  el.innerHTML = '';
  el.appendChild(root);

  let advice; let cal;
  const compute = () => { advice = buildAdvice(g); cal = calendar(g); };
  const taskKey = (m, t) => `${year}-${String(m).padStart(2, '0')}:${t.kind}:${t.zoneId}:${t.plantId || ''}`;

  async function persist() {
    if (onChange) { onChange(g); return; }
    try { const { storage } = await import('../storage.js'); await storage.saveGarden(g); } catch { /* hors stockage */ }
  }

  // mois d'une catégorie de tâche pour une essence dans une zone
  const monthsFor = (zoneId, plantId, kind) => cal.filter((c) => c.tasks.some((t) => t.zoneId === zoneId && t.plantId === plantId && t.kind === kind)).map((c) => c.month);

  function calendarCard() {
    const tasks = cal[st.month - 1].tasks;
    const doneN = (m) => cal[m - 1].tasks.filter((t) => g.tasksDone[taskKey(m, t)]).length;
    const grid = h('div', { class: 'jd-months', role: 'group', 'aria-label': 'Calendrier des 12 mois' });
    MONTHS_SHORT.forEach((lab, i) => {
      const m = i + 1; const total = cal[i].tasks.length;
      grid.append(h('button', { type: 'button', class: 'jd-month', 'data-month': m, 'aria-pressed': String(st.month === m), onclick: () => { st.month = m; render(); } }, h('b', {}, lab), h('small', {}, total ? `${doneN(m)}/${total}` : '—')));
    });
    const list = h('div', { 'data-role': 'month-tasks' });
    if (!tasks.length) list.append(h('p', { class: 'jd-msg' }, 'Aucune tâche ce mois-ci.'));
    // regroupement par type
    for (const kind of Object.keys(KIND)) {
      const sub = tasks.filter((t) => t.kind === kind);
      if (!sub.length) continue;
      list.append(h('h4', { style: { margin: '10px 0 2px' } }, KIND[kind]));
      sub.forEach((t) => {
        const key = taskKey(st.month, t);
        const cb = h('input', { type: 'checkbox', checked: !!g.tasksDone[key], 'aria-label': t.text, onchange: () => {
          if (cb.checked) g.tasksDone[key] = true; else delete g.tasksDone[key];
          row.classList.toggle('done', cb.checked); persist(); updateCounts();
        } });
        const row = h('label', { class: `jd-task${cb.checked ? ' done' : ''}` }, cb, h('span', {}, t.text));
        list.append(row);
      });
    }
    return h('section', { class: 'jd-card' }, h('h3', {}, `Calendrier — ${MONTHS[st.month - 1]}`), grid, list);
  }
  function updateCounts() {
    root.querySelectorAll('.jd-month').forEach((b) => {
      const m = Number(b.dataset.month); const total = cal[m - 1].tasks.length;
      const d = cal[m - 1].tasks.filter((t) => g.tasksDone[taskKey(m, t)]).length;
      b.querySelector('small').textContent = total ? `${d}/${total}` : '—';
    });
  }

  const plantLine = (zone, p, text, months) => h('div', { style: { margin: '6px 0' } },
    h('b', {}, `${p.plant.commonName}${p.count > 1 ? ` ×${p.count}` : ''}`), ' ', h('em', { class: 'jd-msg', style: { padding: 0 } }, p.plant.latinName || ''),
    h('p', {}, text), months ? h('p', {}, h('span', { class: 'jd-tag' }, `Quand : ${monthList(months)}`)) : null);

  function zoneCards(textOf, kind) {
    const out = [];
    for (const z of advice.zones) {
      if (!z.plants.length && !(kind === 'care' && z.tips.length)) continue;
      const card = h('section', { class: 'jd-card' }, h('h3', {}, z.zoneLabel));
      z.plants.forEach((p) => card.append(plantLine(z, p, textOf(p), monthsFor(z.zoneId, p.plant.id, ({ plant: 'plant', care: 'prune', fert: 'fertilize' })[kind]))));
      if (kind === 'care') z.tips.forEach((t) => card.append(h('p', {}, '• ' + t)));
      out.push(card);
    }
    if (!out.length) out.push(h('p', { class: 'jd-msg' }, advice.general.emptyHint || 'Aucune essence choisie pour le moment.'));
    return out;
  }

  function tabPlant() {
    const out = [];
    if (advice.plantingOrder.length) out.push(h('section', { class: 'jd-card' }, h('h3', {}, 'Ordre du chantier'), h('ol', { style: { paddingLeft: '20px', margin: 0 } }, advice.plantingOrder.map((s) => h('li', {}, s.replace(/^\d+\.\s*/, ''))))));
    out.push(h('section', { class: 'jd-card' }, h('h3', {}, 'Paillage'), h('p', {}, advice.general.mulch)));
    out.push(...zoneCards((p) => p.planting, 'plant'));
    return out;
  }
  function tabCare() {
    const out = zoneCards((p) => `${p.pruning}${p.notes ? ' ' + p.notes : ''}`, 'care');
    const dep = g.context && g.context.departement;
    const clim = dep ? climateForDepartement(dep) : null;
    if (clim && typeof clim.tminC === 'number') {
      const tmin = Math.round(adjustTminForAltitude(clim.tminC, g.context.altitude || 0));
      const prot = frostProtection(g, tmin);
      if (prot.length) out.push(h('section', { class: 'jd-card' }, h('h3', {}, `Protection hivernale (minimale de référence ${tmin} °C)`), prot.map((x) => h('p', {}, '• ' + x.text))));
    }
    return out;
  }
  const tabFert = () => zoneCards((p) => p.fertilizer, 'fert');

  function tabWater() {
    const out = [];
    const hz = hydrozones(g);
    const zl = Object.fromEntries(advice.zones.map((z) => [z.zoneId, z.zoneLabel]));
    out.push(h('p', { class: 'jd-note' }, 'Les chiffres d\'arrosage sont des ordres de grandeur : adaptez-les à votre sol, à la météo et à l\'âge des plantations (arrosage de reprise la première année).'));
    if (!hz.length) { out.push(h('p', { class: 'jd-msg' }, 'Aucune zone arrosable pour le moment : ajoutez des essences ou une pelouse.')); return out; }
    out.push(h('section', { class: 'jd-card' }, h('h3', {}, 'Hydrozones'),
      hz.map((z) => h('p', {}, h('span', { class: 'jd-tag' }, `Besoin ${(WATER_LABELS[z.level] || z.level).toLowerCase()}`), `${fr(z.areaM2, 1)} m² : ${z.zoneIds.map((id) => zl[id] || id).join(', ')}`)),
      hz.length > 1 ? h('p', { class: 'jd-msg' }, 'Les zones de besoins différents s\'arrosent à part : ne les regroupez pas sur le même circuit.') : null));
    const sched = monthlySchedule(g);
    const sm = sched[st.month - 1];
    out.push(h('section', { class: 'jd-card', 'data-role': 'water-month' }, h('h3', {}, `Arrosage en ${MONTHS[st.month - 1]}`),
      sm.zones.map((z) => h('p', {}, h('b', {}, z.label || zl[z.zoneId] || z.zoneId), ' : ',
        z.intervalDays ? `environ tous les ${z.intervalDays} jour${z.intervalDays > 1 ? 's' : ''}, ≈ ${z.litersPerWatering} L par arrosage (≈ ${z.litersPerWeek} L/semaine)` : 'pas d\'arrosage nécessaire en général (la pluie suffit)')),
      h('p', { class: 'jd-msg' }, 'Arrosez tôt le matin ou le soir, au pied. Paillez et récupérez l\'eau de pluie. ', advice.general.rainwater)));
    // tableau annuel
    const tbl = h('table', { class: 'jd-sides' }, h('tr', {}, h('th', {}, 'L/sem.'), MONTHS_SHORT.map((m) => h('th', {}, m[0].toUpperCase()))));
    sm.zones.forEach((zz, zi) => tbl.append(h('tr', {}, h('td', {}, zz.label || zl[zz.zoneId] || ''), sched.map((s) => h('td', {}, String(s.zones[zi] ? s.zones[zi].litersPerWeek : 0))))));
    out.push(h('section', { class: 'jd-card', style: { overflowX: 'auto' } }, h('h3', {}, 'Litres par semaine, mois par mois'), tbl));
    // prochains arrosages (repli calendaire)
    try {
      const plan = planWatering(g, null, {}, new Date(), {});
      if (plan.notifications.length) out.push(h('section', { class: 'jd-card' }, h('h3', {}, 'Prochains arrosages (estimation sans météo)'), plan.notifications.slice(0, 7).map((n) => h('p', {}, h('b', {}, new Date(n.at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })), ' : ', n.body))));
    } catch { /* ignoré */ }
    return out;
  }

  function render() {
    if (destroyed) return;
    compute();
    root.innerHTML = '';
    root.append(h('h2', { style: { margin: '4px 0' } }, `Conseils — ${g.name || 'Mon jardin'}`));
    root.append(h('p', { class: 'jd-note' }, advice.general.disclaimer));
    root.append(calendarCard());
    const tabs = h('div', { class: 'jd-tabs', role: 'tablist' }, TABS.map(([id, label]) => h('button', { type: 'button', class: 'jd-tab', role: 'tab', 'data-tab': id, 'aria-selected': String(st.tab === id), onclick: () => { st.tab = id; render(); } }, label)));
    root.append(tabs);
    const body = h('div', { role: 'tabpanel', 'data-role': 'advice-tab' });
    body.append(...({ plant: tabPlant, care: tabCare, water: tabWater, fert: tabFert })[st.tab]());
    root.append(body);
  }
  render();
  return function unmount() { destroyed = true; el.innerHTML = ''; };
}
