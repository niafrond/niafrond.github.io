// Pont vers le plugin natif Capacitor `AlarmScheduler` (reveil-xtrem-android/,
// io.github.niafrond.reveilxtrem.AlarmSchedulerPlugin). Sur la version
// web/PWA pure (sans wrapper natif, ex. GitHub Pages), `window.Capacitor`
// n'existe pas et toutes les fonctions ci-dessous deviennent des no-op sûrs :
// le déclenchement reste alors entièrement géré par scheduler.js dans main.js.
//
// Sous Capacitor, c'est l'inverse : AlarmManager (programmé par le plugin)
// déclenche réellement les alarmes, y compris appli fermée — main.js ne fait
// plus que réagir à l'événement 'reveilxtrem-ring' ou à getPendingRingId().

function getPlugin() {
  return window.Capacitor?.Plugins?.AlarmScheduler || null;
}

export function isNativePlatform() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

export async function syncNativeAlarms(alarms) {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.syncAlarms({ alarms });
  } catch {
    // La synchro suivante (prochain changement d'alarme) réessaiera.
  }
}

/**
 * `snoozeCount` = nombre de rappels déjà utilisés pour cette occurrence
 * APRÈS ce snooze (donc `priorSnoozeCount + 1`) — permet au natif de
 * reprogrammer avec le bon décompte pour le prochain rappel (limite,
 * intervalle dégressif) même si l'appli est ensuite fermée. Voir
 * AlarmRingService.java (source de vérité côté natif quand l'appli est en
 * arrière-plan) et scheduler.js#applySnooze (source de vérité côté JS).
 */
export async function nativeSnooze(alarmId, minutes, snoozeCount) {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.snooze({ id: alarmId, minutes, snoozeCount });
  } catch {}
}

export async function nativeDismiss(alarmId) {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.dismiss({ id: alarmId });
  } catch {}
}

// ── Sonnerie : sélecteur système Android (RingtoneManager) ───────────────
// L'utilisateur choisit parmi ses propres sonneries/musiques via le menu
// système natif plutôt qu'un choix limité de sonneries synthétisées.

/** Ouvre le sélecteur système de sonneries ; retourne l'URI choisie (ou '' pour "par défaut") et son titre, ou null si annulé/indisponible. */
export async function nativePickRingtone(currentUri) {
  const plugin = getPlugin();
  if (!plugin) return null;
  try {
    const { uri, title } = await plugin.pickRingtone({ uri: currentUri || '' });
    return { uri: uri || '', title: title || null };
  } catch {
    return null;
  }
}

/** Résout le titre affichable d'une sonnerie déjà choisie (ou de la sonnerie par défaut si uri est vide), sans ouvrir le sélecteur. */
export async function nativeRingtoneTitle(uri) {
  const plugin = getPlugin();
  if (!plugin) return null;
  try {
    const { title } = await plugin.ringtoneTitle({ uri: uri || '' });
    return title || null;
  } catch {
    return null;
  }
}

/**
 * Applique côté JS les changements décidés côté natif pendant que l'appli
 * n'était pas ouverte (skipNext consommé, alarme ponctuelle désactivée après
 * sonnerie) — à appeler une fois au démarrage, avant de resynchroniser.
 */
export async function consumeNativePendingUpdates() {
  const plugin = getPlugin();
  if (!plugin) return {};
  try {
    const { updates } = await plugin.consumePendingUpdates();
    return updates || {};
  } catch {
    return {};
  }
}

/** Cold start : l'appli vient d'être lancée par la notification d'une alarme. */
export async function getNativePendingRingId() {
  const plugin = getPlugin();
  if (!plugin) return null;
  try {
    const { id } = await plugin.getPendingRingId();
    return id || null;
  } catch {
    return null;
  }
}

/** Appli déjà ouverte/en arrière-plan : MainActivity relaie l'alarme en direct. */
export function onNativeRing(handler) {
  window.addEventListener('reveilxtrem-ring', e => {
    const id = e.detail && e.detail.id;
    if (id) handler(id);
  });
}

// ── Permissions système ─────────────────────────────────────────────────

const PERMISSION_DEFS = {
  notifications: {
    label: 'Notifications',
    reason: "Pour afficher et faire sonner l'alarme même quand l'app est fermée.",
    check: 'checkNotificationPermission',
    request: 'requestNotificationPermission',
  },
  exactAlarm: {
    label: 'Alarmes exactes',
    reason: "Pour que l'alarme sonne pile à l'heure programmée (obligatoire depuis Android 12).",
    check: 'canScheduleExactAlarms',
    request: 'requestExactAlarmPermission',
  },
  battery: {
    label: 'Optimisation de batterie',
    reason: "Empêche Android de fermer l'appli avant que l'alarme n'ait sonné.",
    check: 'isIgnoringBatteryOptimizations',
    request: 'requestIgnoreBatteryOptimizations',
  },
  fullScreenIntent: {
    label: 'Affichage plein écran',
    reason: "Pour afficher le réveil par-dessus l'écran verrouillé.",
    check: 'canUseFullScreenIntent',
    request: 'requestFullScreenIntentPermission',
  },
};

export function listPermissionKeys() {
  return Object.keys(PERMISSION_DEFS);
}

export function permissionInfo(key) {
  return PERMISSION_DEFS[key];
}

export async function checkPermission(key) {
  const plugin = getPlugin();
  if (!plugin) return true; // pas de wrapper natif : rien à demander
  try {
    const res = await plugin[PERMISSION_DEFS[key].check]();
    return res?.granted !== false;
  } catch {
    return true;
  }
}

export async function requestPermission(key) {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin[PERMISSION_DEFS[key].request]();
  } catch {}
}
