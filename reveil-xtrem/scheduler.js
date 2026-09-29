// Logique pure de déclenchement des alarmes — aucune dépendance au DOM ni à
// setInterval, pour rester testable unitairement avec des Date arbitraires.

// Retourne une clé unique par minute locale (ex. "2026-09-28 07:30"),
// utilisée pour ne jamais déclencher deux fois la même alarme dans la même minute.
export function minuteKey(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

// GIVEN une alarme dont `days` est vide, elle sonne une seule fois, quel que
// soit le jour, à la première occurrence de son horaire.
// GIVEN `days` non vide (0=dimanche .. 6=samedi, comme Date#getDay()), elle
// sonne uniquement les jours listés.
export function matchesSchedule(alarm, date) {
  const [h, m] = alarm.time.split(':').map(Number);
  if (date.getHours() !== h || date.getMinutes() !== m) return false;
  if (!alarm.days || alarm.days.length === 0) return true;
  return alarm.days.includes(date.getDay());
}

/**
 * Évalue toutes les alarmes pour l'instant `now` donné.
 *
 * @param {Array} alarms - alarmes persistées (enabled, skipNext, days, time...)
 * @param {Date} now
 * @param {Map<string, {lastFiredKey: string|null, snoozeUntil: number|null, snoozeCount: number}>} runtimeMap
 * @returns {{ ringing: string[], skipConsumed: string[], nextRuntime: Map }}
 *   - ringing : ids des alarmes qui doivent sonner maintenant
 *   - skipConsumed : ids des alarmes dont le "passer la prochaine" vient
 *     d'être consommé (l'appelant doit remettre `skipNext` à false et, pour
 *     une alarme ponctuelle, la désactiver puisqu'elle n'aura pas d'autre
 *     occurrence)
 *   - nextRuntime : nouvel état d'exécution à persister
 */
export function evaluateAlarms(alarms, now, runtimeMap) {
  const ringing = [];
  const skipConsumed = [];
  const nextRuntime = new Map(runtimeMap);
  const key = minuteKey(now);

  for (const alarm of alarms) {
    const rt = runtimeMap.get(alarm.id) || { lastFiredKey: null, snoozeUntil: null };

    if (!alarm.enabled) {
      continue;
    }

    // Un snooze en cours a priorité : on ignore l'horaire normal tant qu'il
    // n'est pas écoulé.
    if (rt.snoozeUntil != null) {
      if (now.getTime() >= rt.snoozeUntil) {
        ringing.push(alarm.id);
        // Conserve `snoozeCount` (et tout futur champ de rt) : seul le snooze
        // en cours est consommé, pas le compteur de rappels déjà utilisés
        // pour cette occurrence (voir alarms.js#canSnoozeAgain/main.js#updateSnoozeButton).
        nextRuntime.set(alarm.id, { ...rt, lastFiredKey: key, snoozeUntil: null });
      }
      continue;
    }

    if (matchesSchedule(alarm, now) && rt.lastFiredKey !== key) {
      if (alarm.skipNext) {
        skipConsumed.push(alarm.id);
        nextRuntime.set(alarm.id, { ...rt, lastFiredKey: key });
      } else {
        ringing.push(alarm.id);
        nextRuntime.set(alarm.id, { ...rt, lastFiredKey: key });
      }
    }
  }

  return { ringing, skipConsumed, nextRuntime };
}

/**
 * Prochaine Date (strictement après `fromDate`) à laquelle l'horaire de
 * l'alarme correspond, en respectant `days` si non vide. Ne tient PAS
 * compte de `enabled`/`skipNext` — c'est le rôle de l'appelant
 * (getNextAlarmOccurrence) de les combiner.
 */
export function nextOccurrence(alarm, fromDate) {
  const [h, m] = alarm.time.split(':').map(Number);
  const base = new Date(fromDate);
  base.setSeconds(0, 0);

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(base);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(h, m, 0, 0);

    if (candidate.getTime() <= fromDate.getTime()) continue; // doit être strictement futur

    if (!alarm.days || alarm.days.length === 0 || alarm.days.includes(candidate.getDay())) {
      return candidate;
    }
  }
  return null; // ne devrait pas arriver si `days` couvre au moins un jour
}

/**
 * Trouve, parmi toutes les alarmes activées, celle qui sonnera le plus tôt
 * — pour l'affichage "Prochaine alarme dans …" de l'écran d'accueil.
 * Prend en compte un snooze en cours (prioritaire sur l'horaire normal) et
 * `skipNext` (l'occurrence sautée n'est pas candidate, on cherche la suivante).
 *
 * @returns {{alarm: object, at: Date} | null}
 */
export function getNextAlarmOccurrence(alarms, now, runtimeMap = new Map()) {
  let best = null;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const rt = runtimeMap.get(alarm.id);

    let at;
    if (rt && rt.snoozeUntil != null) {
      at = new Date(rt.snoozeUntil);
    } else {
      at = nextOccurrence(alarm, now);
      if (at && alarm.skipNext) at = nextOccurrence(alarm, at);
    }
    if (!at) continue;

    if (!best || at.getTime() < best.at.getTime()) best = { alarm, at };
  }
  return best;
}

// Programme un snooze : la prochaine alarme sonnera dans `minutes` minutes.
// Incrémente `snoozeCount` (nombre de rappels déjà utilisés pour l'occurrence
// en cours), consommé par alarms.js#effectiveSnoozeMinutes/canSnoozeAgain.
export function applySnooze(runtimeMap, alarmId, now, minutes) {
  const next = new Map(runtimeMap);
  const rt = runtimeMap.get(alarmId) || { lastFiredKey: null, snoozeUntil: null, snoozeCount: 0 };
  next.set(alarmId, { ...rt, snoozeUntil: now.getTime() + minutes * 60000, snoozeCount: (rt.snoozeCount || 0) + 1 });
  return next;
}

// Annule un snooze en cours (ex. l'utilisateur résout le calcul directement,
// ou l'arrêt automatique de la sonnerie se déclenche) et remet `snoozeCount`
// à zéro : la prochaine occurrence repart avec son plein quota de rappels.
export function clearSnooze(runtimeMap, alarmId) {
  const next = new Map(runtimeMap);
  const rt = runtimeMap.get(alarmId) || { lastFiredKey: null, snoozeUntil: null, snoozeCount: 0 };
  next.set(alarmId, { ...rt, snoozeUntil: null, snoozeCount: 0 });
  return next;
}

export function runtimeToObject(runtimeMap) {
  return Object.fromEntries(runtimeMap);
}

export function runtimeFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}
