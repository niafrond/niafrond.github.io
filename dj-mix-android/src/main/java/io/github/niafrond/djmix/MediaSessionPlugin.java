package io.github.niafrond.djmix;

import android.os.Bundle;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaMetadataCompat;

import java.util.ArrayList;
import java.util.List;

/**
 * MediaSessionPlugin — pont Capacitor "MediaSession" entre dj-mix/lib/androidAutoBridge.js
 * et MediaPlaybackService, qui expose la lecture à Android Auto.
 *
 * Le nom du plugin et la forme des appels (updateMetadata/updatePlaybackState/updateQueue/
 * getPendingCommand, événement "mediaCommand") doivent rester strictement alignés sur le
 * contrat JS documenté dans dj-mix/SPECS.md (SPEC-13.5) — c'est cette correspondance qui
 * permet à main.js de piloter Android Auto sans connaître les détails natifs.
 */
@CapacitorPlugin(name = "MediaSession")
public class MediaSessionPlugin extends Plugin {

    private static volatile String pendingAction;
    private static volatile String pendingMediaId;
    private static volatile long pendingPositionMs = -1;

    /** Mémorise une commande reçue à froid, avant que la WebView ne soit prête. */
    static void setPendingCommand(String action, String mediaId, long positionMs) {
        pendingAction = action;
        pendingMediaId = mediaId;
        pendingPositionMs = positionMs;
    }

    @Override
    public void load() {
        getActivity().startService(new android.content.Intent(getContext(), MediaPlaybackService.class));

        MediaPlaybackService.setCommandListener((action, extras) -> {
            JSObject data = new JSObject();
            data.put("action", action);
            if (extras != null) {
                if (extras.containsKey("mediaId")) data.put("mediaId", extras.getString("mediaId"));
                if (extras.containsKey("positionMs")) data.put("positionMs", extras.getLong("positionMs"));
            }
            notifyListeners("mediaCommand", data);
        });
    }

    /** Renvoie puis consomme une commande en attente (cold start depuis Android Auto). */
    @PluginMethod
    public void getPendingCommand(PluginCall call) {
        JSObject data = new JSObject();
        String action = pendingAction;
        if (action != null) {
            data.put("action", action);
            if (pendingMediaId != null) data.put("mediaId", pendingMediaId);
            if (pendingPositionMs >= 0) data.put("positionMs", pendingPositionMs);
            pendingAction = null;
            pendingMediaId = null;
            pendingPositionMs = -1;
        }
        call.resolve(data);
    }

    /** Reçoit { id, title, artist, album, artworkUrl, durationMs } depuis pushNowPlaying(). */
    @PluginMethod
    public void updateMetadata(PluginCall call) {
        MediaPlaybackService service = MediaPlaybackService.getInstance();
        if (service == null) {
            call.resolve();
            return;
        }

        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, call.getString("id", ""))
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, call.getString("title", "DJ Mix"))
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, call.getString("artist", ""))
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, call.getString("album", "DJ Mix"))
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, call.getDouble("durationMs", 0d).longValue())
                .build();

        service.updateMetadata(metadata, call.getString("artworkUrl", ""));
        call.resolve();
    }

    /** Reçoit { playing, positionMs, speed } depuis pushPlaybackState(). */
    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        MediaPlaybackService service = MediaPlaybackService.getInstance();
        if (service == null) {
            call.resolve();
            return;
        }

        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        long positionMs = call.getDouble("positionMs", 0d).longValue();
        float speed = call.getDouble("speed", 1d).floatValue();
        service.updatePlaybackState(playing, positionMs, speed);
        call.resolve();
    }

    /** Reçoit { items: [{ id, title, artist, artworkUrl }] } depuis pushQueue(). */
    @PluginMethod
    public void updateQueue(PluginCall call) {
        MediaPlaybackService service = MediaPlaybackService.getInstance();
        if (service == null) {
            call.resolve();
            return;
        }

        JSArray itemsArray = call.getArray("items");
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
        if (itemsArray != null) {
            try {
                for (int i = 0; i < itemsArray.length(); i++) {
                    JSONObject obj = itemsArray.getJSONObject(i);
                    items.add(MediaPlaybackService.buildMediaItem(
                            obj.optString("id"),
                            obj.optString("title"),
                            obj.optString("artist"),
                            obj.optString("artworkUrl")));
                }
            } catch (JSONException ignored) {
                // entrée malformée : on ignore simplement cet élément
            }
        }
        service.updateQueue(items);
        call.resolve();
    }
}
