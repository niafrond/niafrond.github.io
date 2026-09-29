package io.github.niafrond.reveilxtrem;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Reçoit le déclenchement exact d'AlarmManager (survit à un kill de
 * l'appli, pas à un "Forcer l'arrêt" — restriction OS, aucune appli ne
 * peut la contourner).
 *
 * Décide, à partir du miroir natif des alarmes (AlarmStore), si l'alarme
 * doit réellement sonner, si son "passer la prochaine" doit être consommé
 * silencieusement, ou si elle est obsolète (supprimée/désactivée depuis sa
 * programmation) — puis démarre AlarmRingService et reprogramme la
 * prochaine occurrence pour les alarmes récurrentes.
 */
public class AlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "AlarmReceiver";

    public static final String EXTRA_ALARM_ID = "alarmId";
    public static final String EXTRA_IS_SNOOZE = "isSnooze";
    public static final String EXTRA_LABEL = "label";
    public static final String EXTRA_DIFFICULTY = "difficulty";
    public static final String EXTRA_SNOOZE_MINUTES = "snoozeMinutes";
    public static final String EXTRA_SOUND = "sound";
    // Nombre de rappels déjà utilisés pour l'occurrence en cours — voyage
    // dans la chaîne d'intents AlarmManager (pas de stockage séparé) : une
    // occurrence fraîche (isSnooze=false) ne le porte jamais (0 implicite),
    // et chaque snooze programme le suivant avec le compte déjà incrémenté
    // (voir AlarmActions#snooze, AlarmRingService, SnoozeReceiver).
    public static final String EXTRA_SNOOZE_COUNT = "snoozeCount";
    public static final String EXTRA_SNOOZE_LIMIT = "snoozeLimit";
    public static final String EXTRA_SNOOZE_DECREASE_MINUTES = "snoozeDecreaseMinutes";
    public static final String EXTRA_AUTO_DISMISS_MINUTES = "autoDismissMinutes";

    @Override
    public void onReceive(Context context, Intent intent) {
        String alarmId = intent.getStringExtra(EXTRA_ALARM_ID);
        boolean isSnooze = intent.getBooleanExtra(EXTRA_IS_SNOOZE, false);
        int snoozeCount = intent.getIntExtra(EXTRA_SNOOZE_COUNT, 0);
        if (alarmId == null) return;

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm != null
                ? pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ReveilXtrem:AlarmFireWakeLock")
                : null;
        if (wakeLock != null) wakeLock.acquire(15_000L);

        try {
            JSONArray alarms = AlarmStore.loadAlarms(context);
            JSONObject alarm = AlarmStore.findById(alarms, alarmId);
            if (alarm == null) return; // supprimée depuis sa programmation

            if (!isSnooze) {
                if (!alarm.optBoolean("enabled", false)) return; // désactivée depuis

                JSONArray days = alarm.optJSONArray("days");
                boolean oneTime = days == null || days.length() == 0;
                boolean skipNext = alarm.optBoolean("skipNext", false);

                if (skipNext) {
                    consumeSkip(context, alarms, alarm, oneTime);
                    return; // ne sonne pas cette occurrence-ci
                }

                if (oneTime) {
                    alarm.put("enabled", false);
                    JSONObject patch = new JSONObject().put("enabled", false);
                    AlarmStore.addPendingUpdate(context, alarmId, patch);
                } else {
                    long next = AlarmMath.nextOccurrenceMillis(alarm, System.currentTimeMillis());
                    AlarmActions.scheduleExact(context, alarmId, next, false);
                }
                AlarmStore.saveAlarms(context, alarms);
            }

            startRingService(context, alarmId, alarm, snoozeCount);
        } catch (JSONException e) {
            Log.e(TAG, "Traitement de l'alarme " + alarmId + " impossible", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        }
    }

    private void consumeSkip(Context context, JSONArray alarms, JSONObject alarm, boolean oneTime)
            throws JSONException {
        String alarmId = alarm.getString("id");
        alarm.put("skipNext", false);
        JSONObject patch = new JSONObject().put("skipNext", false);
        if (oneTime) {
            alarm.put("enabled", false);
            patch.put("enabled", false);
        } else {
            long next = AlarmMath.nextOccurrenceMillis(alarm, System.currentTimeMillis());
            AlarmActions.scheduleExact(context, alarmId, next, false);
        }
        AlarmStore.addPendingUpdate(context, alarmId, patch);
        AlarmStore.saveAlarms(context, alarms);
    }

    private void startRingService(Context context, String alarmId, JSONObject alarm, int snoozeCount) {
        Intent svc = new Intent(context, AlarmRingService.class);
        svc.putExtra(EXTRA_ALARM_ID, alarmId);
        svc.putExtra(EXTRA_LABEL, alarm.optString("label", "Alarme"));
        svc.putExtra(EXTRA_DIFFICULTY, alarm.optString("difficulty", "easy"));
        svc.putExtra(EXTRA_SNOOZE_MINUTES, alarm.optInt("snoozeMinutes", 9));
        // 'sound' est l'URI d'une sonnerie choisie via le sélecteur système
        // (RingtoneManager), ou '' pour la sonnerie d'alarme par défaut du
        // système — voir AlarmSchedulerPlugin#pickRingtone. Une ancienne
        // valeur d'avant ce sélecteur (id de sonnerie web, ex. "classic")
        // n'est pas une URI valide : AlarmRingService retombe alors sur la
        // sonnerie par défaut, ce qui reste un comportement sûr.
        svc.putExtra(EXTRA_SOUND, alarm.optString("sound", ""));
        // Réglages avancés façon Alarm Clock Xtreme (0 = illimité/jamais,
        // comportement historique) — voir reveil-xtrem/alarms.js pour le pendant JS.
        svc.putExtra(EXTRA_SNOOZE_LIMIT, alarm.optInt("snoozeLimit", 0));
        svc.putExtra(EXTRA_SNOOZE_DECREASE_MINUTES, alarm.optInt("snoozeDecreaseMinutes", 0));
        svc.putExtra(EXTRA_AUTO_DISMISS_MINUTES, alarm.optInt("autoDismissMinutes", 0));
        svc.putExtra(EXTRA_SNOOZE_COUNT, snoozeCount);
        ContextCompat.startForegroundService(context, svc);
    }
}
