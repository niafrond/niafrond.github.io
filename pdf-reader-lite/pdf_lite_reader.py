"""
Lecteur/Imprimante PDF Ultra Leger.

Affiche un PDF page par page (rendu via PyMuPDF, sans dependance a Pillow)
et permet de l'imprimer silencieusement (toutes les pages ou la page
courante) via l'utilitaire portable SumatraPDF.
"""

import sys
import tempfile
import subprocess
import threading
import urllib.request
import zipfile
from pathlib import Path

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

import pymupdf as fitz

try:
    import win32print
except ImportError:
    win32print = None

if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent
SUMATRA_PATH = APP_DIR / "SumatraPDF.exe"
SUMATRA_URL = "https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.zip"

ZOOM_STEP = 0.1
ZOOM_MIN = 0.2
ZOOM_MAX = 4.0


def ensure_sumatra(log):
    if SUMATRA_PATH.exists():
        return True
    log("Telechargement de SumatraPDF (impression silencieuse)...")
    try:
        tmp_zip = APP_DIR / "_sumatra.zip"
        req = urllib.request.Request(SUMATRA_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(tmp_zip, "wb") as f:
            f.write(resp.read())
        with zipfile.ZipFile(tmp_zip) as z:
            for name in z.namelist():
                lname = name.lower()
                if lname.endswith(".exe") and "sumatrapdf" in lname:
                    with z.open(name) as src, open(SUMATRA_PATH, "wb") as dst:
                        dst.write(src.read())
                    break
        tmp_zip.unlink(missing_ok=True)
    except Exception as e:
        log(f"Echec du telechargement de SumatraPDF: {e}")
        return False
    return SUMATRA_PATH.exists()


def print_via_sumatra(pdf_path, printer_name, page_range=None):
    settings = f"{page_range},fit" if page_range else "fit"
    cmd = [
        str(SUMATRA_PATH),
        "-print-to", printer_name,
        "-print-settings", settings,
        "-silent",
        str(pdf_path),
    ]
    subprocess.run(cmd, check=True, creationflags=subprocess.CREATE_NO_WINDOW)


def list_printers():
    if win32print is None:
        return []
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    printers = win32print.EnumPrinters(flags)
    return sorted({p[2] for p in printers})


def default_printer():
    if win32print is None:
        return None
    try:
        return win32print.GetDefaultPrinter()
    except Exception:
        return None


class App(tk.Tk):
    def __init__(self, initial_path=None):
        super().__init__()
        self.title("Lecteur PDF Leger")
        self.geometry("820x900")
        self.minsize(420, 380)

        self.doc = None
        self.pdf_path = None
        self.page_index = 0
        self.zoom = 1.0
        self.photo = None
        self.render_tmp = Path(tempfile.gettempdir()) / "pdf_lite_reader_preview.png"

        self._build_ui()

        if initial_path:
            self.open_path(initial_path)

    # ---------- UI ----------
    def _build_ui(self):
        pad = {"padx": 6, "pady": 6}

        toolbar = ttk.Frame(self)
        toolbar.pack(fill="x", **pad)

        ttk.Button(toolbar, text="Ouvrir...", command=self.choose_file).pack(side="left")

        nav = ttk.Frame(toolbar)
        nav.pack(side="left", padx=12)
        ttk.Button(nav, text="<", width=3, command=self.prev_page).pack(side="left")
        self.page_var = tk.StringVar(value="0")
        page_entry = ttk.Entry(nav, textvariable=self.page_var, width=5, justify="center")
        page_entry.pack(side="left", padx=4)
        page_entry.bind("<Return>", self.go_to_page)
        self.page_total_label = ttk.Label(nav, text="/ 0")
        self.page_total_label.pack(side="left")
        ttk.Button(nav, text=">", width=3, command=self.next_page).pack(side="left", padx=(4, 0))

        zoom = ttk.Frame(toolbar)
        zoom.pack(side="left", padx=12)
        ttk.Button(zoom, text="-", width=3, command=self.zoom_out).pack(side="left")
        self.zoom_label = ttk.Label(zoom, text="100%", width=5, anchor="center")
        self.zoom_label.pack(side="left")
        ttk.Button(zoom, text="+", width=3, command=self.zoom_in).pack(side="left")
        ttk.Button(zoom, text="Ajuster", command=self.fit_width).pack(side="left", padx=(6, 0))

        canvas_frame = ttk.Frame(self)
        canvas_frame.pack(fill="both", expand=True, padx=6)
        self.canvas = tk.Canvas(canvas_frame, background="#606060")
        vbar = ttk.Scrollbar(canvas_frame, orient="vertical", command=self.canvas.yview)
        hbar = ttk.Scrollbar(canvas_frame, orient="horizontal", command=self.canvas.xview)
        self.canvas.configure(yscrollcommand=vbar.set, xscrollcommand=hbar.set)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        vbar.grid(row=0, column=1, sticky="ns")
        hbar.grid(row=1, column=0, sticky="ew")
        canvas_frame.rowconfigure(0, weight=1)
        canvas_frame.columnconfigure(0, weight=1)

        print_bar = ttk.LabelFrame(self, text="Impression")
        print_bar.pack(fill="x", **pad)

        self.print_scope = tk.StringVar(value="all")
        ttk.Radiobutton(print_bar, text="Toutes les pages", variable=self.print_scope,
                         value="all").grid(row=0, column=0, sticky="w", padx=6, pady=4)
        ttk.Radiobutton(print_bar, text="Page actuelle", variable=self.print_scope,
                         value="current").grid(row=0, column=1, sticky="w", padx=6, pady=4)

        ttk.Label(print_bar, text="Imprimante:").grid(row=0, column=2, sticky="e", padx=(12, 4))
        self.printer = tk.StringVar()
        self.printer_combo = ttk.Combobox(
            print_bar, textvariable=self.printer, values=list_printers(),
            state="readonly", width=28,
        )
        self.printer_combo.grid(row=0, column=3, sticky="w", padx=4)
        dp = default_printer()
        if dp:
            self.printer.set(dp)

        self.print_btn = ttk.Button(print_bar, text="Imprimer", command=self.start_print)
        self.print_btn.grid(row=0, column=4, padx=(12, 6))

        self.status = tk.StringVar(value="Ouvrez un PDF pour commencer.")
        ttk.Label(self, textvariable=self.status, anchor="w").pack(fill="x", padx=8, pady=(0, 6))

    # ---------- ouverture ----------
    def choose_file(self):
        path = filedialog.askopenfilename(
            title="Choisir un PDF", filetypes=[("Fichiers PDF", "*.pdf")]
        )
        if path:
            self.open_path(path)

    def open_path(self, path):
        try:
            doc = fitz.open(path)
        except Exception as e:
            messagebox.showerror("Erreur d'ouverture", str(e))
            return
        if self.doc is not None:
            self.doc.close()
        self.doc = doc
        self.pdf_path = path
        self.page_index = 0
        self.zoom = 1.0
        self.title(f"Lecteur PDF Leger - {Path(path).name}")
        self.page_total_label.config(text=f"/ {self.doc.page_count}")
        self.render_current_page()
        self.status.set(f"{Path(path).name} - {self.doc.page_count} page(s).")

    # ---------- navigation ----------
    def prev_page(self):
        if self.doc and self.page_index > 0:
            self.page_index -= 1
            self.render_current_page()

    def next_page(self):
        if self.doc and self.page_index < self.doc.page_count - 1:
            self.page_index += 1
            self.render_current_page()

    def go_to_page(self, _event=None):
        if not self.doc:
            return
        try:
            n = int(self.page_var.get()) - 1
        except ValueError:
            n = self.page_index
        self.page_index = max(0, min(n, self.doc.page_count - 1))
        self.render_current_page()

    # ---------- zoom ----------
    def zoom_in(self):
        self.zoom = min(ZOOM_MAX, self.zoom + ZOOM_STEP)
        self.render_current_page()

    def zoom_out(self):
        self.zoom = max(ZOOM_MIN, self.zoom - ZOOM_STEP)
        self.render_current_page()

    def fit_width(self):
        if not self.doc:
            return
        page = self.doc[self.page_index]
        canvas_width = max(self.canvas.winfo_width(), 100)
        self.zoom = max(ZOOM_MIN, min(ZOOM_MAX, (canvas_width - 20) / page.rect.width))
        self.render_current_page()

    # ---------- rendu ----------
    def render_current_page(self):
        if not self.doc:
            return
        page = self.doc[self.page_index]
        mat = fitz.Matrix(self.zoom, self.zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        pix.save(self.render_tmp)

        self.photo = tk.PhotoImage(file=str(self.render_tmp))
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, anchor="nw", image=self.photo)
        self.canvas.config(scrollregion=(0, 0, self.photo.width(), self.photo.height()))

        self.page_var.set(str(self.page_index + 1))
        self.zoom_label.config(text=f"{round(self.zoom * 100)}%")

    # ---------- impression ----------
    def log(self, msg):
        self.status.set(msg)
        self.update_idletasks()

    def start_print(self):
        if not self.pdf_path:
            messagebox.showwarning("Aucun PDF", "Ouvrez un fichier PDF avant d'imprimer.")
            return
        if not self.printer.get():
            messagebox.showwarning("Aucune imprimante", "Selectionnez une imprimante.")
            return

        self.print_btn.config(state="disabled")
        thread = threading.Thread(target=self._run_print, daemon=True)
        thread.start()

    def _run_print(self):
        try:
            if not ensure_sumatra(self.log):
                self.log("Impossible de preparer l'impression silencieuse (SumatraPDF).")
                return

            page_range = None
            if self.print_scope.get() == "current":
                page_range = str(self.page_index + 1)

            self.log("Impression...")
            print_via_sumatra(self.pdf_path, self.printer.get(), page_range)
            self.log("Termine: document envoye a l'imprimante.")
        except Exception as e:
            self.log(f"Erreur: {e}")
            messagebox.showerror("Erreur d'impression", str(e))
        finally:
            self.print_btn.config(state="normal")


if __name__ == "__main__":
    if sys.platform != "win32":
        print("Cette application est concue pour Windows.")
    initial = sys.argv[1] if len(sys.argv) > 1 else None
    app = App(initial_path=initial)
    app.mainloop()
