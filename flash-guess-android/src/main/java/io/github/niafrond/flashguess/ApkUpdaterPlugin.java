package io.github.niafrond.flashguess;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * ApkUpdaterPlugin — télécharge l'APK en arrière-plan via DownloadManager
 * et déclenche l'installation une fois le téléchargement terminé.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final String APK_FILENAME = "flash-guess-update.apk";

    private long downloadId = -1;
    private BroadcastReceiver downloadReceiver;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL manquante");
            return;
        }

        Context ctx = getContext();

        // Supprime l'ancien APK si présent
        File dest = new File(ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILENAME);
        if (dest.exists()) dest.delete();

        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
                .setTitle("Flash Guess — Mise à jour")
                .setDescription("Téléchargement en cours…")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, APK_FILENAME)
                .setMimeType("application/vnd.android.package-archive")
                .setAllowedNetworkTypes(
                        DownloadManager.Request.NETWORK_WIFI |
                        DownloadManager.Request.NETWORK_MOBILE);

        downloadId = dm.enqueue(req);

        // Récepteur de fin de téléchargement
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != downloadId) return;
                try {
                    context.unregisterReceiver(this);
                } catch (Exception ignored) {}
                installApk(context, dest);
            }
        };

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            ctx.registerReceiver(downloadReceiver, filter);
        }

        // Résoudre immédiatement : le téléchargement se fait en arrière-plan
        call.resolve();
    }

    private void installApk(Context ctx, File apkFile) {
        if (!apkFile.exists()) return;
        try {
            Uri apkUri = FileProvider.getUriForFile(
                    ctx,
                    ctx.getPackageName() + ".fileprovider",
                    apkFile);

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception e) {
            // En cas d'échec (ex. permission non accordée), ouvrir l'URL dans le navigateur
            try {
                Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(
                        "https://github.com/niafrond/niafrond.github.io/releases/latest/download/flash-guess.apk"));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
            } catch (Exception ignored) {}
        }
    }
}
