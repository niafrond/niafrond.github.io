# Karaoké Playlist

Appli de soirée karaoké à deux écrans : un **écran maître** qui joue les vidéos les unes après les autres sur la TV, et un **QR code** que les invités scannent depuis leur téléphone pour chercher des chansons et les ajouter à la file — sans rien installer.

## Comment ça marche, en un coup d'œil

```
Écran maître (TV)  ──plein écran vidéo + QR code──▶  affiché à tout le monde
        ▲                                                    │
        │ lit la file d'attente                              │ scan
        │                                                     ▼
   File d'attente  ◀──recherche + ajout + "Passer"/"Retirer"──  Téléphone d'un invité
   (partagée en                                             (guest.html)
    temps réel)
```

- **L'écran maître ne fait que lire.** Pas de recherche, pas de bouton, rien à cliquer une fois lancé — il enchaîne les vidéos de la file automatiquement.
- **Tout le monde ajoute et modère depuis son téléphone**, via le QR code. Il n'y a pas de compte "organisateur" séparé : quiconque a scanné le QR code peut chercher, ajouter, passer la chanson en cours ou retirer une chanson à venir.

## Avant la soirée (une seule fois)

L'app a besoin d'un serveur dj-mix (recherche + téléchargement des vidéos) et d'un projet Firebase côté back (pour que les téléphones des invités et l'écran maître se synchronisent) — le navigateur, lui, n'a jamais accès à Firebase directement : tout passe par des Cloud Functions. Si ce n'est pas déjà en place, voir la documentation technique :
- Côté serveur : `SPECS.md` du dépôt `Spotify-mp3-downloader`, section **"Cloud Functions invités karaoke-playlist (Firestore)"**.
- Côté site : `dj-mix/SPECS.md` de ce dépôt (journal des changements `karaoke-playlist`).

Une fois le serveur et Firebase déployés, il reste une synchronisation manuelle à faire **une seule fois** : ouvrir l'écran maître (`karaoke-playlist/index.html`) note un identifiant de session sous le QR code. Copie cet identifiant dans la variable `KARAOKE_SESSION_ID` du serveur (fichier `.env` de `Spotify-mp3-downloader`) et redémarre le serveur — sans ça, aucune demande des invités n'est traitée.

## Lancer une soirée

1. **Ouvre `karaoke-playlist/index.html` sur le PC branché à la TV**, en plein écran.
2. Si c'est la première fois (ou sur un nouveau navigateur), une icône ⚙️ en haut à gauche ouvre un petit panneau de réglages : renseigne l'URL de ton serveur dj-mix et son token API, puis "Enregistrer". C'est la seule configuration nécessaire sur cet écran — elle ne sert qu'à récupérer les vidéos déjà préparées par le serveur, pas à chercher ou télécharger quoi que ce soit.
3. Clique sur **"Démarrer"** — obligatoire une fois par session pour autoriser le son dans le navigateur. Après ce clic, l'écran maître tourne tout seul.
4. Le **QR code** reste affiché en bas à droite en permanence : c'est ce que les invités scannent pour rejoindre la soirée.

## Ce que voient les invités

En scannant le QR code, chacun arrive sur une page mobile simple :

1. **Rechercher** : taper un titre (et l'artiste si besoin), valider. La recherche est faite par le serveur ; les résultats (avec miniature et durée) s'affichent après quelques secondes.
2. **Ajouter** : choisir la bonne vidéo dans les résultats. Si elle a déjà été téléchargée par quelqu'un d'autre, elle rejoint la file quasi instantanément ; sinon, un vrai téléchargement se lance côté serveur (peut prendre du temps sur une vidéo longue) — un statut ⏳/✅/❌ s'affiche pendant l'opération.
3. **File d'attente** : toujours visible en bas de la page, mise à jour en temps réel. La chanson en tête est marquée "▶ EN COURS". Chaque entrée a un bouton **"Passer"** (pour la chanson en cours) ou **"Retirer"** (pour les suivantes) — utilisable par n'importe quel invité, pas seulement celui qui l'a ajoutée.

Aucune installation, aucun compte : la page fonctionne dans n'importe quel navigateur de téléphone tant qu'il a accès à internet.

## Pendant la soirée

- L'écran maître enchaîne les vidéos tout seul : dès qu'une chanson se termine (ou qu'une vidéo est défaillante), il passe automatiquement à la suivante.
- Si un invité retire la chanson en cours pendant qu'elle joue, l'écran maître s'aligne sur la nouvelle tête de file en quelques secondes.
- Rien à surveiller côté écran maître — il n'affiche même pas de contrôles pour ça.

## Dépannage rapide

| Symptôme | Cause probable |
| --- | --- |
| Le QR code ne montre aucune activité, aucune chanson n'est jamais ajoutée | `KARAOKE_SESSION_ID` côté serveur ne correspond pas à l'identifiant affiché sous le QR code (ou le serveur n'a pas été redémarré après l'avoir renseigné) |
| Une recherche reste bloquée sur "Recherche en cours…" | Le serveur dj-mix (`karaokeRequestsWatcher.js`) est éteint, ou son accès à Firestore (compte de service) n'est pas configuré |
| L'écran maître affiche "En attente" sans jamais lire de vidéo | URL/token du serveur mal renseignés dans le panneau ⚙️ de l'écran maître |
| Rien ne se passe du tout, aucun invité ne peut envoyer de demande | Les Cloud Functions/règles Firestore n'ont pas été déployées (`terraform apply` côté serveur) |
