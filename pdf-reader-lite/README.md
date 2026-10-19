# PDF Lite Reader

Lecteur/imprimante PDF ultra leger pour Windows. Ouvre un PDF instantanement
(rendu via PyMuPDF, sans dependance a Pillow), permet de naviguer page par
page et d'imprimer silencieusement (toutes les pages ou la page courante).

## Utilisation rapide

```
run.bat
run.bat "C:\chemin\vers\document.pdf"
```
(necessite Python et les dependances de `requirements.txt` : `pip install -r requirements.txt`)

1. **Ouvrir...** pour choisir un PDF (ou passez le chemin en argument / associez
   le .exe au type de fichier pour un "Ouvrir avec").
2. Naviguer avec **< / >** ou en tapant un numero de page, zoomer avec **- / +**
   ou **Ajuster** (largeur de la fenetre).
3. Choisir **Toutes les pages** ou **Page actuelle**, l'**imprimante**, puis
   **Imprimer**.

Au premier lancement, l'app telecharge automatiquement `SumatraPDF.exe`
(utilitaire libre utilise pour l'impression silencieuse) dans ce dossier.
Une connexion internet est donc necessaire une seule fois.

## Reconstruire l'executable

```
build_exe.bat
```
Regenere `dist/PDF Lite Reader.exe` via PyInstaller.

## Ajouter au menu "Ouvrir avec" de Windows

```
install.bat
```
Construit l'executable si besoin, puis enregistre "PDF Lite Reader" dans les
applications Windows (cle `HKCU`, pas besoin d'etre administrateur). Ensuite,
sur un PDF : clic droit -> **Ouvrir avec** -> **Choisir une autre application**
-> **PDF Lite Reader** (cocher *Toujours utiliser cette application* pour en
faire le lecteur par defaut).

```
uninstall.bat
```
Retire l'entree du menu "Ouvrir avec".
