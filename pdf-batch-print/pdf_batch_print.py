"""
PDF Batch Print - imprime un lot de fichiers PDF en choisissant le nombre
de pages par feuille (N-up), l'imprimante, le format papier et l'orientation.

Fonctionnement:
  1. Tous les PDF sources sont colles bout a bout, puis leurs pages sont
     regroupees par paquets de N et recomposees ("imposees") sur des feuilles
     A4/Letter dans un fichier temporaire.
  2. Ce PDF est rendu nous-memes (PyMuPDF) puis envoye directement a
     l'imprimante via l'API GDI de Windows (pywin32) - aucun lecteur PDF
     tiers n'intervient a l'impression, donc pas de re-mise a l'echelle
     ou de recadrage indesirable.

Dependances: pypdf, pymupdf, pillow, pywin32 (installees via pip).
"""

import sys
import tempfile
import threading
from pathlib import Path

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from pypdf import PdfReader, PdfWriter
import pymupdf
from PIL import Image, ImageWin

import win32print
import win32gui
import win32ui
import win32con

PAPER_SIZES_PT = {
    "A4": (595.28, 841.89),
    "Letter": (612.0, 792.0),
}

PAPER_DEVMODE = {
    "A4": win32con.DMPAPER_A4,
    "Letter": win32con.DMPAPER_LETTER,
}

RENDER_DPI = 300  # resolution de rendu des pages avant envoi a l'imprimante

# nombre de pages par feuille -> (colonnes, lignes)
GRID_LAYOUTS = {
    1: (1, 1),
    2: (2, 1),
    4: (2, 2),
    6: (3, 2),
    9: (3, 3),
    12: (4, 3),
    16: (4, 4),
}

MARGIN = 10  # marge exterieure en points
GUTTER = 6   # espace entre les cellules en points


def load_all_pages(src_paths):
    """Concatene les pages de tous les PDF sources, dans l'ordre, en un seul flux."""
    readers = [PdfReader(str(p)) for p in src_paths]  # gardees en vie pour le merge
    pages = [page for reader in readers for page in reader.pages]
    return pages, readers


def build_imposed_pdf(pages, pages_per_sheet, paper_size, orientation, out_path):
    """Recompose une liste de pages (eventuellement issues de plusieurs PDF
    colles bout a bout) en un seul PDF avec N pages par feuille."""
    cols, rows = GRID_LAYOUTS[pages_per_sheet]

    width, height = PAPER_SIZES_PT[paper_size]
    if orientation == "Paysage":
        width, height = height, width

    writer = PdfWriter()

    usable_w = width - 2 * MARGIN - (cols - 1) * GUTTER
    usable_h = height - 2 * MARGIN - (rows - 1) * GUTTER
    cell_w = usable_w / cols
    cell_h = usable_h / rows

    total = len(pages)
    for start in range(0, total, pages_per_sheet):
        sheet = writer.add_blank_page(width=width, height=height)
        group = pages[start:start + pages_per_sheet]
        for i, src_page in enumerate(group):
            col = i % cols
            row = i // cols

            cell_x = MARGIN + col * (cell_w + GUTTER)
            # origine PDF en bas a gauche -> la rangee 0 est en haut
            cell_y = height - MARGIN - (row + 1) * cell_h - row * GUTTER

            src_w = float(src_page.mediabox.width)
            src_h = float(src_page.mediabox.height)
            scale = min(cell_w / src_w, cell_h / src_h)

            scaled_w = src_w * scale
            scaled_h = src_h * scale
            offset_x = cell_x + (cell_w - scaled_w) / 2
            offset_y = cell_y + (cell_h - scaled_h) / 2

            from pypdf import Transformation
            ctm = Transformation().scale(scale, scale).translate(offset_x, offset_y)
            sheet.merge_transformed_page(src_page, ctm, over=True, expand=False)

    with open(out_path, "wb") as f:
        writer.write(f)


def print_pdf_native(pdf_path, printer_name, paper_size, orientation, doc_name="PDF Batch Print"):
    """Rend le PDF page par page (PyMuPDF) et l'imprime directement via GDI,
    sans passer par un lecteur PDF tiers qui pourrait re-cadrer/re-mettre a
    l'echelle le contenu."""
    doc = pymupdf.open(str(pdf_path))

    hprinter = win32print.OpenPrinter(printer_name)
    try:
        info = win32print.GetPrinter(hprinter, 2)
        devmode = info["pDevMode"]
        devmode.Orientation = (
            win32con.DMORIENT_LANDSCAPE if orientation == "Paysage" else win32con.DMORIENT_PORTRAIT
        )
        devmode.PaperSize = PAPER_DEVMODE.get(paper_size, win32con.DMPAPER_A4)
        devmode.Fields |= win32con.DM_ORIENTATION | win32con.DM_PAPERSIZE

        hdc_handle = win32gui.CreateDC("WINSPOOL", printer_name, devmode)
        dc = win32ui.CreateDCFromHandle(hdc_handle)
        try:
            horzres = dc.GetDeviceCaps(win32con.HORZRES)
            vertres = dc.GetDeviceCaps(win32con.VERTRES)
            zoom = RENDER_DPI / 72.0

            dc.StartDoc(doc_name)
            for page in doc:
                pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

                scale = min(horzres / img.width, vertres / img.height)
                draw_w = round(img.width * scale)
                draw_h = round(img.height * scale)
                x0 = (horzres - draw_w) // 2
                y0 = (vertres - draw_h) // 2

                dc.StartPage()
                ImageWin.Dib(img).draw(dc.GetHandleOutput(), (x0, y0, x0 + draw_w, y0 + draw_h))
                dc.EndPage()
            dc.EndDoc()
        finally:
            dc.DeleteDC()
    finally:
        win32print.ClosePrinter(hprinter)
        doc.close()


def list_printers():
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    printers = win32print.EnumPrinters(flags)
    names = sorted({p[2] for p in printers})
    return names


def default_printer():
    try:
        return win32print.GetDefaultPrinter()
    except Exception:
        return None


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Impression par lot de PDF")
        self.geometry("640x520")
        self.minsize(560, 440)

        self.files = []

        self._build_ui()

    # ---------- UI ----------
    def _build_ui(self):
        pad = {"padx": 8, "pady": 6}

        top = ttk.Frame(self)
        top.pack(fill="x", **pad)
        ttk.Button(top, text="Ajouter des PDF...", command=self.add_files).pack(side="left")
        ttk.Button(top, text="Ajouter un dossier...", command=self.add_folder).pack(side="left", padx=6)
        ttk.Button(top, text="Retirer la selection", command=self.remove_selected).pack(side="left")
        ttk.Button(top, text="Vider la liste", command=self.clear_files).pack(side="left", padx=6)

        list_frame = ttk.Frame(self)
        list_frame.pack(fill="both", expand=True, padx=8)
        scrollbar = ttk.Scrollbar(list_frame)
        scrollbar.pack(side="right", fill="y")
        self.listbox = tk.Listbox(list_frame, selectmode="extended", yscrollcommand=scrollbar.set)
        self.listbox.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.listbox.yview)

        options = ttk.LabelFrame(self, text="Options d'impression")
        options.pack(fill="x", **pad)

        ttk.Label(options, text="Pages par feuille:").grid(row=0, column=0, sticky="w", padx=6, pady=6)
        self.pages_per_sheet = tk.StringVar(value="2")
        ttk.Combobox(
            options, textvariable=self.pages_per_sheet,
            values=[str(n) for n in sorted(GRID_LAYOUTS)],
            state="readonly", width=6,
        ).grid(row=0, column=1, sticky="w", padx=6, pady=6)

        ttk.Label(options, text="Format papier:").grid(row=0, column=2, sticky="w", padx=6, pady=6)
        self.paper_size = tk.StringVar(value="A4")
        ttk.Combobox(
            options, textvariable=self.paper_size,
            values=list(PAPER_SIZES_PT), state="readonly", width=8,
        ).grid(row=0, column=3, sticky="w", padx=6, pady=6)

        ttk.Label(options, text="Orientation:").grid(row=1, column=0, sticky="w", padx=6, pady=6)
        self.orientation = tk.StringVar(value="Portrait")
        ttk.Combobox(
            options, textvariable=self.orientation,
            values=["Portrait", "Paysage"], state="readonly", width=8,
        ).grid(row=1, column=1, sticky="w", padx=6, pady=6)

        ttk.Label(options, text="Imprimante:").grid(row=1, column=2, sticky="w", padx=6, pady=6)
        self.printer = tk.StringVar()
        self.printer_combo = ttk.Combobox(
            options, textvariable=self.printer, values=list_printers(),
            state="readonly", width=28,
        )
        self.printer_combo.grid(row=1, column=3, sticky="w", padx=6, pady=6)
        dp = default_printer()
        if dp:
            self.printer.set(dp)

        bottom = ttk.Frame(self)
        bottom.pack(fill="x", **pad)
        self.print_btn = ttk.Button(bottom, text="Imprimer le lot", command=self.start_print_batch)
        self.print_btn.pack(side="right")

        self.status = tk.StringVar(value="Pret.")
        ttk.Label(self, textvariable=self.status, anchor="w").pack(fill="x", padx=8, pady=(0, 8))

    # ---------- gestion de la liste ----------
    def add_files(self):
        paths = filedialog.askopenfilenames(
            title="Choisir des fichiers PDF", filetypes=[("Fichiers PDF", "*.pdf")]
        )
        for p in paths:
            if p not in self.files:
                self.files.append(p)
                self.listbox.insert("end", p)

    def add_folder(self):
        folder = filedialog.askdirectory(title="Choisir un dossier")
        if not folder:
            return
        for p in sorted(Path(folder).glob("*.pdf")):
            sp = str(p)
            if sp not in self.files:
                self.files.append(sp)
                self.listbox.insert("end", sp)

    def remove_selected(self):
        for idx in reversed(self.listbox.curselection()):
            del self.files[idx]
            self.listbox.delete(idx)

    def clear_files(self):
        self.files.clear()
        self.listbox.delete(0, "end")

    # ---------- impression ----------
    def log(self, msg):
        self.status.set(msg)
        self.update_idletasks()

    def start_print_batch(self):
        if not self.files:
            messagebox.showwarning("Aucun fichier", "Ajoutez au moins un fichier PDF.")
            return
        if not self.printer.get():
            messagebox.showwarning("Aucune imprimante", "Selectionnez une imprimante.")
            return

        self.print_btn.config(state="disabled")
        thread = threading.Thread(target=self._run_print_batch, daemon=True)
        thread.start()

    def _run_print_batch(self):
        try:
            pages_per_sheet = int(self.pages_per_sheet.get())
            paper_size = self.paper_size.get()
            orientation = self.orientation.get()
            printer_name = self.printer.get()

            self.log(f"Fusion de {len(self.files)} fichier(s)...")
            pages, readers = load_all_pages(self.files)

            with tempfile.TemporaryDirectory() as tmp_dir:
                out_path = Path(tmp_dir) / "imposed.pdf"
                self.log(f"Mise en page ({len(pages)} pages source)...")
                build_imposed_pdf(pages, pages_per_sheet, paper_size, orientation, out_path)
                del readers  # les pages ne sont plus necessaires une fois le PDF ecrit

                self.log("Impression...")
                print_pdf_native(out_path, printer_name, paper_size, orientation)

            self.log(f"Termine: {len(self.files)} fichier(s) fusionne(s) et imprime(s).")
        except Exception as e:
            self.log(f"Erreur: {e}")
            messagebox.showerror("Erreur d'impression", str(e))
        finally:
            self.print_btn.config(state="normal")


if __name__ == "__main__":
    if sys.platform != "win32":
        print("Cette application est concue pour Windows.")
    app = App()
    app.mainloop()
