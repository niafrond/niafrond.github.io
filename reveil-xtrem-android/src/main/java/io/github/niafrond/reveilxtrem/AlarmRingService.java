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

    private static final String CHANNEL_ID_PREFIX = "reveilxtrem_alarm_";
    private static final String CHANNEL_ID_DEFAULT = CHANNEL_ID_PREFIX + "default";
    private static final long[] VIBRATION_PATTERN = {0, 400, 200, 400, 200, 400, 200, 400};
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
        // URI d'une sonnerie choisie via le sélecteur système, ou '' (et toute
        // valeur qui n'est pas une URI, ex. un ancien id de sonnerie web) pour
        // la sonnerie d'alarme par défaut du système — voir ensureChannel().
        String soundUri = intent.getStringExtra(AlarmReceiver.EXTRA_SOUND);

        String channelId = ensureChannel(soundUri);
        // ServiceCompat gère elle-même les différences d'API selon la version (le type de
        // service au premier plan n'existe qu'à partir de l'API 29) — un appel direct à
        // Service#startForeground(int, Notification, int) planterait sur les appareils plus anciens.
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(alarmId, label, snoozeMinutes, channelId),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ReveilXtrem:RingWakeLock");
            wakeLock.acquire(10 * 60 * 1000L); // plafond de sécurité 10 min
        }

        return START_NOT_STICKY;
    }

    private Notification buildNotification(String alarmId, String label, int snoozeMinutes, String channelId) {
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

        return new NotificationCompat.Builder(this, channelId)
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

    // Le son d'un NotificationChannel est figé à sa création (Android ne permet pas
    // de le changer ensuite) — un canal distinct par sonnerie choisie (URI issue du
    // sélecteur système, voir AlarmSchedulerPlugin#pickRingtone) est donc créé à la
    // demande. Retourne l'id du canal effectivement utilisé.
    private String ensureChannel(String soundUri) {
        String channelId = (soundUri != null && !soundUri.isEmpty())
                ? CHANNEL_ID_PREFIX + safeHash(soundUri)
                : CHANNEL_ID_DEFAULT;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return channelId;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(channelId) != null) return channelId;

        NotificationChannel channel = new NotificationChannel(
                channelId, "Alarme", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Sonnerie du réveil");
        channel.enableVibration(true);
        channel.setVibrationPattern(VIBRATION_PATTERN);
        channel.enableLights(true);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        Uri sound = resolveSoundUri(soundUri);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(sound, attrs);

        nm.createNotificationChannel(channel);
        return channelId;
    }

    // Une valeur non vide sans schéma d'URI (ex. un ancien id de sonnerie web
    // "classic" d'avant le sélecteur système) n'est pas une URI valide : on
    // retombe alors sur la sonnerie d'alarme par défaut du système, un repli sûr.
    private Uri resolveSoundUri(String soundUri) {
        if (soundUri != null && !soundUri.isEmpty() && soundUri.contains("://")) {
            try {
                return Uri.parse(soundUri);
            } catch (Exception e) {
                // URI invalide (sonnerie supprimée depuis son choix) : repli par défaut ci-dessous.
            }
        }
        Uri fallback = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
        if (fallback == null) fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        return fallback;
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
