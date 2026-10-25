package io.github.niafrond.printnup;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.pdf.PdfRenderer;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;

import java.io.Closeable;
import java.io.File;
import java.io.IOException;

/** Rend les pages d'un PDF en « N pages par feuille » sur un Canvas (unité : point = 1/72"). */
final class NupRenderer implements Closeable {
    /** Plafond de pixels par page rendue, pour éviter les OutOfMemory à 600 dpi. */
    private static final double MAX_PIXELS = 12_000_000d;

    private final ParcelFileDescriptor fd;
    private final PdfRenderer renderer;

    NupRenderer(File file) throws IOException {
        fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
        try {
            renderer = new PdfRenderer(fd);
        } catch (IOException | RuntimeException e) {
            fd.close();
            throw e;
        }
    }

    int pageCount() {
        return renderer.getPageCount();
    }

    /** Rapport largeur/hauteur de la page d'index {@code index}. */
    float aspect(int index) {
        PdfRenderer.Page p = renderer.openPage(index);
        try {
            return (float) p.getWidth() / p.getHeight();
        } finally {
            p.close();
        }
    }

    /** {colonnes, lignes, échelle relative} de la meilleure grille de n cellules. */
    static float[] bestGrid(int n, float w, float h, float aspect) {
        float[] best = {1, n, 0};
        for (int cols = 1; cols <= n; cols++) {
            if (n % cols != 0) continue;
            int rows = n / cols;
            float scale = Math.min(w / cols / aspect, h / rows);
            if (scale > best[2]) best = new float[]{cols, rows, scale};
        }
        return best;
    }

    /** Dimensions {largeur, hauteur} de la feuille en points, orientation incluse. */
    static float[] sheetSize(Options o, float aspect) {
        float a = o.media.getWidthMils() * 72f / 1000f;
        float b = o.media.getHeightMils() * 72f / 1000f;
        float w = Math.min(a, b), h = Math.max(a, b);
        if (o.orientation == Options.LANDSCAPE) return new float[]{h, w};
        if (o.orientation == Options.PORTRAIT) return new float[]{w, h};
        float portrait = bestGrid(o.nup, w, h, aspect)[2];
        float landscape = bestGrid(o.nup, h, w, aspect)[2];
        return landscape > portrait * 1.001f ? new float[]{h, w} : new float[]{w, h};
    }

    /**
     * Dessine la feuille {@code sheet} dans un canvas de {@code w}×{@code h} points.
     * {@code pxPerPt} est la densité de rendu des pages (dpi / 72).
     */
    void drawSheet(Canvas canvas, Options o, int sheet, float w, float h, float pxPerPt,
                   boolean mono, boolean forPrint, CancellationSignal cancel) {
        int n = o.nup;
        float[] grid = bestGrid(n, w, h, aspect(o.pages.get(0)));
        int cols = (int) grid[0], rows = (int) grid[1];
        float margin = o.marginMm * 72f / 25.4f;
        float gap = n > 1 ? 6f : 0f;
        float cw = (w - 2 * margin - (cols - 1) * gap) / cols;
        float ch = (h - 2 * margin - (rows - 1) * gap) / rows;

        Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
        if (mono) {
            ColorMatrix cm = new ColorMatrix();
            cm.setSaturation(0);
            paint.setColorFilter(new ColorMatrixColorFilter(cm));
        }
        Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeWidth(0.5f);
        line.setColor(Color.GRAY);

        for (int k = 0; k < n; k++) {
            if (cancel != null && cancel.isCanceled()) return;
            int idx = sheet * n + k;
            if (idx >= o.pages.size()) break;
            int col = o.columnMajor ? k / rows : k % cols;
            int row = o.columnMajor ? k % rows : k / cols;
            float cx = margin + col * (cw + gap);
            float cy = margin + row * (ch + gap);

            PdfRenderer.Page page = renderer.openPage(o.pages.get(idx));
            try {
                float pw = page.getWidth(), ph = page.getHeight();
                float s = Math.min(cw / pw, ch / ph);
                float dw = pw * s, dh = ph * s;
                float dx = cx + (cw - dw) / 2f, dy = cy + (ch - dh) / 2f;

                double bw = dw * pxPerPt, bh = dh * pxPerPt;
                double over = bw * bh / MAX_PIXELS;
                if (over > 1) {
                    double f = Math.sqrt(over);
                    bw /= f;
                    bh /= f;
                }
                Bitmap bmp = Bitmap.createBitmap(Math.max(1, (int) Math.round(bw)),
                        Math.max(1, (int) Math.round(bh)), Bitmap.Config.ARGB_8888);
                bmp.eraseColor(Color.WHITE);
                page.render(bmp, null, null, forPrint
                        ? PdfRenderer.Page.RENDER_MODE_FOR_PRINT
                        : PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                RectF dst = new RectF(dx, dy, dx + dw, dy + dh);
                canvas.drawBitmap(bmp, null, dst, paint);
                bmp.recycle();
                if (o.border && n > 1) canvas.drawRect(dst, line);
            } finally {
                page.close();
            }
        }
    }

    @Override
    public void close() {
        renderer.close();
        try {
            fd.close();
        } catch (IOException ignored) {
        }
    }
}
