package io.github.niafrond.printnup;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.pdf.PrintedPdfDocument;
import android.graphics.pdf.PdfDocument;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;

/** Fournit au service d'impression Android (Epson, Mopria…) les feuilles N-up. */
final class NupAdapter extends PrintDocumentAdapter {
    private final Context context;
    private final File file;
    private final Options options;
    private final String name;
    private volatile PrintAttributes attributes;

    NupAdapter(Context context, File file, Options options, String name) {
        this.context = context;
        this.file = file;
        this.options = options;
        this.name = name;
    }

    @Override
    public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                         CancellationSignal cancel, LayoutResultCallback callback, Bundle extras) {
        if (cancel.isCanceled()) {
            callback.onLayoutCancelled();
            return;
        }
        attributes = newAttributes;
        PrintDocumentInfo info = new PrintDocumentInfo.Builder(name)
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(options.sheetCount())
                .build();
        callback.onLayoutFinished(info, !newAttributes.equals(oldAttributes));
    }

    @Override
    public void onWrite(PageRange[] ranges, ParcelFileDescriptor destination,
                        CancellationSignal cancel, WriteResultCallback callback) {
        final PrintAttributes attrs = attributes;
        new Thread(() -> write(ranges, destination, cancel, callback, attrs), "nup-write").start();
    }

    private void write(PageRange[] ranges, ParcelFileDescriptor destination,
                       CancellationSignal cancel, WriteResultCallback callback,
                       PrintAttributes attrs) {
        PrintedPdfDocument doc = new PrintedPdfDocument(context, attrs);
        try (NupRenderer renderer = new NupRenderer(file)) {
            boolean mono = attrs.getColorMode() == PrintAttributes.COLOR_MODE_MONOCHROME;
            PrintAttributes.Resolution res = attrs.getResolution();
            int dpi = res != null ? Math.max(res.getHorizontalDpi(), 72) : options.dpi;
            float ppp = dpi / 72f;

            int total = options.sheetCount();
            int out = 0;
            for (int sheet : sheetsIn(ranges, total)) {
                if (cancel.isCanceled()) {
                    callback.onWriteCancelled();
                    return;
                }
                PdfDocument.Page page = doc.startPage(out++);
                renderer.drawSheet(page.getCanvas(), options,
                        sheet, doc.getPageWidth(), doc.getPageHeight(), ppp, mono, true, cancel);
                doc.finishPage(page);
            }
            try (FileOutputStream os = new FileOutputStream(destination.getFileDescriptor())) {
                doc.writeTo(os);
            }
            callback.onWriteFinished(ranges);
        } catch (Exception e) {
            callback.onWriteFailed(e.getMessage());
        } finally {
            doc.close();
            try {
                destination.close();
            } catch (Exception ignored) {
            }
        }
    }

    /** Indices de feuilles (0-based) demandés par le dialogue d'impression. */
    private static List<Integer> sheetsIn(PageRange[] ranges, int total) {
        List<Integer> out = new ArrayList<>();
        for (PageRange r : ranges) {
            int start = Math.max(0, r.getStart());
            int end = Math.min(total - 1, r.getEnd());
            for (int i = start; i <= end; i++) out.add(i);
        }
        return out;
    }
}
