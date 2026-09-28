package io.github.niafrond.reveilxtrem;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * AlarmManager oublie tout au redémarrage de l'appareil : ce receiver
 * reprogramme depuis le miroir natif (AlarmStore) chaque alarme activée,
 * sans avoir besoin que l'appli/JS ait tourné depuis le boot.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }

        JSONArray alarms = AlarmStore.loadAlarms(context);
        long now = System.currentTimeMillis();
        for (int i = 0; i < alarms.length(); i++) {
            try {
                JSONObject alarm = alarms.getJSONObject(i);
                if (!alarm.optBoolean("enabled", false)) continue;
                long next = AlarmMath.nextOccurrenceMillis(alarm, now);
                AlarmActions.scheduleExact(context, alarm.getString("id"), next, false);
            } catch (JSONException e) {
                Log.e(TAG, "Reprogrammation d'une alarme impossible après redémarrage", e);
            }
        }
    }
}
