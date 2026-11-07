// Sorts avancés multi-qì (balayage de lignes, couleur, pluie d étoiles, tempête, rage) et ultimes. Extrait de classSpellEffects.js.
import { escapeHtml } from "./escapeHtml.js";
import { flyManaGain, flyHeal } from './manaFlight.js';
import { player, enemy, currentTurn, log, saveUpdate, showCombatAnimation, applyDamage, lastSpellDamage, addBonusTurn } from './game.js';
import { board, renderBoard, setBoardTargetingMode, checkMatches, flashTiles, suppressMatchBonusTurnsUntilSettled } from './board.js';
import { colors, boardSize } from './constants.js';
import { stackStatusEffect, addStatBuff } from './combatStats.js';
import { addRage, resetRage, rageToManaAmount, rageToDamageAmount } from './ultimates.js';
import { boostedRageGain } from './attributes.js';
import { collectDestroyedColorTilesMana, getCurrentCaster, getManaCap } from './classSpellEffects.js';

// ── Sorts avancés multi-qì ────────────────────────────────────────────────

const MANA_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

// Couleurs « en accord » avec le sort : seules les cases de ces couleurs infligent des dégâts.
function spellDamageColors(spell) {
    if(Array.isArray(spell.colors) && spell.colors.length > 0) return spell.colors;
    if(spell.color) return [spell.color];
    return Object.keys(spell.cost || {});
}

const PREVIEW_MS = 900;

// Montre au joueur les cases qui vont disparaître (pulsation), les cases de la couleur du sort ressortent.
// Les clics sur le plateau sont ignorés pendant l'aperçu.
function previewIndices(spell, indices) {
    const tiles = document.getElementById('board')?.children;
    const unique = [...new Set(indices)];
    if(!tiles || unique.length === 0) return Promise.resolve();
    const hitColors = spellDamageColors(spell);
    setBoardTargetingMode({ highlightPredicate: () => false, onTileClick: () => true });
    unique.forEach(i => {
        if(!tiles[i]) return;
        tiles[i].classList.add('spell-preview');
        if(hitColors.includes(board[i])) tiles[i].classList.add('spell-preview-hit');
    });
    return new Promise(resolve => setTimeout(() => {
        unique.forEach(i => tiles[i]?.classList.remove('spell-preview', 'spell-preview-hit'));
        setBoardTargetingMode(null);
        resolve();
    }, PREVIEW_MS));
}

// Détruit les cases `indices` : récupère le qì des gemmes de couleur et inflige `dmgPerTile` par case détruite
// dont la couleur est l'une de celles du sort (les autres cases sont détruites sans dégâts).
function destroyIndices(spell, indices, title, label) {
    const caster = getCurrentCaster();
    const unique = [...new Set(indices)].filter(i => board[i] !== null && board[i] !== undefined);
    const destroyedTiles = unique.map(i => board[i]);
    unique.forEach(i => { board[i] = null; });
    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
    const hitColors = spellDamageColors(spell);
    const hits = destroyedTiles.filter(t => hitColors.includes(t)).length;
    let dmg = Math.max(0, Math.floor(spell.dmgPerTile || 0)) * hits;
    if(dmg > 0) { applyDamage(enemy, dmg, { sourceSpell: spell }); dmg = lastSpellDamage(dmg); }
    const special = manaCollected.special;
    renderBoard();
    const extras = `${special.arrows ? ` • +${special.arrows} flèche(s)` : ''}${special.skulls ? ` • ${special.skulls} crâne(s) : -${special.skullDmg} PV` : ''}`;
    showCombatAnimation({ icon: 'bolt', title, damage: dmg > 0 ? `-${dmg} dégâts` : 'Aucun dégât', target: `${label} • ${hits} case(s) de la couleur du sort • +${manaCollected.total} qì${extras}` }, true);
    log(`${spell.name} : ${label}, ${hits} case(s) de la couleur du sort, ${dmg} dégâts, +${manaCollected.total} qì récupéré.`);
    return { count: unique.length, hits, dmg, mana: manaCollected.total };
}

export const rowIndices = row => Array.from({ length: boardSize }, (_, c) => row * boardSize + c);
const colIndices = col => Array.from({ length: boardSize }, (_, r) => r * boardSize + col);

function randomPicks(kind, count) {
    return [...Array(boardSize).keys()].sort(() => Math.random() - 0.5).slice(0, Math.max(0, count)).map(n => ({ kind, n }));
}

// Le joueur choisit lui-même ses lignes/colonnes : un clic sur une case désigne sa ligne ou sa colonne (selon l'étape),
// les lignes déjà choisies restent marquées. Renvoie les lignes/colonnes `{ kind: 'row'|'col', n }`.
// L'adversaire (ou un plateau absent) tire au hasard.
function pickLines(spell, plan) {
    const rowsWanted = plan.filter(k => k === 'row').length;
    const colsWanted = plan.filter(k => k === 'col').length;
    if(currentTurn === 'enemy' || !document.getElementById('board')) {
        return Promise.resolve([...randomPicks('row', rowsWanted), ...randomPicks('col', colsWanted)]);
    }
    return new Promise(resolve => {
        const picks = [];
        const tiles = document.getElementById('board').children;
        const hint = document.createElement('div');
        hint.className = 'spell-pick-hint';
        document.body.appendChild(hint);
        const updateHint = () => {
            const kind = plan[picks.length];
            const left = plan.length - picks.length;
            hint.textContent = `${spell.name} : choisissez ${kind === 'row' ? 'une ligne' : 'une colonne'} (${left} restante${left > 1 ? 's' : ''})`;
        };
        updateHint();
        log(`${spell.name} : choisissez ${rowsWanted ? `${rowsWanted} ligne(s)` : ''}${rowsWanted && colsWanted ? ' puis ' : ''}${colsWanted ? `${colsWanted} colonne(s)` : ''}.`);
        setBoardTargetingMode({
            highlightPredicate: () => true,
            onTileClick: (index) => {
                const kind = plan[picks.length];
                const n = kind === 'row' ? Math.floor(index / boardSize) : index % boardSize;
                if(picks.some(p => p.kind === kind && p.n === n)) return true;   // déjà choisie
                picks.push({ kind, n });
                (kind === 'row' ? rowIndices(n) : colIndices(n)).forEach(i => tiles[i]?.classList.add('spell-selected'));
                if(picks.length < plan.length) { updateHint(); return true; }
                picks.forEach(p => (p.kind === 'row' ? rowIndices(p.n) : colIndices(p.n)).forEach(i => tiles[i]?.classList.remove('spell-selected')));
                hint.remove();
                setBoardTargetingMode(null);
                resolve(picks);
                return true;
            }
        });
    });
}

const picksToIndices = picks => picks.flatMap(p => (p.kind === 'row' ? rowIndices(p.n) : colIndices(p.n)));

export function applySweepLines(spell, shape) {
    setBoardTargetingMode({
        highlightPredicate: () => true,
        onTileClick: (index) => {
            const row = Math.floor(index / boardSize);
            const col = index % boardSize;
            const indices = shape === 'cross' ? [...rowIndices(row), ...colIndices(col)] : shape === 'col' ? colIndices(col) : rowIndices(row);
            setBoardTargetingMode(null);
            previewIndices(spell, indices).then(() => {
                destroyIndices(spell, indices, spell.name.toUpperCase(), shape === 'cross' ? 'Ligne et colonne détruites' : shape === 'col' ? 'Colonne détruite' : 'Ligne détruite');
                saveUpdate();
                suppressMatchBonusTurnsUntilSettled(); // pas de tours bonus en chaîne via un sort de plateau
                checkMatches(true);
            });
            return true;
        }
    });
    log(`${spell.name} : choisissez ${shape === 'cross' ? 'le centre de la croix' : shape === 'col' ? 'la colonne à détruire' : 'la ligne à détruire'}.`);
    return false;
}

// Détruit toutes les gemmes des couleurs du sort (aperçu des cases visées, puis qì récupéré et dégâts par gemme).
export async function applyClearColor(spell) {
    const hitColors = spellDamageColors(spell);
    const indices = [];
    board.forEach((tile, i) => { if(hitColors.includes(tile)) indices.push(i); });
    if(indices.length === 0) {
        log(`${spell.name} : aucune gemme de cette couleur sur le plateau.`);
        return false;
    }
    await previewIndices(spell, indices);
    destroyIndices(spell, indices, spell.name.toUpperCase(), `${indices.length} gemmes détruites`);
    saveUpdate();
    suppressMatchBonusTurnsUntilSettled(); // pas de tours bonus en chaîne via un sort de plateau
    checkMatches(true);
    return false;
}

export function applySkullsFromColors(spell) {
    const converted = Array.isArray(spell.convert) ? spell.convert : [];
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(converted.includes(board[i])) {
            board[i] = 'skull';
            count++;
        }
    }
    if(count === 0) {
        log(`Aucune gemme à transformer en crâne.`);
        return false;
    }
    renderBoard();
    showCombatAnimation({ icon: 'skull', title: spell.name.toUpperCase(), damage: `${count} gemmes → crânes`, target: '→ Plateau' }, true);
    log(`${spell.name} transforme ${count} gemmes en crânes !`);
    suppressMatchBonusTurnsUntilSettled(); // pas de tours bonus en chaîne via les gros alignements de crânes
    checkMatches(true);
    return false;
}

export function applyCageEnemy(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    if(!enemy.statusEffects) enemy.statusEffects = {};
    enemy.statusEffects.stunned = Math.max(enemy.statusEffects.stunned || 0, turns);
    const drain = Math.max(0, Math.floor(spell.manaDrain || 0));
    let drained = 0;
    MANA_COLORS.forEach(color => {
        const amount = Math.min(drain, enemy.mana?.[color] || 0);
        if(amount > 0) { enemy.mana[color] -= amount; drained += amount; }
    });
    showCombatAnimation({ icon: 'snow', title: spell.name.toUpperCase(), damage: `Étourdi ${turns} tours`, target: `→ ${enemy.name} • -${drained} qì` }, true);
    log(`${spell.name} étourdit l'ennemi ${turns} tours et lui retire ${drained} qì.`);
    return true;
}

export function applySecondWind(spell) {
    const heal = Math.max(0, Math.floor(spell.heal || 0));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    flyHeal(true, heal);
    ['poisoned', 'poisonDamage', 'stunned', 'weakened', 'weakenedAmount', 'confused'].forEach(k => { delete player.statusEffects[k]; });
    addBonusTurn(player);
    showCombatAnimation({ icon: 'leaf', title: spell.name.toUpperCase(), heal: `+${heal} PV • statuts purgés`, target: '→ Vous • rejouez !' }, true);
    log(`${spell.name} soigne ${heal} PV, retire les statuts négatifs et vous laisse rejouer.`);
    return true;
}

export async function applyStarRain(spell) {
    const rows = Math.max(1, spell.rows || 2);
    const cols = Math.max(1, spell.columns || 2);
    const picks = await pickLines(spell, [...Array(rows).fill('row'), ...Array(cols).fill('col')]);
    const indices = picksToIndices(picks);
    await previewIndices(spell, indices);
    destroyIndices(spell, indices, spell.name.toUpperCase(), `${rows} lignes et ${cols} colonnes détruites`);
    saveUpdate();
    suppressMatchBonusTurnsUntilSettled(); // pas de tours bonus en chaîne via un sort de plateau
    checkMatches(true);
    return false;
}

export function applyHarmony(spell) {
    let dmg = Math.max(0, Math.floor(spell.dmg || 0));
    const heal = Math.max(0, Math.floor(spell.heal || 0));
    const drain = Math.max(0, Math.floor(spell.manaDrain || 0));
    applyDamage(enemy, dmg, { sourceSpell: spell });
    dmg = lastSpellDamage(dmg);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    flyHeal(true, heal);
    MANA_COLORS.forEach(color => { enemy.mana[color] = Math.max(0, (enemy.mana[color] || 0) - drain); });
    showCombatAnimation({ icon: 'yinyang', title: spell.name.toUpperCase(), damage: `-${dmg} dégâts`, heal: `+${heal} PV`, target: `→ ${enemy.name} • -${drain} qì de chaque couleur` }, true);
    log(`${spell.name} inflige ${dmg} dégâts, vous soigne de ${heal} PV et vide ${drain} qì de chaque couleur à l'ennemi.`);
    return true;
}

export async function applySummonTempest(spell) {
    const caster = getCurrentCaster();
    const colsToDestroy = Math.max(1, Math.min(boardSize, Math.floor(spell.columns || 1)));

    // Le joueur choisit ses colonnes (tirage au hasard pour l'adversaire).
    const picks = await pickLines(spell, Array(colsToDestroy).fill('col'));
    const pickedCols = picks.map(p => p.n);

    // Les colonnes visées sont montrées avant d'être détruites.
    await previewIndices(spell, pickedCols.flatMap(colIndices));

    const destroyedTiles = [];
    pickedCols.forEach(col => {
        for(let row = 0; row < boardSize; row++) {
            destroyedTiles.push(board[row * boardSize + col]);
            board[row * boardSize + col] = null;
        }
    });

    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
    // Seules les cases des couleurs du sort infligent des dégâts (sorts sans couleur propre : toutes les cases comptent).
    let hits = destroyedTiles.length;
    if(spell.colors?.length || spell.color) hits = destroyedTiles.filter(t => spellDamageColors(spell).includes(t)).length;
    let dmg = spell.dmgPerTile ? Math.floor(spell.dmgPerTile) * hits : 0;
    if(dmg > 0) { applyDamage(enemy, dmg, { sourceSpell: spell }); dmg = lastSpellDamage(dmg); }
    const special = manaCollected.special;

    renderBoard();
    showCombatAnimation({ icon: 'bolt', title: (spell.name || "Appel du Vent Céleste").toUpperCase(), damage: spell.dmgPerTile ? (dmg > 0 ? `-${dmg} dégâts` : 'Aucun dégât') : `${pickedCols.length} colonnes détruites`, target: `${pickedCols.length} colonnes détruites • +${manaCollected.total} qì récupéré${special.arrows ? ` • +${special.arrows} flèche(s)` : ''}${special.skulls ? ` • ${special.skulls} crâne(s) : -${special.skullDmg} PV` : ''}` }, true);
    log(`${spell.name || 'Appel du Vent Céleste'} détruit ${pickedCols.length} colonne(s)${spell.dmgPerTile ? `, ${hits} case(s) de la couleur du sort, ${dmg} dégâts` : ''} et ${escapeHtml(caster.name)} récupère ${manaCollected.total} qì.`);
    return true;
}

// Sorts de rage : gain, conversion en qì, conversion en dégâts.
export function applyRageGain(spell) {
    const gained = addRage(player, boostedRageGain(player, spell.rageGain));
    showCombatAnimation({ icon: 'anger', title: (spell.name || "SANG EN ÉBULLITION").toUpperCase(), heal: `+${gained} rage`, target: '→ Vous' }, true);
    log(`${spell.name} donne +${gained} rage.`);
    return true;
}

export function applyRageToMana(spell) {
    const each = rageToManaAmount(player.rage, spell.manaPerRage);
    if(each <= 0) {
        log(`Pas assez de rage à convertir en qì.`);
        return false;
    }
    const gains = {};
    MANA_COLORS.forEach(color => {
        const gain = Math.min(each, Math.max(0, getManaCap(color) - (player.mana[color] || 0)));
        player.mana[color] = (player.mana[color] || 0) + gain;
        gains[color] = gain;
    });
    resetRage(player);
    flyManaGain(true, gains);
    showCombatAnimation({ icon: 'spark', title: (spell.name || "SOUFFLE DE LA COLÈRE").toUpperCase(), heal: `+${each} qì de chaque couleur`, target: '→ Vous' }, true);
    log(`${spell.name} convertit toute la rage en ${each} qì de chaque couleur.`);
    return true;
}

export function applyRageToDamage(spell) {
    let dmg = rageToDamageAmount(player.rage, spell.dmgPerRage);
    if(dmg <= 0) {
        log(`Pas de rage à libérer.`);
        return false;
    }
    resetRage(player);
    applyDamage(enemy, dmg, { sourceSpell: spell });
    dmg = lastSpellDamage(dmg);
    showCombatAnimation({ icon: 'anger', title: (spell.name || "COUP DE LA FUREUR BRISÉE").toUpperCase(), damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`${spell.name} libère toute la rage : ${dmg} dégâts.`);
    return true;
}

export function applyBerserkerRage(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'red') {
            board[i] = 'skull';
            count++;
        }
    }
    if(count > 0) suppressMatchBonusTurnsUntilSettled(); // pas de tours bonus en chaîne via les alignements de crânes
    renderBoard();
    showCombatAnimation({ icon: 'anger', title: "FUREUR DU LOUP DES STEPPES", damage: `${count} rouges → crânes`, target: '→ Plateau' }, true);
    log(`Fureur du Loup des Steppes transforme ${count} gâteaux de lune rouges en crânes !`);
    return true;
}

export function applySingingBlades(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    const manaDrain = Math.max(1, Math.floor(spell.manaDrain || 1));
    player.statusEffects.drainOnHit = turns;
    player.statusEffects.drainOnHitAmount = manaDrain;
    showCombatAnimation({ icon: 'music', title: "FLÈCHES SIFFLANTES", damage: `-${manaDrain} qì / coup`, target: `→ ${enemy.name} (${turns} tours)` }, true);
    log(`Flèches Sifflantes active un drain de ${manaDrain} qì par coup pendant ${turns} tours.`);
    return true;
}

export function applyDeathbringer(spell) {
    const redMana = Math.max(0, Math.floor(player.mana.red || 0));
    const skullsToCreate = Math.floor(redMana / 2);
    if(skullsToCreate <= 0) {
        log(`Pas assez de qì rouge pour créer des crânes.`);
        return false;
    }

    const candidates = board
        .map((tile, index) => ({ tile, index }))
        .filter(entry => colors.includes(entry.tile));

    if(candidates.length <= 0) {
        log(`Aucune gemme de couleur à transformer.`);
        return false;
    }

    const count = Math.min(skullsToCreate, candidates.length);
    const created = [];
    for(let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const target = candidates.splice(idx, 1)[0];
        board[target.index] = 'skull';
        created.push(target.index);
    }

    suppressMatchBonusTurnsUntilSettled(); // pas de tours bonus en chaîne via les alignements de crânes
    renderBoard();
    // une fois l'animation du sort terminée, on montre où les crânes sont apparus
    showCombatAnimation({ icon: 'poison', title: "PORTE-SOLEIL", damage: `${count} crânes créés`, target: '→ Plateau' }, true, { onContinue: () => flashTiles(created) });
    log(`Porte-Soleil crée ${count} crânes (basé sur le qì rouge).`);
    return true;
}

export function applyRevenant(spell) {
    player.statusEffects.revenant = true;
    showCombatAnimation({ icon: 'ghost', title: "ESPRIT DES ANCÊTRES", damage: 'PA doublés', target: '→ Vous' }, true);
    log(`Esprit des Ancêtres : Les points de combat sont maintenant doublés !`);
    return true;
}

// Ultime : gros dégâts + effet annexe selon le sort (soin, étourdissement, bonus de défense, affaiblissement).
export function applyUltimate(spell) {
    log(`ULTIME — ${spell.name} !`);
    applyDamage(enemy, spell.dmg, { sourceSpell: spell });
    showCombatAnimation({ icon: 'fire', title: spell.name.toUpperCase(), damage: `ULTIME ! -${lastSpellDamage(spell.dmg)} dégâts`, target: `→ ${enemy.name}` }, true);
    if(spell.healPercent) {
        const heal = Math.floor(player.maxHp * spell.healPercent / 100);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        log(`${spell.name} soigne ${heal} PV.`);
    }
    if(spell.stunTurns) {
        enemy.statusEffects.stunned = Math.max(enemy.statusEffects.stunned || 0, spell.stunTurns);
        log(`${enemy.name} est étourdi pendant ${spell.stunTurns} tours.`);
    }
    if(spell.defBuff) addStatBuff(player, { defense: spell.defBuff, turns: spell.duration || 1 });
    if(spell.weakenAmount) {
        stackStatusEffect(enemy.statusEffects, 'weakened', 'weakenedAmount', spell.duration, spell.weakenAmount);
        log(`${enemy.name} est affaibli (-${spell.weakenAmount} attaque).`);
    }
    return true;
}
