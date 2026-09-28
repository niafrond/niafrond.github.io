package io.github.niafrond.reveilxtrem;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

/**
 * Port Java de la logique pure de `reveil-xtrem/scheduler.js` (calcul de la
 * prochaine occurrence d'une alarme), utilisé côté natif par AlarmReceiver
 * et BootReceiver pour reprogrammer AlarmManager sans dépendre du JS.
 *
 * Convention `days` identique au JS : 0=dimanche .. 6=samedi (Date#getDay()),
 * tableau vide = alarme ponctuelle (sonne à la prochaine occurrence de son
 * horaire, quel que soit le jour).
 */
final class AlarmMath {

    private AlarmMath() {}

    /**
     * Calcule le prochain timestamp (ms, strictement après `fromMillis`) où
     * l'heure de l'alarme correspond, en respectant `days` si non vide.
     */
    static long nextOccurrenceMillis(JSONObject alarm, long fromMillis) throws JSONException {
        String time = alarm.getString("time");
        String[] parts = time.split(":");
        int hh = Integer.parseInt(parts[0]);
        int mm = Integer.parseInt(parts[1]);

        Set<Integer> days = new HashSet<>();
        JSONArray daysArr = alarm.optJSONArray("days");
        if (daysArr != null) {
            for (int i = 0; i < daysArr.length(); i++) days.add(daysArr.getInt(i));
        }

        Calendar base = Calendar.getInstance();
        base.setTimeInMillis(fromMillis);
        base.set(Calendar.SECOND, 0);
        base.set(Calendar.MILLISECOND, 0);

        // Au plus une semaine à parcourir pour trouver le prochain jour valide.
        for (int offset = 0; offset < 8; offset++) {
            Calendar candidate = (Calendar) base.clone();
            candidate.add(Calendar.DAY_OF_YEAR, offset);
            candidate.set(Calendar.HOUR_OF_DAY, hh);
            candidate.set(Calendar.MINUTE, mm);

            if (candidate.getTimeInMillis() <= fromMillis) continue; // doit être strictement futur

            int jsDay = candidate.get(Calendar.DAY_OF_WEEK) - 1; // Calendar: DIMANCHE=1 -> JS: 0
            if (days.isEmpty() || days.contains(jsDay)) {
                return candidate.getTimeInMillis();
            }
        }
        // Ne devrait pas arriver (days, s'il est non vide, couvre au moins un jour par semaine).
        return fromMillis + 24L * 60 * 60 * 1000;
    }
}
