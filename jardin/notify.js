// Pont notifications locales : Capacitor LocalNotifications, repli Notification web, sinon no-op.
// Les notifications de l'app portent `extra.source = 'jardin'` (ids ≥ ID_MIN) pour être retrouvées.
import { fetchForecast } from './weather.js';
import { planWatering } from './watering.js';

const ID_MIN = 100000000;
const webTimers = new Map();

function plugin(opts) {
  return opts?.plugin ?? globalThis.Capacitor?.Plugins?.LocalNotifications ?? null;
}
const isOurs = (n) => n?.extra?.source === 'jardin' || (n?.id >= ID_MIN && n?.id < 2147483647);

/** Permission déjà accordée ? (ne demande rien) */
export async function hasPermission(opts) {
  const p = plugin(opts);
  if (p?.checkPermissions) return (await p.checkPermissions()).display === 'granted';
  const N = globalThis.Notification;
  return !!N && N.permission === 'granted';
}

/** Demande la permission (à appeler à l'activation, après explication). → boolean */
export async function ensurePermission(opts) {
  const p = plugin(opts);
  if (p?.checkPermissions) {
    let st = (await p.checkPermissions()).display;
    if (st === 'prompt' || st === 'prompt-with-rationale') st = (await p.requestPermissions()).display;
    return st === 'granted';
  }
  const N = globalThis.Notification;
  if (!N) return false;
  if (N.permission === 'granted') return true;
  if (N.permission === 'denied') return false;
  return (await N.requestPermission()) === 'granted';
}

export async function cancelAll(opts) {
  const p = plugin(opts);
  if (p?.getPending) {
    const { notifications = [] } = await p.getPending();
    const ours = notifications.filter(isOurs).map((n) => ({ id: n.id }));
    if (ours.length) await p.cancel({ notifications: ours });
  }
  for (const t of webTimers.values()) clearTimeout(t);
  webTimers.clear();
}

/** Annule les notifications `jardin` obsolètes puis planifie `list` ([{id, at, title, body}]). → nombre planifié */
export async function scheduleAll(list, opts = {}) {
  await cancelAll(opts);
  const now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const future = (list || []).filter((n) => Date.parse(n.at) > now);
  if (!future.length) return 0;
  const p = plugin(opts);
  if (p?.schedule) {
    await p.schedule({
      notifications: future.map((n) => ({
        id: n.id, title: n.title, body: n.body,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        extra: { source: 'jardin', zoneIds: n.zoneIds || [] },
      })),
    });
    return future.length;
  }
  const N = globalThis.Notification;
  if (!N || N.permission !== 'granted') return 0;
  let count = 0;
  for (const n of future) {
    const delay = Date.parse(n.at) - now;
    if (delay > 2147483000) continue; // limite de setTimeout
    webTimers.set(n.id, setTimeout(() => {
      webTimers.delete(n.id);
      try { new N(n.title, { body: n.body, tag: `jardin-${n.id}` }); } catch { /* ignoré */ }
    }, delay));
    count++;
  }
  return count;
}

/**
 * Météo → bilan hydrique → planification. Sans météo (hors ligne, pas de position) : repli calendaire.
 * `opts` : {fetchImpl, cache, now, state, plantsById, plugin}. → {plan, forecast, scheduled, permission}
 */
export async function refreshAndSchedule(garden, settings, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const n = settings?.notifications ?? {};
  let forecast = null;
  const loc = garden?.context?.location;
  if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
    try {
      forecast = await fetchForecast({ lat: loc.lat, lon: loc.lon, days: 7 }, { fetchImpl: opts.fetchImpl, cache: opts.cache, now });
    } catch { forecast = null; }
  }
  const plan = planWatering(garden, forecast, opts.state || {}, now, settings, { plantsById: opts.plantsById });
  if (n.enabled === false) {
    await cancelAll(opts);
    return { plan, forecast, scheduled: 0, permission: await hasPermission(opts) };
  }
  const permission = await hasPermission(opts);
  const scheduled = permission ? await scheduleAll(plan.notifications, { ...opts, now }) : 0;
  return { plan, forecast, scheduled, permission };
}

const ID_NOW = 4243;
/**
 * Notification immédiate (ex. « Le PDF est prêt »). Ne fait pas partie des rappels d'arrosage : jamais annulée par `scheduleAll`.
 * → true si une notification a été demandée. `opts` : {plugin, id}
 */
export async function notifyNow({ title, body, id = ID_NOW }, opts = {}) {
  try {
    const p = plugin(opts);
    if (p?.schedule) {
      if (p.checkPermissions && (await p.checkPermissions()).display !== 'granted') return false;
      await p.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true }, extra: { source: 'jardin-pdf' } }] });
      return true;
    }
    const N = globalThis.Notification;
    if (!N || N.permission !== 'granted') return false;
    new N(title, { body, tag: `jardin-${id}` });
    return true;
  } catch { return false; }
}
