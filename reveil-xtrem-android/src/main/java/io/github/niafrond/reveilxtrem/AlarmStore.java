package io.github.niafrond.reveilxtrem;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Miroir natif de l'état des alarmes (SharedPreferences), utilisé pour
 * pouvoir reprogrammer les alarmes via AlarmManager sans dépendre du
 * WebView/JS — notamment après un redémarrage de l'appareil (BootReceiver)
 * ou quand l'appli n'est pas au premier plan.
 *
 * La source de vérité reste `localStorage` côté JS (alarms.js) : ce miroir
 * est mis à jour à chaque changement via AlarmSchedulerPlugin#syncAlarms.
 * Les changements décidés côté natif (skipNext consommé, alarme ponctuelle
 * désactivée après sonnerie) sont écrits dans `pending_updates_json` et
 * relus/appliqués par le JS au prochain démarrage/premier plan
 * (AlarmSchedulerPlugin#consumePendingUpdates).
 */
public final class AlarmStore {

    private static final String PREFS = "reveilxtrem_alarms";
    private static final String KEY_ALARMS = "alarms_json";
    private static final String KEY_PENDING = "pending_updates_json";

    private AlarmStore() {}

    public static JSONArray loadAlarms(Context ctx) {
        String raw = prefs(ctx).getString(KEY_ALARMS, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public static void saveAlarms(Context ctx, JSONArray alarms) {
        prefs(ctx).edit().putString(KEY_ALARMS, alarms.toString()).apply();
    }

    public static JSONObject findById(JSONArray alarms, String id) {
        if (id == null) return null;
        for (int i = 0; i < alarms.length(); i++) {
            try {
                JSONObject a = alarms.getJSONObject(i);
                if (id.equals(a.optString("id", null))) return a;
            } catch (JSONException ignored) {
                // entrée malformée, on l'ignore
            }
        }
        return null;
    }

    public static JSONObject loadPendingUpdates(Context ctx) {
        String raw = prefs(ctx).getString(KEY_PENDING, "{}");
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    public static void clearPendingUpdates(Context ctx) {
        prefs(ctx).edit().remove(KEY_PENDING).apply();
    }

    /** Fusionne `patch` dans les mises à jour en attente pour l'alarme `alarmId`. */
    public static void addPendingUpdate(Context ctx, String alarmId, JSONObject patch) {
        JSONObject updates = loadPendingUpdates(ctx);
        try {
            JSONObject existing = updates.optJSONObject(alarmId);
            if (existing == null) {
                updates.put(alarmId, patch);
            } else {
                Iterator<String> keys = patch.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    existing.put(k, patch.get(k));
                }
            }
            prefs(ctx).edit().putString(KEY_PENDING, updates.toString()).apply();
        } catch (JSONException ignored) {
            // ne doit pas arriver (clés/valeurs contrôlées par l'appelant)
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
