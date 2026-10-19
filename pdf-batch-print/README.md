# PDF Batch Print

App Windows pour imprimer un lot de fichiers PDF en choisissant le nombre de
pages par feuille (1, 2, 4, 6, 9, 12 ou 16).

## Utilisation rapide

L'exécutable est déjà prêt dans `dist/PDF Batch Print.exe` : double-cliquez
dessus, aucune installation nécessaire.

1. **Ajouter des PDF...** ou **Ajouter un dossier...** pour constituer le lot.
2. Choisir le nombre de **pages par feuille**, le **format papier**,
   l'**orientation** et l'**imprimante**.
3. Cliquer sur **Imprimer le lot**.

Tous les PDF du lot sont d'abord **collés bout à bout** (dans l'ordre de la
liste), puis l'ensemble des pages est recomposé en grille sur des feuilles
A4/Letter selon le nombre de pages/feuille choisi. Un seul job d'impression
silencieux est envoyé pour tout le lot (pas de boîte de dialogue).

L'impression n'utilise aucun lecteur PDF tiers : chaque page est rendue en
image haute résolution (PyMuPDF, 300 dpi) puis dessinée directement sur le
contexte d'impression Windows (GDI, via pywin32), à l'échelle exacte de la
page physique choisie (format + orientation). Ça évite les problèmes de
mise à l'échelle/recadrage qu'on peut avoir avec un lecteur PDF externe.

## Relancer depuis les sources

```
run.bat
```
(nécessite Python et les dépendances de `requirements.txt` : `pip install -r requirements.txt`)

## Reconstruire l'exécutable

```
build_exe.bat
```
Regénère `dist/PDF Batch Print.exe` via PyInstaller.
