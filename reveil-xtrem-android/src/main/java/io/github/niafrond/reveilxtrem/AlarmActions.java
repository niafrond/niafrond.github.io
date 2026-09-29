package io.github.niafrond.reveilxtrem;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Actions natives partagées (programmer/annuler/reporter une alarme via
 * AlarmManager), utilisées par AlarmSchedulerPlugin, AlarmReceiver,
 * SnoozeReceiver et BootReceiver.
 */
final class AlarmActions {

    private AlarmActions() {}

    static void scheduleExact(Context context, String alarmId, long atMillis, boolean isSnooze) {
        scheduleExact(context, alarmId, atMillis, isSnooze, 0);
    }

    /**
     * @param snoozeCount nombre de rappels déjà utilisés pour l'occurrence en cours —
     *   n'a de sens que pour `isSnooze=true` (une occurrence fraîche démarre toujours à 0) ;
     *   voyage jusqu'à AlarmReceiver/AlarmRingService/SnoozeReceiver via l'intent
     *   plutôt que par un stockage séparé (voir AlarmReceiver#EXTRA_SNOOZE_COUNT).
     */
    static void scheduleExact(Context context, String alarmId, long atMillis, boolean isSnooze, int snoozeCount) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        PendingIntent pi = pendingIntentFor(context, alarmId, isSnooze, snoozeCount);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            // Pas d'autorisation "alarmes exactes" : repli sur une alarme non garantie
            // à la minute près plutôt que de ne rien programmer du tout.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, atMillis, pi);
        }
    }

    static void cancel(Context context, String alarmId) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent normal = pendingIntentFor(context, alarmId, false, 0);
        am.cancel(normal);
        normal.cancel();
        PendingIntent snooze = pendingIntentFor(context, alarmId, true, 0);
        am.cancel(snooze);
        snooze.cancel();
    }

    /**
     * Arrête la sonnerie en cours et reprogramme une sonnerie unique dans `minutes` minutes.
     * @param nextSnoozeCount nombre de rappels utilisés APRÈS ce snooze (donc le compte
     *   précédent + 1) — porté par le prochain déclenchement pour que la limite et la
     *   réduction progressive restent correctes même appli fermée.
     */
    static void snooze(Context context, String alarmId, int minutes, int nextSnoozeCount) {
        AlarmRingService.stop(context);
        long fireAt = System.currentTimeMillis() + minutes * 60_000L;
        scheduleExact(context, alarmId, fireAt, true, nextSnoozeCount);
    }

    private static PendingIntent pendingIntentFor(Context context, String alarmId, boolean isSnooze, int snoozeCount) {
        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId);
        intent.putExtra(AlarmReceiver.EXTRA_IS_SNOOZE, isSnooze);
        intent.putExtra(AlarmReceiver.EXTRA_SNOOZE_COUNT, snoozeCount);
        int requestCode = (alarmId.hashCode() & 0x7FFFFFFF) ^ (isSnooze ? 0x5A5A5A : 0);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(context, requestCode, intent, flags);
    }
}
