package io.github.niafrond.djmix;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * ApkUpdaterPlugin — télécharge une nouvelle version de l'APK DJ Mix en arrière-plan via
 * DownloadManager, puis déclenche l'installation via un intent ACTION_VIEW sur l'URI
 * exposée par le FileProvider (déclaré par le script de patch du manifeste, cf.
 * .github/workflows/apk-djmix.yml). Nécessite android.permission.REQUEST_INSTALL_PACKAGES.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final String TAG = "ApkUpdaterPlugin";
    private static final String APK_FILENAME = "dj-mix-update.apk";

    private long pendingDownloadId = -1;
    private BroadcastReceiver downloadReceiver;

    /** Doit s'appeler "downloadAndInstall" : c'est le nom appelé côté JS par dj-mix/pwa.js#doApkUpdate(). */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing 'url'");
            return;
        }

        Context context = getContext();
        DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) {
            call.reject("DownloadManager unavailable");
            return;
        }

        File destination = new File(
                context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILENAME);
        if (destination.exists()) destination.delete();

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                .setTitle("Mise à jour DJ Mix")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationUri(Uri.fromFile(destination))
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true);

        registerDownloadReceiver(destination);
        pendingDownloadId = manager.enqueue(request);

        JSObject result = new JSObject();
        result.put("downloadId", pendingDownloadId);
        call.resolve(result);
    }

    private void registerDownloadReceiver(File destination) {
        if (downloadReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadReceiver);
            } catch (IllegalArgumentException ignored) {
                // déjà désenregistré
            }
        }

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != pendingDownloadId) return;
                context.unregisterReceiver(this);
                downloadReceiver = null;
                installApk(destination);
            }
        };

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? Context.RECEIVER_NOT_EXPORTED
                : 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(
                    downloadReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    flags);
        } else {
            getContext().registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }
    }

    /** Lance l'installation via le FileProvider déclaré dans res/xml/file_paths.xml. */
    private void installApk(File apkFile) {
        if (!apkFile.exists()) {
            Log.w(TAG, "Downloaded APK not found: " + apkFile);
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", apkFile);

        Intent installIntent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(installIntent);
    }
}
