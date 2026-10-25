package io.github.niafrond.printnup;

import android.print.PrintAttributes;

import java.util.List;

/** Réglages d'impression choisis par l'utilisateur (instantané immuable à l'usage). */
final class Options {
    int nup = 2;
    /** Index (0-based) des pages du PDF à imprimer, dans l'ordre. */
    List<Integer> pages;
    PrintAttributes.MediaSize media = PrintAttributes.MediaSize.ISO_A4;
    static final int AUTO = 0, PORTRAIT = 1, LANDSCAPE = 2;
    int orientation = AUTO;
    int dpi = 300;
    boolean mono;
    int marginMm = 8;
    boolean columnMajor;
    boolean border = true;
    int duplex = PrintAttributes.DUPLEX_MODE_NONE;

    int sheetCount() {
        return pages == null ? 0 : (pages.size() + nup - 1) / nup;
    }
}
