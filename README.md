# niafrond.github.io

Collection de mini-applications web en HTML/CSS/JavaScript, accessibles sur [niafrond.github.io](https://niafrond.github.io).

## Applications

| App | Description |
|-----|-------------|
| 🃏 [Scrum Poker](scrum-poker/) | Planning poker P2P — estimations Fibonacci en équipe, révélation simultanée |
| 🧠 [Quiz Multijoueur](quiz/) | Quiz P2P avec buzzer, mode QCM, mode Speed |
| 🎵 [Blind Test](blind-test/) | Blind test musical multijoueur via YouTube, buzzer et jokers |
| ⚡ [Flash Guess](flash-guess/) | Jeu de devinettes 3 manches (décrire/un mot/mime), catégories configurables |
| ⏱️ [Time's Up Nout Péi](times-up/) | Time's Up sur le thème de La Réunion, 100% local |
| 🎮 [Match3 Quest](match3-quest/) | Jeu match-3 RPG avec classes, sorts, armes et IA ennemie |
| 📱 [Switch Enfants](lavevaisselle/) | App mobile pour gérer les tours, avec historique local et capture photo |
| 📷 [QR Scanner](qrcode-scanner/) | Scanner QR code 100% hors ligne, historique local |
| 📝 [Générateur de recette](generateur-recette.html) | Extraction et formatage de recettes depuis texte ou URL |
| 🎤 [Karaoke Playlist](karaoke-playlist/) | Recherche YouTube suffixée « karaoké » et ajout direct à une playlist prédéfinie |

## Notes

- Les apps multijoueur (Scrum Poker, Quiz, Blind Test) fonctionnent en P2P via WebRTC (PeerJS) — aucun serveur requis, partagez juste un lien.
- Les données et préférences sont sauvegardées localement (localStorage).