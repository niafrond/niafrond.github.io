# Équilibrage des combats : résumé

Version courte de `EQUILIBRAGE.md` (PR #706). Les valeurs vivent dans `combatBalance.js` et `bossScript.js`.

## Objectif

- **Durée** : un combat dure en moyenne de 3 à 8 minutes selon la catégorie de l'ennemi.

  | Catégorie | Durée cible |
  |---|---|
  | Faible | 3 min |
  | Normal | 3 à 4 min |
  | Agressif | 4 à 5 min |
  | Élite | 5 à 6 min |
  | Mini-boss | 6 à 7 min |
  | Boss | 7 à 8 min |

- **Pas de sac à PV** : la durée ne vient pas de PV gonflés, ni pour l'ennemi ni pour le héros.
- **Défaite possible** : l'ennemi peut aussi vaincre le héros dans cette fenêtre.
- **Lisibilité** : aucun multiplicateur caché sur les dégâts.

## Comment le jeu calcule chaque combat

1. **PV de l'ennemi** : dégâts du héros par cycle × cycles visés pour la catégorie. Ils sont identiques dans tous les modes : c'est ce qui garde la fenêtre de durée.
2. **Dégâts de l'ennemi** : réglés au niveau Expert, visibles sur sa fiche.
   - **Arme** : elle affiche ses vrais dégâts.
   - **Sorts** : ils sont amplifiés par un Talisman de Résonance, objet non récupérable, visible seulement à l'appui long sur l'ennemi. Les sorts affichent directement le résultat de la multiplication.
3. **Mode de difficulté** : un mode plus doux **divise l'attaque** de l'ennemi et le bonus de son stuff, jamais ses PV. L'IA joue aussi mieux ou moins bien selon le mode. Le mode **Expert** ajoute : sorts à 70 % de leur coût en qì, plafond de coup à 50 % des PV du héros, dégâts ×1,1 et rattrapage d'Att/Déf face à un héros bien plus fort.
4. **Héros** : ses PV sont plafonnés pour le calcul (référence de progression + 60 %, puis un quart de l'excédent). Son équipement ne change pas.
5. **Coups fatals** : le multiplicateur ne porte jamais un coup ordinaire (arme, crânes, sort, poison) au-delà de 40 % des PV max du héros.

## Les boss

- **Équipement fixe** : chaque boss et chaque ennemi garde le même stuff et les mêmes sorts d'une rencontre à l'autre.
- **Réglage par boss** : chacun des 42 boss de la carte a son propre réglage d'attaque et de PV.
- **Attaque dévastatrice** : chaque boss a une attaque signature, annoncée « <Boss> prépare <attaque> — Il frappera dans 2 tours », sans conseil ni dégâts annoncés.
  - **Rythme** : environ deux fois par combat (premier échauffement au tour 4 ou 5, puis tous les 7 à 9 tours, plus à 66 % puis 33 % de ses PV).
  - **Puissance** : de 30 % (Facile) à 45 % (Expert) des PV max du héros, sans critique.
  - **Contre-jeu** : buffs de défense (jusqu'à −75 %), Bastion Infranchissable (annule), bouclier de qì (absorbe), soin. Étourdir ou endormir le boss pendant l'échauffement l'interrompt.

## Mesures en jeu

- **Enregistrement** : chaque combat terminé est enregistré (victoire, défaite, abandon), sans les pauses de réflexion longues.
- **Dégâts par source** : arme, sort, crânes, autres.
- **Calibration progressive** : les mesures corrigent les modèles sans les remplacer.
  - Rien sous 5 combats, 50 % de poids à 20 combats, jamais 100 %.
  - Médiane (résiste aux combats aberrants), écart borné à ×0,5 / ×2.
  - Les défaites comptent comme les victoires ; les abandons sont exclus.

## Résultats (simulation)

Héros complet (sorts à effet, ultime, objet, compagnon), niveaux 1 à 70, 4 classes.

- **Modes** : 70 contrôles réussis sur 77 (`mode-report 1 3`, peu de combats par case : le bruit fait échouer Difficile / mini-boss). Expert, durci : 59 % de victoires contre les ennemis normaux, 31 % contre les élites, 33 % contre les boss de la carte.
- **Boss de la carte, mode Auto** : 61 % de victoires en moyenne (cible 60 %), écart-type de 12 points, durée moyenne 7 min 24.

## Limites

- Simulation, pas jeu réel : jokers, biomes et altérations de l'ennemi ne sont pas simulés.
- Cinq boss restent hors de la fourchette de 40 à 80 % de victoires.
- Un joueur qui n'utilise pas ses sorts, objets et compagnons perd beaucoup plus souvent contre les boss.
- Les mesures de l'appareil corrigent les modèles, mais pas les réglages par boss.

## Relancer les simulations

```
node match3-quest/tools/balance-search.mjs mode-report 1 6
AI=auto node match3-quest/tools/balance-search.mjs bosses 12
```
