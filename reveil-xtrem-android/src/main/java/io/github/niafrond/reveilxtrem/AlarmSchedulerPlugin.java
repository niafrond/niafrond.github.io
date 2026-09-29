package io.github.niafrond.reveilxtrem;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Pont JS ↔ natif pour la programmation réelle des alarmes (AlarmManager),
 * les autorisations système associées, et la synchronisation des mises à
 * jour décidées côté natif (skipNext consommé, alarme ponctuelle
 * désactivée après sonnerie) vers `localStorage` côté JS.
 *
 * Appelé depuis reveil-xtrem/native-bridge.js via
 * `window.Capacitor.Plugins.AlarmScheduler`.
 */
@CapacitorPlugin(
        name = "AlarmScheduler",
        permissions = {
                @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
        }
)
public class AlarmSchedulerPlugin extends Plugin {

    // Id de l'alarme pour laquelle l'appli vient d'être lancée/ramenée au premier
    // plan via le fullScreenIntent de la notification (cas "cold start").
    private static volatile String pendingRingId = null;

    static void setPendingRingId(String id) {
        pendingRingId = id;
    }

    // ── Programmation ───────────────────────────────────────────────────

    @PluginMethod
    public void syncAlarms(PluginCall call) {
        JSArray arr = call.getArray("alarms");
        if (arr == null) {
            call.reject("Paramètre 'alarms' manquant");
            return;
        }
        Context ctx = getContext();
        try {
            JSONArray alarms = new JSONArray(arr.toString());

            // Annule tout ce qui était programmé avant de reprogrammer depuis l'état à jour.
            JSONArray previous = AlarmStore.loadAlarms(ctx);
            for (int i = 0; i < previous.length(); i++) {
                AlarmActions.cancel(ctx, previous.getJSONObject(i).getString("id"));
            }

            AlarmStore.saveAlarms(ctx, alarms);

            long now = System.currentTimeMillis();
            for (int i = 0; i < alarms.length(); i++) {
                JSONObject alarm = alarms.getJSONObject(i);
                if (!alarm.optBoolean("enabled", false)) continue;
                long next = AlarmMath.nextOccurrenceMillis(alarm, now);
                AlarmActions.scheduleExact(ctx, alarm.getString("id"), next, false);
            }
            call.resolve();
        } catch (JSONException e) {
            call.reject("Synchronisation des alarmes impossible", e);
        }
    }

    @PluginMethod
    public void consumePendingUpdates(PluginCall call) {
        JSONObject updates = AlarmStore.loadPendingUpdates(getContext());
        AlarmStore.clearPendingUpdates(getContext());
        // JSObject#put(String, Object) avale déjà JSONException en interne (elle
        // ne déclare pas throws) : un try/catch autour serait une erreur de compilation.
        JSObject ret = new JSObject();
        ret.put("updates", updates);
        call.resolve(ret);
    }

    @PluginMethod
    public void snooze(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Paramètre 'id' manquant");
            return;
        }
        int minutes = call.getInt("minutes", 9);
        // Nombre de rappels utilisés APRÈS ce snooze (voir native-bridge.js#nativeSnooze) —
        // porté par le prochain déclenchement pour rester correct même appli fermée ensuite.
        int snoozeCount = call.getInt("snoozeCount", 0);
        AlarmActions.snooze(getContext(), id, minutes, snoozeCount);
        call.resolve();
    }

    @PluginMethod
    public void dismiss(PluginCall call) {
        AlarmRingService.stop(getContext());
        call.resolve();
    }

    // ── Sonnerie : sélecteur système Android ────────────────────────────
    // L'utilisateur choisit une sonnerie parmi celles (et les musiques)
    // réellement installées sur son appareil, plutôt qu'un jeu limité de
    // sonneries embarquées dans l'appli.

    @PluginMethod
    public void pickRingtone(PluginCall call) {
        String currentUri = call.getString("uri");
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        Uri defaultUri = RingtoneManager.getActualDefaultRingtoneUri(getContext(), RingtoneManager.TYPE_ALARM);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI, defaultUri);
        if (currentUri != null && !currentUri.isEmpty()) {
            try {
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(currentUri));
            } catch (Exception e) {
                // URI stockée invalide (sonnerie supprimée depuis) : le sélecteur s'ouvre sans présélection.
            }
        }
        startActivityForResult(call, intent, "pickRingtoneResult");
    }

    @ActivityCallback
    private void pickRingtoneResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        Uri picked = null;
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            picked = result.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        }
        // Pas d'URI choisie (annulé, ou "Sonnerie par défaut" sélectionnée) : on
        // retombe sur '' — l'alarme utilisera la sonnerie d'alarme par défaut du système.
        ret.put("uri", picked != null ? picked.toString() : "");
        ret.put("title", picked != null ? ringtoneTitleFor(picked) : null);
        call.resolve(ret);
    }

    @PluginMethod
    public void ringtoneTitle(PluginCall call) {
        String uriStr = call.getString("uri");
        JSObject ret = new JSObject();
        String title = null;
        try {
            Uri uri = (uriStr != null && !uriStr.isEmpty())
                    ? Uri.parse(uriStr)
                    : RingtoneManager.getActualDefaultRingtoneUri(getContext(), RingtoneManager.TYPE_ALARM);
            if (uri != null) title = ringtoneTitleFor(uri);
        } catch (Exception e) {
            // URI invalide/sonnerie supprimée depuis son choix : titre indisponible, non bloquant.
        }
        ret.put("title", title);
        call.resolve(ret);
    }

    private String ringtoneTitleFor(Uri uri) {
        try {
            Ringtone ringtone = RingtoneManager.getRingtone(getContext(), uri);
            return ringtone != null ? ringtone.getTitle(getContext()) : null;
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void getPendingRingId(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("id", pendingRingId);
        pendingRingId = null;
        call.resolve(ret);
    }

    // ── Permission notifications (Android 13+) ─────────────────────────

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ret.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        } else {
            ret.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("notifications", call, "notificationPermCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void notificationPermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    // ── Alarmes exactes (Android 12+) ──────────────────────────────────

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        JSObject ret = new JSObject();
        boolean can = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            can = am != null && am.canScheduleExactAlarms();
        }
        ret.put("granted", can);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    // ── Optimisation de batterie ────────────────────────────────────────

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("granted", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    @SuppressLint("BatteryLife")
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            // Certains OEM bloquent cet intent direct : repli sur l'écran des paramètres de l'appli.
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }
        call.resolve();
    }

    // ── Affichage plein écran par-dessus le verrouillage (Android 14+) ──

    @PluginMethod
    public void canUseFullScreenIntent(PluginCall call) {
        JSObject ret = new JSObject();
        boolean can = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            can = NotificationManagerCompat.from(getContext()).canUseFullScreenIntent();
        }
        ret.put("granted", can);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestFullScreenIntentPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }
}
