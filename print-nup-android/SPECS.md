# Impression N-up (Android) — Spécifications

Application Android native (Java, aucune dépendance) pour imprimer un PDF en « N pages par feuille » sur une imprimante Epson (ou toute imprimante gérée par le service d'impression Android : Epson Print Enabler, Mopria…).

## Journal de session

- 2026-10-25 : création de l'application à la demande de l'utilisateur (« apk pour imprimer en 2 par 2 ou plus sur une Epson depuis Android, avec les options de base : sélection de pages, qualité, portrait… »). Non compilée localement (SDK Android inaccessible dans le conteneur) : le build est confié au workflow `.github/workflows/apk-printnup.yml`.

## Spécifications

- **SPEC-1 Entrée** : GIVEN l'app WHEN l'utilisateur choisit un PDF (sélecteur, « Ouvrir avec », ou « Partager ») THEN le fichier est copié en cache et son nombre de pages affiché ; un PDF protégé ou illisible affiche un message.
- **SPEC-2 Pages** : GIVEN un champ « pages » (`1-3,5,8-`, `-4`, vide = toutes) WHEN la saisie est valide THEN seules ces pages sont imprimées dans l'ordre saisi ; sinon un message indique le nombre de pages du document.
- **SPEC-3 N-up** : GIVEN `1, 2, 3, 4, 6, 8, 9 ou 16` pages par feuille THEN la grille (colonnes × lignes) est choisie pour maximiser la taille des pages, la dernière feuille pouvant être incomplète.
- **SPEC-4 Orientation** : « Automatique » choisit portrait ou paysage selon la meilleure échelle (ex. 2 pages portrait → feuille paysage) ; « Portrait » / « Paysage » forcent.
- **SPEC-5 Papier** : A4, A3, A5, B5, Letter, Legal.
- **SPEC-6 Qualité** : Brouillon 150 / Normal 300 / Haute 600 dpi (densité de rendu des pages ; plafonnée à 12 Mpx par page pour la mémoire). Transmise aussi comme résolution demandée au service d'impression.
- **SPEC-7 Couleur / Recto-verso / Marges / Ordre / Cadre** : couleur ou noir et blanc ; recto seul, bord long, bord court ; marges 0/4/8/15 mm ; ordre par lignes ou par colonnes ; cadre fin autour de chaque page.
- **SPEC-8 Aperçu** : une miniature de la feuille N (navigation ◀ ▶) reflète les réglages courants.
- **SPEC-9 Impression** : « Imprimer… » ouvre la fenêtre d'impression Android pré-remplie (papier, orientation, couleur, recto-verso, résolution) ; le nombre de copies, la plage de feuilles et les réglages propres à l'Epson s'y ajustent. Le rendu se fait hors du thread UI et respecte l'annulation.

## Limites connues

- Les réglages spécifiques Epson (type de papier, bac, bords perdus) dépendent du plug-in Epson installé et ne sont proposés que dans le dialogue système.
- PDF protégés par mot de passe non pris en charge ; seuls les PDF sont acceptés (pas d'images).
