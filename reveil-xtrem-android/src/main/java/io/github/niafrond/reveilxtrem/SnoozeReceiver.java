package io.github.niafrond.reveilxtrem;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Déclenché par le bouton "Snooze" de la notification de sonnerie —
 * fonctionne même sans ouvrir l'appli (aucun calcul requis pour reporter,
 * seul le dismiss dans l'appli exige de résoudre le calcul). N'apparaît pas
 * du tout sur la notification une fois la limite de rappels atteinte — voir
 * AlarmRingService#buildNotification — mais reste défensif ici aussi.
 */
public class SnoozeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID);
        if (alarmId == null) return;
        // Minutes et compte déjà calculés par AlarmRingService au moment de
        // construire la notification (intervalle dégressif éventuel déjà appliqué).
        int minutes = intent.getIntExtra(AlarmReceiver.EXTRA_SNOOZE_MINUTES, 9);
        int nextSnoozeCount = intent.getIntExtra(AlarmReceiver.EXTRA_SNOOZE_COUNT, 1);
        AlarmActions.snooze(context, alarmId, minutes, nextSnoozeCount);
    }
}
