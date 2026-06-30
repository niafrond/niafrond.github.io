package io.github.niafrond.djmix;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.MediaBrowserServiceCompat;
import androidx.media.session.MediaButtonReceiver;

import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaControllerCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MediaPlaybackService — expose la file de lecture DJ Mix à Android Auto via
 * MediaBrowserServiceCompat + MediaSessionCompat. Les commandes de transport
 * (lecture, pause, suivant, seek, lecture depuis la file) sont relayées vers le
 * code web (main.js) via MediaSessionPlugin, qui implémente le contrat documenté
 * dans dj-mix/SPECS.md (SPEC-13.5) et exercé par dj-mix/lib/androidAutoBridge.js.
 */
public class MediaPlaybackService extends MediaBrowserServiceCompat {

    private static final String TAG = "MediaPlaybackService";
    private static final String ROOT_ID = "queue";
    private static final String CHANNEL_ID = "djmix_playback";
    private static final int NOTIFICATION_ID = 1;
    private static final String PREFS_NAME = "djmix_media_session";
    private static final String PREF_QUEUE = "queue_json";
    private static final String PREF_METADATA = "metadata_json";

    private static final String ACTION_PLAY = "io.github.niafrond.djmix.action.PLAY";
    private static final String ACTION_PAUSE = "io.github.niafrond.djmix.action.PAUSE";
    private static final String ACTION_NEXT = "io.github.niafrond.djmix.action.NEXT";
    private static final String ACTION_STOP = "io.github.niafrond.djmix.action.STOP";

    /** Reçoit les commandes de transport déclenchées depuis Android Auto / la notification. */
    interface CommandListener {
        void onCommand(String action, Bundle extras);
    }

    private static volatile MediaPlaybackService instance;
    private static volatile CommandListener commandListener;

    static MediaPlaybackService getInstance() {
        return instance;
    }

    static void setCommandListener(CommandListener listener) {
        commandListener = listener;
    }

    private MediaSessionCompat mediaSession;
    private final List<MediaBrowserCompat.MediaItem> queueItems = new ArrayList<>();
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Bitmap currentArtwork;
    private boolean isForeground = false;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        mediaSession = new MediaSessionCompat(this, "DjMixSession");
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS
                        | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setPlaybackState(buildPlaybackState(PlaybackStateCompat.STATE_PAUSED, 0, 1f));
        mediaSession.setCallback(new SessionCallback());

        Intent activityIntent = new Intent(this, MainActivity.class);
        activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, activityIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        mediaSession.setSessionActivity(contentIntent);
        mediaSession.setActive(true);

        setSessionToken(mediaSession.getSessionToken());

        createNotificationChannel();
        restoreState();
    }

    /**
     * Les boutons de la notification ciblent directement ce service plutôt que de
     * passer par un broadcast MediaButtonReceiver + bind temporaire, qui s'est révélé
     * peu fiable sur certains appareils. MediaButtonReceiver reste utilisé pour les
     * vrais boutons matériels (casque, Bluetooth, voiture).
     */
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_PLAY.equals(action)) {
            dispatch("play", null);
        } else if (ACTION_PAUSE.equals(action)) {
            dispatch("pause", null);
        } else if (ACTION_NEXT.equals(action)) {
            dispatch("next", null);
        } else if (ACTION_STOP.equals(action)) {
            dispatch("pause", null);
        } else {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        mediaSession.release();
        ioExecutor.shutdown();
        super.onDestroy();
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        return new BrowserRoot(ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaBrowserCompat.MediaItem>> result) {
        result.sendResult(new ArrayList<>(queueItems));
    }

    // ── API appelée par MediaSessionPlugin ──────────────────────────────────

    static MediaBrowserCompat.MediaItem buildMediaItem(String id, String title, String artist, String artworkUrl) {
        MediaDescriptionCompat.Builder builder = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(artist);
        if (artworkUrl != null && (artworkUrl.startsWith("http://") || artworkUrl.startsWith("https://"))) {
            builder.setIconUri(Uri.parse(artworkUrl));
        }
        return new MediaBrowserCompat.MediaItem(builder.build(), MediaBrowserCompat.MediaItem.FLAG_PLAYABLE);
    }

    void updateQueue(List<MediaBrowserCompat.MediaItem> items) {
        queueItems.clear();
        queueItems.addAll(items);
        notifyChildrenChanged(ROOT_ID);
        persistQueue(items);
    }

    void updateMetadata(MediaMetadataCompat metadata, String artworkUrl) {
        mediaSession.setMetadata(metadata);
        persistMetadata(metadata);
        loadArtwork(artworkUrl, metadata);
    }

    void updatePlaybackState(boolean playing, long positionMs, float speed) {
        int state = playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        mediaSession.setPlaybackState(buildPlaybackState(state, positionMs, speed));
        mediaSession.setActive(true);

        if (playing) {
            ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    buildNotification(),
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                            : 0);
            isForeground = true;
        } else {
            updateNotification();
            if (isForeground) {
                stopForeground(false);
                isForeground = false;
            }
        }
    }

    // ── PlaybackState ─────────────────────────────────────────────────────

    private PlaybackStateCompat buildPlaybackState(int state, long positionMs, float speed) {
        return new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY
                        | PlaybackStateCompat.ACTION_PAUSE
                        | PlaybackStateCompat.ACTION_PLAY_PAUSE
                        | PlaybackStateCompat.ACTION_STOP
                        | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                        | PlaybackStateCompat.ACTION_SEEK_TO
                        | PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID)
                .setState(state, Math.max(0, positionMs), speed)
                .build();
    }

    // ── Notification (MediaStyle) ───────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Lecture DJ Mix", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Contrôles de lecture DJ Mix");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        MediaControllerCompat controller = mediaSession.getController();
        MediaMetadataCompat metadata = controller.getMetadata();
        MediaDescriptionCompat description = metadata != null
                ? metadata.getDescription()
                : new MediaDescriptionCompat.Builder().setTitle("DJ Mix").build();

        PlaybackStateCompat state = controller.getPlaybackState();
        boolean playing = state != null && state.getState() == PlaybackStateCompat.STATE_PLAYING;

        NotificationCompat.Action playPauseAction = playing
                ? new NotificationCompat.Action(
                        android.R.drawable.ic_media_pause, "Pause",
                        buildActionPendingIntent(ACTION_PAUSE, 1))
                : new NotificationCompat.Action(
                        android.R.drawable.ic_media_play, "Lecture",
                        buildActionPendingIntent(ACTION_PLAY, 2));

        NotificationCompat.Action nextAction = new NotificationCompat.Action(
                android.R.drawable.ic_media_next, "Suivant",
                buildActionPendingIntent(ACTION_NEXT, 3));

        PendingIntent stopIntent = buildActionPendingIntent(ACTION_STOP, 4);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(description.getTitle())
                .setContentText(description.getSubtitle())
                .setLargeIcon(currentArtwork)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(mediaSession.getController().getSessionActivity())
                .setDeleteIntent(stopIntent)
                .addAction(playPauseAction)
                .addAction(nextAction)
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1)
                        .setShowCancelButton(true)
                        .setCancelButtonIntent(stopIntent))
                .setOngoing(playing)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    private PendingIntent buildActionPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, MediaPlaybackService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void updateNotification() {
        PlaybackStateCompat state = mediaSession.getController().getPlaybackState();
        if (state == null || state.getState() == PlaybackStateCompat.STATE_NONE) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    // ── Pochette (téléchargement asynchrone) ───────────────────────────────

    private void loadArtwork(String artworkUrl, MediaMetadataCompat baseMetadata) {
        boolean isHttp = artworkUrl != null && (artworkUrl.startsWith("http://") || artworkUrl.startsWith("https://"));
        boolean isDataUri = artworkUrl != null && artworkUrl.startsWith("data:");
        if (!isHttp && !isDataUri) {
            currentArtwork = null;
            updateNotification();
            return;
        }
        ioExecutor.execute(() -> {
            Bitmap bitmap = isDataUri ? decodeDataUri(artworkUrl) : downloadBitmap(artworkUrl);
            mainHandler.post(() -> {
                currentArtwork = bitmap;
                if (bitmap != null) {
                    MediaMetadataCompat enriched = new MediaMetadataCompat.Builder(baseMetadata)
                            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                            .build();
                    mediaSession.setMetadata(enriched);
                }
                updateNotification();
            });
        });
    }

    /**
     * Décode une pochette en data URI (ex. "data:image/jpeg;base64,...") : main.js
     * convertit les URLs blob: (fichiers locaux) sous cette forme avant de les
     * transmettre, car les URLs blob: ne sont résolubles que dans la WebView et un
     * HttpURLConnection natif ne peut pas y accéder directement.
     */
    private Bitmap decodeDataUri(String dataUri) {
        int comma = dataUri.indexOf(',');
        if (comma < 0) return null;
        try {
            byte[] bytes = Base64.decode(dataUri.substring(comma + 1), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            Log.w(TAG, "Failed to decode data URI artwork", e);
            return null;
        }
    }

    private Bitmap downloadBitmap(String urlStr) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(urlStr).openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.connect();
            try (InputStream input = connection.getInputStream()) {
                return BitmapFactory.decodeStream(input);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to download artwork: " + urlStr, e);
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    // ── Persistance (cold start depuis Android Auto) ───────────────────────

    private void persistQueue(List<MediaBrowserCompat.MediaItem> items) {
        try {
            JSONArray array = new JSONArray();
            for (MediaBrowserCompat.MediaItem item : items) {
                MediaDescriptionCompat desc = item.getDescription();
                JSONObject obj = new JSONObject();
                obj.put("id", desc.getMediaId());
                obj.put("title", desc.getTitle() != null ? desc.getTitle().toString() : "");
                obj.put("artist", desc.getSubtitle() != null ? desc.getSubtitle().toString() : "");
                obj.put("artworkUrl", desc.getIconUri() != null ? desc.getIconUri().toString() : "");
                array.put(obj);
            }
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit().putString(PREF_QUEUE, array.toString()).apply();
        } catch (JSONException e) {
            Log.w(TAG, "Failed to persist queue", e);
        }
    }

    private void persistMetadata(MediaMetadataCompat metadata) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("mediaId", metadata.getString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID));
            obj.put("title", metadata.getString(MediaMetadataCompat.METADATA_KEY_TITLE));
            obj.put("artist", metadata.getString(MediaMetadataCompat.METADATA_KEY_ARTIST));
            obj.put("album", metadata.getString(MediaMetadataCompat.METADATA_KEY_ALBUM));
            obj.put("durationMs", metadata.getLong(MediaMetadataCompat.METADATA_KEY_DURATION));
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit().putString(PREF_METADATA, obj.toString()).apply();
        } catch (JSONException e) {
            Log.w(TAG, "Failed to persist metadata", e);
        }
    }

    private void restoreState() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String queueJson = prefs.getString(PREF_QUEUE, null);
        if (queueJson != null) {
            try {
                JSONArray array = new JSONArray(queueJson);
                for (int i = 0; i < array.length(); i++) {
                    JSONObject obj = array.getJSONObject(i);
                    queueItems.add(buildMediaItem(
                            obj.optString("id"),
                            obj.optString("title"),
                            obj.optString("artist"),
                            obj.optString("artworkUrl")));
                }
            } catch (JSONException e) {
                Log.w(TAG, "Failed to restore queue", e);
            }
        }

        String metadataJson = prefs.getString(PREF_METADATA, null);
        if (metadataJson != null) {
            try {
                JSONObject obj = new JSONObject(metadataJson);
                mediaSession.setMetadata(new MediaMetadataCompat.Builder()
                        .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, obj.optString("mediaId"))
                        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, obj.optString("title"))
                        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, obj.optString("artist"))
                        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, obj.optString("album"))
                        .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, obj.optLong("durationMs"))
                        .build());
            } catch (JSONException e) {
                Log.w(TAG, "Failed to restore metadata", e);
            }
        }
    }

    // ── Commandes de transport ───────────────────────────────────────────────

    private class SessionCallback extends MediaSessionCompat.Callback {
        @Override
        public void onPlay() {
            dispatch("play", null);
        }

        @Override
        public void onPause() {
            dispatch("pause", null);
        }

        @Override
        public void onStop() {
            dispatch("pause", null);
        }

        @Override
        public void onSkipToNext() {
            dispatch("next", null);
        }

        @Override
        public void onSeekTo(long pos) {
            Bundle extras = new Bundle();
            extras.putLong("positionMs", pos);
            dispatch("seekTo", extras);
        }

        @Override
        public void onPlayFromMediaId(String mediaId, Bundle extras) {
            Bundle data = new Bundle();
            data.putString("mediaId", mediaId);
            dispatch("playFromMediaId", data);
        }
    }

    /**
     * Relaie une commande vers le code web. Si l'application n'est pas (encore) démarrée
     * — ex. connexion à froid depuis Android Auto — on lance MainActivity, qui transmettra
     * la commande à main.js dès que la WebView sera prête (cf. MediaSessionPlugin.getPendingCommand,
     * appelé par dj-mix/lib/androidAutoBridge.js#getPendingMediaCommand).
     */
    private void dispatch(String action, Bundle extras) {
        CommandListener listener = commandListener;
        if (listener != null) {
            listener.onCommand(action, extras);
            return;
        }

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra(MainActivity.EXTRA_PENDING_COMMAND, action);
        if (extras != null) {
            if (extras.containsKey("mediaId")) {
                launchIntent.putExtra(MainActivity.EXTRA_PENDING_MEDIA_ID, extras.getString("mediaId"));
            }
            if (extras.containsKey("positionMs")) {
                launchIntent.putExtra(MainActivity.EXTRA_PENDING_POSITION_MS, extras.getLong("positionMs"));
            }
        }
        startActivity(launchIntent);
    }
}
