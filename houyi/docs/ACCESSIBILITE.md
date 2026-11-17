# Accessibilité, confort et charte familiale (lot 3)

Jeu pensé pour **mobile / tactile** ; le clavier n'est pas une cible (les fenêtres restent tout de même utilisables au clavier).

## Déjà présent (non dupliqué)
Taille du texte, symboles en plus des couleurs, animations coupables, effets réduits, vibrations désactivables, vitesse des animations, `prefers-reduced-motion` sur plusieurs animations CSS, mode nuit, cibles de 40-44 px sur plusieurs boutons.

**Mode daltonien** (Options / Pause) : teintes décalées et luminosités échelonnées pour les tuiles et le qì, symboles forcés. À valider avec des joueurs concernés ; les barres de PV et autres indicateurs ne dépendent pas de cette palette.

## Constats et corrections
| Constat | Impact | Correction |
|---|---|---|
| `log()` écrivait dans un `#log` absent du HTML : tous les messages (dégâts, soins, sorts, « onglet indisponible ») étaient invisibles | élevé | `log()` relaie aussi dans une zone `role="status"` masquée (`a11y.js`) |
| Onglet bloqué en combat : message perdu | élevé | bulle visible, rassurante, non bloquante |
| Échec de sauvegarde automatique : silencieux | élevé | message calme (1 par minute max) qui suggère l'export |
| Rappel de pause non désactivable, quelques phrases pressantes (« urgence », « niveau critique ») | moyen | option **Rappel de pause** (Options / Pause), textes adoucis, mention du réglage dans la fenêtre |
| Fenêtres sans rôle `dialog` ni gestion du focus | moyen | rôle, titre associé, focus à l'ouverture, retour à la fermeture |
| Tuiles sans nom accessible | moyen | `role="button"` + libellé (gâteau, ligne, colonne) |
| Réglage système « réduire les animations » ignoré pour l'option Animations | moyen | appliqué tant que le joueur n'a pas choisi lui-même |
| Cibles tactiles < 44 px | moyen | `min-height/min-width: 44px` sur `pointer: coarse` |

## Audit charte non addictive
Aucun mécanisme problématique trouvé : pas de vies/énergie, streaks, récompenses quotidiennes ou expirantes, notifications, achats, loot boxes ni compte à rebours. Les événements ne dépendent pas de la date (`events/config.js`). La « série de défaites contre un boss » (`bossLossStreak`) ne sert qu'à proposer un conseil. Les effets à durée de vie (`ttl` du terrain, buffs) ne vivent que dans un combat. Le rappel de pause n'apparaît qu'à un moment calme, jamais en combat, ne pénalise rien.

## Tests
- `npm run test:unit` (ou `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects match3-quest-node`)
- Ciblés : `a11y.test.js`, `breakReminder.test.js`, `gameOptions.test.js`.

## À vérifier à la main (appareil réel)
TalkBack / VoiceOver (lecture des tuiles et annonces), zones tactiles réelles sur petit téléphone, contraste en plein soleil, rappel de pause après 30 min réelles.
