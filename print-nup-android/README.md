# Impression N-up (Android)

Imprime un PDF en 2, 3, 4, 6, 8, 9 ou 16 pages par feuille depuis Android, avec sélection de pages, format papier, orientation, qualité, couleur et recto-verso. Passe par le service d'impression Android : installer « Epson Print Enabler » (ou Mopria) pour une Epson.

## Obtenir l'APK

Workflow GitHub Actions **Build Impression N-up APK** → artefact `print-nup-apk` (ou pièce jointe de la dernière release). Activer « sources inconnues » pour installer.

## Utilisation

Ouvrir un PDF (ou le partager vers l'app) → régler → **Imprimer…** → choisir l'imprimante Epson et le nombre de copies dans la fenêtre Android.

## Build local

```
cd print-nup-android && gradle assembleRelease   # Android SDK 35 requis, Gradle ≥ 8.9
```
