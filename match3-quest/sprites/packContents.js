// Paquets de sprites chargés à la demande (import dynamique) et contenu de chacun.
// L'ordre des paquets fixe la priorité en cas de clé partagée (le dernier gagne), comme l'ancien assemblage statique.
export const SPRITE_PACK_FILES = {
    'actors-a': './cn/actors-a.js',
    'actors-b': './cn/actors-b.js',
    'enemies-1': './cn/enemies-1.js',
    'enemies-2': './cn/enemies-2.js',
    suns: './cn/suns.js'
};

// Répartit les exports d'un paquet entre héros, coffres, PNJ et ennemis.
export function packContents(mod) {
    return {
        heroes: mod.HERO_SPRITES || {},
        chests: mod.CHEST_SPRITES || {},
        npcs: { ...(mod.NPC_SPRITES_A || {}), ...(mod.NPC_SPRITES_B || {}) },
        enemies: {
            ...(mod.ENEMY_SPRITES_CN_1 || {}),
            ...(mod.ENEMY_SPRITES_CN_2 || {}),
            ...(mod.BEAST_SPRITES || {}),
            ...(mod.SUN_SPRITES || {}),
            ...(mod.FENGMENG_SPRITES || {})
        }
    };
}
