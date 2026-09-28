package io.github.niafrond.reveilxtrem;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmSchedulerPlugin.class);
        super.onCreate(savedInstanceState);

        // L'app doit rester visible/allumée pour pouvoir sonner et afficher
        // le calcul à résoudre, y compris par-dessus l'écran de verrouillage.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        applyImmersiveFullscreen();
        handleRingIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRingIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyImmersiveFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveFullscreen();
        }
    }

    private void applyImmersiveFullscreen() {
        // Immersive fullscreen : masque la barre de statut et la barre de
        // navigation pour ne pas gêner la lecture de l'heure/du calcul.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat ctrl =
                new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        ctrl.hide(WindowInsetsCompat.Type.systemBars());
        ctrl.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    /**
     * Route une alarme qui sonne (notification tapée ou fullScreenIntent
     * lancé par AlarmRingService) vers le JS : mémorise l'id pour un cold
     * start (AlarmScheduler#getPendingRingId, lu au démarrage de main.js) et,
     * si le WebView est déjà chargé (appli déjà ouverte/en arrière-plan),
     * déclenche immédiatement l'événement 'reveilxtrem-ring'.
     */
    private void handleRingIntent(Intent intent) {
        if (intent == null) return;
        String alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID);
        if (alarmId == null) return;

        AlarmSchedulerPlugin.setPendingRingId(alarmId);

        if (getBridge() != null && getBridge().getWebView() != null) {
            String js = "window.dispatchEvent(new CustomEvent('reveilxtrem-ring',{detail:{id:"
                    + JSONObject.quote(alarmId) + "}}));";
            getBridge().getWebView().post(() ->
                    getBridge().getWebView().evaluateJavascript(js, null));
        }
    }
}
