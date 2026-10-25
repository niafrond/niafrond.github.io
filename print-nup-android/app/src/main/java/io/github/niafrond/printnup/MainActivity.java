package io.github.niafrond.printnup;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.OpenableColumns;
import android.database.Cursor;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int REQ_OPEN = 1;

    private static final int[] NUPS = {1, 2, 3, 4, 6, 8, 9, 16};
    private static final String[] PAPER_NAMES = {"A4", "A3", "A5", "B5", "Letter", "Legal"};
    private static final PrintAttributes.MediaSize[] PAPERS = {
            PrintAttributes.MediaSize.ISO_A4, PrintAttributes.MediaSize.ISO_A3,
            PrintAttributes.MediaSize.ISO_A5, PrintAttributes.MediaSize.ISO_B5,
            PrintAttributes.MediaSize.NA_LETTER, PrintAttributes.MediaSize.NA_LEGAL};
    private static final String[] ORIENTATIONS = {"Automatique (la mieux adaptée)", "Portrait", "Paysage"};
    private static final String[] QUALITIES = {"Brouillon (150 dpi)", "Normal (300 dpi)", "Haute (600 dpi)"};
    private static final int[] DPIS = {150, 300, 600};
    private static final String[] COLORS = {"Couleur", "Noir et blanc"};
    private static final String[] MARGINS = {"Aucune (risque de coupe)", "Faible (4 mm)", "Normale (8 mm)", "Large (15 mm)"};
    private static final int[] MARGIN_MM = {0, 4, 8, 15};
    private static final String[] ORDERS = {"Lignes (→ puis ↓)", "Colonnes (↓ puis →)"};
    private static final String[] DUPLEX = {"Recto seul", "Recto-verso bord long", "Recto-verso bord court"};
    private static final int[] DUPLEX_MODES = {PrintAttributes.DUPLEX_MODE_NONE,
            PrintAttributes.DUPLEX_MODE_LONG_EDGE, PrintAttributes.DUPLEX_MODE_SHORT_EDGE};

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private File doc;
    private String docName = "document";
    private int docPages;
    private int previewSheet;
    private int previewGen;

    private TextView fileInfo, sheetLabel;
    private ImageView preview;
    private EditText pagesEdit;
    private Spinner nupSp, paperSp, orientSp, qualitySp, colorSp, marginSp, orderSp, duplexSp;
    private CheckBox borderCb;
    private Button printBtn;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        buildUi();
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    @Override
    protected void onDestroy() {
        worker.shutdownNow();
        super.onDestroy();
    }

    // ---------------------------------------------------------------- UI

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(12), dp(16), dp(16));

        Button open = new Button(this);
        open.setText("Choisir un PDF…");
        open.setOnClickListener(v -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("application/pdf");
            startActivityForResult(i, REQ_OPEN);
        });
        root.addView(open);

        fileInfo = new TextView(this);
        fileInfo.setText("Aucun document. Ouvrez un PDF ou partagez-le vers cette application.");
        fileInfo.setPadding(0, dp(6), 0, dp(6));
        root.addView(fileInfo);

        preview = new ImageView(this);
        preview.setBackgroundColor(Color.LTGRAY);
        preview.setPadding(dp(4), dp(4), dp(4), dp(4));
        preview.setAdjustViewBounds(true);
        preview.setScaleType(ImageView.ScaleType.FIT_CENTER);
        root.addView(preview, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(300)));

        LinearLayout nav = new LinearLayout(this);
        nav.setGravity(Gravity.CENTER);
        Button prev = new Button(this);
        prev.setText("◀");
        prev.setOnClickListener(v -> stepPreview(-1));
        Button next = new Button(this);
        next.setText("▶");
        next.setOnClickListener(v -> stepPreview(1));
        sheetLabel = new TextView(this);
        sheetLabel.setGravity(Gravity.CENTER);
        sheetLabel.setMinWidth(dp(140));
        nav.addView(prev);
        nav.addView(sheetLabel);
        nav.addView(next);
        root.addView(nav);

        addLabel(root, "Pages à imprimer (ex. 1-3,5,8- ; vide = toutes)");
        pagesEdit = new EditText(this);
        pagesEdit.setHint("toutes");
        pagesEdit.setSingleLine();
        pagesEdit.setInputType(InputType.TYPE_CLASS_TEXT);
        pagesEdit.setOnFocusChangeListener((v, hasFocus) -> {
            if (!hasFocus) refreshPreview();
        });
        pagesEdit.setOnEditorActionListener((v, actionId, e) -> {
            refreshPreview();
            return false;
        });
        root.addView(pagesEdit);

        String[] nupNames = new String[NUPS.length];
        for (int i = 0; i < NUPS.length; i++) {
            nupNames[i] = NUPS[i] == 1 ? "1 page par feuille" : NUPS[i] + " pages par feuille";
        }
        nupSp = addSpinner(root, "Pages par feuille", nupNames, 1);
        paperSp = addSpinner(root, "Format du papier", PAPER_NAMES, 0);
        orientSp = addSpinner(root, "Orientation de la feuille", ORIENTATIONS, 0);
        qualitySp = addSpinner(root, "Qualité", QUALITIES, 1);
        colorSp = addSpinner(root, "Couleur", COLORS, 0);
        duplexSp = addSpinner(root, "Recto-verso", DUPLEX, 0);
        marginSp = addSpinner(root, "Marges", MARGINS, 2);
        orderSp = addSpinner(root, "Ordre des pages sur la feuille", ORDERS, 0);

        borderCb = new CheckBox(this);
        borderCb.setText("Cadre autour de chaque page");
        borderCb.setChecked(true);
        borderCb.setOnCheckedChangeListener((b, c) -> refreshPreview());
        root.addView(borderCb);

        TextView hint = new TextView(this);
        hint.setText("Le nombre de copies, la sélection d'imprimante et les réglages propres à "
                + "l'Epson (qualité, bac…) s'ajustent ensuite dans la fenêtre d'impression Android.");
        hint.setTextSize(12);
        hint.setPadding(0, dp(10), 0, dp(6));
        root.addView(hint);

        printBtn = new Button(this);
        printBtn.setText("Imprimer…");
        printBtn.setEnabled(false);
        printBtn.setOnClickListener(v -> print());
        root.addView(printBtn);

        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.addView(root);
        setContentView(sv);
    }

    private void addLabel(LinearLayout parent, String text) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextSize(13);
        t.setPadding(0, dp(10), 0, 0);
        parent.addView(t);
    }

    private Spinner addSpinner(LinearLayout parent, String label, String[] items, int selected) {
        addLabel(parent, label);
        Spinner sp = new Spinner(this);
        ArrayAdapter<String> ad = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, items);
        ad.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sp.setAdapter(ad);
        sp.setSelection(selected);
        sp.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> p, View v, int pos, long id) {
                refreshPreview();
            }

            @Override
            public void onNothingSelected(AdapterView<?> p) {
            }
        });
        parent.addView(sp);
        return sp;
    }

    // ------------------------------------------------------- chargement

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_OPEN && res == RESULT_OK && data != null && data.getData() != null) {
            load(data.getData());
        }
    }

    @SuppressWarnings("deprecation")
    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri != null) load(uri);
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0 && c.getString(i) != null) return c.getString(i);
            }
        } catch (Exception ignored) {
        }
        String seg = uri.getLastPathSegment();
        return seg != null ? seg : "document.pdf";
    }

    private void load(Uri uri) {
        fileInfo.setText("Chargement…");
        printBtn.setEnabled(false);
        worker.execute(() -> {
            try {
                File dest = new File(getCacheDir(), "document.pdf");
                try (InputStream in = getContentResolver().openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(dest)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                int count;
                try (NupRenderer r = new NupRenderer(dest)) {
                    count = r.pageCount();
                }
                String name = displayName(uri);
                runOnUiThread(() -> {
                    doc = dest;
                    docName = name;
                    docPages = count;
                    previewSheet = 0;
                    pagesEdit.setText("");
                    fileInfo.setText(name + " — " + count + " page" + (count > 1 ? "s" : ""));
                    refreshPreview();
                });
            } catch (SecurityException e) {
                toastUi("PDF protégé par mot de passe : non pris en charge");
                runOnUiThread(() -> fileInfo.setText("Document illisible (protégé ?)"));
            } catch (Exception e) {
                toastUi("Impossible d'ouvrir ce PDF : " + e.getMessage());
                runOnUiThread(() -> fileInfo.setText("Document illisible"));
            }
        });
    }

    private void toastUi(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
    }

    // --------------------------------------------------------- réglages

    /** Pages « 1-3,5,8- » → index 0-based ; null si invalide (message affiché). */
    private List<Integer> parsePages(String spec) {
        List<Integer> out = new ArrayList<>();
        spec = spec.trim();
        if (spec.isEmpty()) {
            for (int i = 0; i < docPages; i++) out.add(i);
            return out;
        }
        try {
            for (String part : spec.split("[,;\\s]+")) {
                if (part.isEmpty()) continue;
                int dash = part.indexOf('-');
                int from, to;
                if (dash < 0) {
                    from = to = Integer.parseInt(part);
                } else {
                    String a = part.substring(0, dash), b = part.substring(dash + 1);
                    from = a.isEmpty() ? 1 : Integer.parseInt(a);
                    to = b.isEmpty() ? docPages : Integer.parseInt(b);
                }
                if (from < 1 || to > docPages || from > to) throw new NumberFormatException();
                for (int p = from; p <= to; p++) out.add(p - 1);
            }
        } catch (NumberFormatException e) {
            Toast.makeText(this, "Pages invalides (le document en compte " + docPages + ")",
                    Toast.LENGTH_LONG).show();
            return null;
        }
        return out.isEmpty() ? null : out;
    }

    private Options readOptions() {
        List<Integer> pages = parsePages(pagesEdit.getText().toString());
        if (pages == null) return null;
        Options o = new Options();
        o.pages = pages;
        o.nup = NUPS[nupSp.getSelectedItemPosition()];
        o.media = PAPERS[paperSp.getSelectedItemPosition()];
        o.orientation = orientSp.getSelectedItemPosition();
        o.dpi = DPIS[qualitySp.getSelectedItemPosition()];
        o.mono = colorSp.getSelectedItemPosition() == 1;
        o.duplex = DUPLEX_MODES[duplexSp.getSelectedItemPosition()];
        o.marginMm = MARGIN_MM[marginSp.getSelectedItemPosition()];
        o.columnMajor = orderSp.getSelectedItemPosition() == 1;
        o.border = borderCb.isChecked();
        return o;
    }

    // ----------------------------------------------------------- aperçu

    private void stepPreview(int d) {
        if (doc == null) return;
        previewSheet += d;
        refreshPreview();
    }

    private void refreshPreview() {
        if (doc == null || preview == null) return;
        Options o = readOptions();
        if (o == null) {
            printBtn.setEnabled(false);
            return;
        }
        int sheets = o.sheetCount();
        previewSheet = Math.max(0, Math.min(previewSheet, sheets - 1));
        sheetLabel.setText("Feuille " + (previewSheet + 1) + " / " + sheets);
        printBtn.setEnabled(true);
        final int gen = ++previewGen;
        final int sheet = previewSheet;
        final File file = doc;
        worker.execute(() -> {
            try (NupRenderer r = new NupRenderer(file)) {
                float[] size = NupRenderer.sheetSize(o, r.aspect(o.pages.get(0)));
                float scale = 900f / Math.max(size[0], size[1]);
                Bitmap bmp = Bitmap.createBitmap(Math.round(size[0] * scale),
                        Math.round(size[1] * scale), Bitmap.Config.ARGB_8888);
                bmp.eraseColor(Color.WHITE);
                Canvas c = new Canvas(bmp);
                c.scale(scale, scale);
                if (gen != previewGen) return;
                r.drawSheet(c, o, sheet, size[0], size[1], scale, o.mono, false, null);
                runOnUiThread(() -> {
                    if (gen == previewGen) preview.setImageBitmap(bmp);
                });
            } catch (Exception e) {
                toastUi("Aperçu impossible : " + e.getMessage());
            }
        });
    }

    // -------------------------------------------------------- impression

    private void print() {
        Options o = readOptions();
        if (o == null || doc == null) return;
        float aspect;
        try (NupRenderer r = new NupRenderer(doc)) {
            aspect = r.aspect(o.pages.get(0));
        } catch (Exception e) {
            Toast.makeText(this, "Lecture impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
            return;
        }
        float[] size = NupRenderer.sheetSize(o, aspect);
        PrintAttributes.MediaSize media = size[0] > size[1] ? o.media.asLandscape() : o.media.asPortrait();
        PrintAttributes attrs = new PrintAttributes.Builder()
                .setMediaSize(media)
                .setColorMode(o.mono ? PrintAttributes.COLOR_MODE_MONOCHROME
                        : PrintAttributes.COLOR_MODE_COLOR)
                .setDuplexMode(o.duplex)
                .setResolution(new PrintAttributes.Resolution("nup" + o.dpi, o.dpi + " dpi", o.dpi, o.dpi))
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build();
        String base = docName.replaceAll("(?i)\\.pdf$", "");
        String jobName = base + " (" + o.nup + " par feuille)";
        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
        pm.print(jobName, new NupAdapter(this, doc, o, jobName), attrs);
    }
}
