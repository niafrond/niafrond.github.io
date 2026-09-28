package io.github.niafrond.reveilxtrem;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Déclenché par le bouton "Snooze" de la notification de sonnerie —
 * fonctionne même sans ouvrir l'appli (aucun calcul requis pour reporter,
 * seul le dismiss dans l'appli exige de résoudre le calcul).
 */
public class SnoozeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID);
        int minutes = intent.getIntExtra(AlarmReceiver.EXTRA_SNOOZE_MINUTES, 9);
        if (alarmId == null) return;
        AlarmActions.snooze(context, alarmId, minutes);
    }
}
