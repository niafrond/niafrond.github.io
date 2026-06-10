package io.github.niafrond.djmix;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String EXTRA_PENDING_COMMAND = "io.github.niafrond.djmix.PENDING_COMMAND";
    public static final String EXTRA_PENDING_MEDIA_ID = "io.github.niafrond.djmix.PENDING_MEDIA_ID";
    public static final String EXTRA_PENDING_POSITION_MS = "io.github.niafrond.djmix.PENDING_POSITION_MS";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaSessionPlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // Keep the screen on during playback
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Démarre le service média tout de suite : la session Android Auto doit
        // exister dès que l'application est lancée, même avant toute lecture.
        startService(new Intent(this, MediaPlaybackService.class));

        applyImmersiveFullscreen();
        capturePendingCommand(getIntent());
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
        if (hasFocus) {
            applyImmersiveFullscreen();
        }
    }

    /**
     * Récupère une commande de transport (play/pause/next/seekTo/playFromMediaId)
     * envoyée par MediaPlaybackService lorsqu'il a dû lancer l'activité à froid
     * (ex. appui sur un bouton média depuis Android Auto avant que l'app soit ouverte).
     * La commande est mémorisée dans MediaSessionPlugin et appliquée par main.js
     * dès que la WebView est prête (voir handleShortcutParameters()).
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
        // Immersive fullscreen: hide status bar and navigation bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat ctrl =
                new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        ctrl.hide(WindowInsetsCompat.Type.systemBars());
        // Bars reappear transiently on swipe, then auto-hide again
        ctrl.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
