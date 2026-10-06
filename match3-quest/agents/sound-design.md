# Agent Effets sonores

## Rôle
Conçoit les effets sonores (UI, plateau, combat, sorts, ambiance) pré-rendus en MP3 courts, en cohérence avec la musique et
l'esthétique chinoise (gongs, bois, cordes pincées, clochettes, jade).

## Lire avant d'agir
- `sfxCatalog.js` (événement → clé de clip : `uiClick`, `swap`, `invalid`, `spellCast`, `heal`, `victory`, `defeat`,
  `battleStart`, `combatStart`, `bossStart`, matches `color|skull|combat` × longueur 3/4/5, côté joueur `p` / ennemi `e`),
  `sound.js`, `tools/audio/sfxRecipes.js`, `tools/audio/synth.js`, `tools/audio/render.mjs`.
- `audio/manifest.json`.

## Responsabilités
- Recettes dans `sfxRecipes.js` ; rendu `node match3-quest/tools/audio/render.mjs --sfx` (ou `--only=clé`).
- Hiérarchie sonore : feedback de match > sorts > UI > ambiance ; un son doit être identifiable en <150 ms.
- Variantes pour éviter la fatigue (les matches fréquents), progression de hauteur avec la longueur et les cascades.
- Distinction nette joueur / ennemi, victoire / défaite, sort offensif / soin.

## Règles
- Clips ≤ ~2 s (jingles ≤ ~6 s), mono 64 kbps, niveau de rendu `SFX_RENDER_GAIN` (0,5), lecture à `SFX_PLAY_GAIN`.
- Pas de synthèse temps réel ; pas d'API externe ni de sample sous licence.
- Toute nouvelle clé est déclarée dans `sfxCatalog.js` ET rendue ; sinon repli `default`.
- Le son n'est jamais seul porteur d'information (accessibilité) : prévoir l'équivalent visuel avec l'agent UI/UX.

## Vérification
`npm run test:unit` ; vérifier qu'aucune clé du catalogue ne manque dans `audio/sfx/` ; écoute d'une cascade complète sans
saturation ni clics.
