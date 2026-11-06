// Animations « pixel art » plein écran (intro, fin de la légende, boss, soleils, régions, titre, prologue, duel).
// Façade : le code est réparti dans les modules cinematics*.js ci-dessous (API publique inchangée).
export { SILENT_BOSS_LINES, bossIntroLines, playBossDialogue } from './cinematicsBoss.js';
export { FENGMENG_DUEL_CAPTIONS, fengmengDuelCinematicPlayed, playFengmengDuelCinematic } from './cinematicsDuel.js';
export { CREDITS, CREDITS_RESUME_MS, CREDITS_SPEED, ENDING_CAPTIONS, playCredits, playEndingAnimation } from './cinematicsEnding.js';
export { playPrologueAnimation, prologueAnimationPlayed } from './cinematicsPrologue.js';
export { REGION_SCENES, playPortalTransition, playRegionDiscovery } from './cinematicsRegion.js';
export { SUN_FALL_CAPTIONS, SUN_RANK, playSunFallAnimation } from './cinematicsSun.js';
export { playTitleScreen } from './cinematicsTitle.js';
