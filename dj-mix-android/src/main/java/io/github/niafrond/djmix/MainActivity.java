package io.github.niafrond.djmix;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — point d'entrée de la WebView Capacitor (PWA DJ Mix).
 * Enregistre les plugins natifs et démarre MediaPlaybackService tôt afin
 * que la session Android Auto existe dès l'ouverture de l'app.
 */
public class MainActivity extends BridgeActivity {

    static final String EXTRA_PENDING_COMMAND = "io.github.niafrond.djmix.PENDING_COMMAND";
    static final String EXTRA_PENDING_MEDIA_ID = "io.github.niafrond.djmix.PENDING_MEDIA_ID";
    static final String EXTRA_PENDING_POSITION_MS = "io.github.niafrond.djmix.PENDING_POSITION_MS";

    private static final int REQUEST_LOCAL_NETWORK_ACCESS = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaSessionPlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        startService(new Intent(this, MediaPlaybackService.class));

        applyImmersiveFullscreen();
        capturePendingCommand(getIntent());
        requestLocalNetworkAccess();
        allowMixedContentForLocalApi();
    }

    /**
     * La WebView Capacitor sert l'app sur https://localhost (androidScheme: "https"),
     * donc fetch() vers l'API HTTP locale (ex. http://192.168.x.x:3000) est bloqué par
     * la politique de "mixed content" par défaut, indépendamment de usesCleartextTraffic
     * dans le manifest.
     */
    private void allowMixedContentForLocalApi() {
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }

    /** Accès au réseau local (Android 16 "Local Network Protections") pour joindre l'API auto-hébergée. */
    private void requestLocalNetworkAccess() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.NEARBY_WIFI_DEVICES)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.NEARBY_WIFI_DEVICES},
                    REQUEST_LOCAL_NETWORK_ACCESS);
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        capturePendingCommand(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyImmersiveFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveFullscreen();
    }

    /**
     * Récupère une commande de transport envoyée par MediaPlaybackService lorsqu'il a dû
     * lancer l'activité à froid (ex. appui sur un bouton média depuis Android Auto avant
     * que l'app soit ouverte). La commande est mémorisée par MediaSessionPlugin et
     * consommée par main.js via getPendingMediaCommand() dès que la WebView est prête.
     */
    private void capturePendingCommand(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(EXTRA_PENDING_COMMAND);
        if (action == null) return;
        String mediaId = intent.getStringExtra(EXTRA_PENDING_MEDIA_ID);
        long positionMs = intent.getLongExtra(EXTRA_PENDING_POSITION_MS, -1);
        MediaSessionPlugin.setPendingCommand(action, mediaId, positionMs);
        intent.removeExtra(EXTRA_PENDING_COMMAND);
    }

    private void applyImmersiveFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat ctrl =
                new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        ctrl.hide(WindowInsetsCompat.Type.systemBars());
        ctrl.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
