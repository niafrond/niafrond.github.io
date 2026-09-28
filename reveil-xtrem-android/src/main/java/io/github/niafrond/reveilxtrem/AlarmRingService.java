package io.github.niafrond.reveilxtrem;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

/**
 * Service au premier plan qui affiche une notification "alarme" prioritaire
 * (son + vibration au niveau OS, indépendants du WebView) avec un
 * `fullScreenIntent` vers MainActivity pour amener l'écran de calcul même
 * par-dessus le verrouillage. Le seul moyen d'arrêter la sonnerie est de
 * résoudre le calcul dans l'appli (dismiss) ou de reporter (snooze, bouton
 * disponible directement sur la notification).
 */
public class AlarmRingService extends Service {

    static final String CHANNEL_ID = "reveilxtrem_alarm";
    private static final int NOTIF_ID = 4201;

    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID);
        String label = intent.getStringExtra(AlarmReceiver.EXTRA_LABEL);
        int snoozeMinutes = intent.getIntExtra(AlarmReceiver.EXTRA_SNOOZE_MINUTES, 9);

        ensureChannel();
        // ServiceCompat gère elle-même les différences d'API selon la version (le type de
        // service au premier plan n'existe qu'à partir de l'API 29) — un appel direct à
        // Service#startForeground(int, Notification, int) planterait sur les appareils plus anciens.
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(alarmId, label, snoozeMinutes),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ReveilXtrem:RingWakeLock");
            wakeLock.acquire(10 * 60 * 1000L); // plafond de sécurité 10 min
        }

        return START_NOT_STICKY;
    }

    private Notification buildNotification(String alarmId, String label, int snoozeMinutes) {
        Intent activityIntent = new Intent(this, MainActivity.class);
        activityIntent.putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId);
        activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent fullScreenPI = PendingIntent.getActivity(
                this, safeHash(alarmId), activityIntent, piFlags);

        Intent snoozeIntent = new Intent(this, SnoozeReceiver.class);
        snoozeIntent.putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId);
        snoozeIntent.putExtra(AlarmReceiver.EXTRA_SNOOZE_MINUTES, snoozeMinutes);
        PendingIntent snoozePI = PendingIntent.getBroadcast(
                this, safeHash(alarmId) + 1, snoozeIntent, piFlags);

        String title = (label == null || label.isEmpty()) ? "Alarme" : label;

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_alarm)
                .setContentTitle("⏰ " + title)
                .setContentText("Ouvrez l'app et résolvez le calcul pour désactiver")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(fullScreenPI, true)
                .setContentIntent(fullScreenPI)
                .addAction(0, "💤 Snooze " + snoozeMinutes + " min", snoozePI)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Alarme", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Sonnerie du réveil");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 400, 200, 400});
        channel.enableLights(true);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        Uri alarmSound = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(alarmSound, attrs);

        nm.createNotificationChannel(channel);
    }

    private static int safeHash(String s) {
        return s == null ? 0 : (s.hashCode() & 0x7FFFFFFF);
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /** Arrête la sonnerie (son, vibration, notification) — appelé au dismiss ou au snooze. */
    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmRingService.class));
        NotificationManagerCompat.from(ctx).cancel(NOTIF_ID);
    }
}
