/**
 * sfxRecipes.js — Recettes de synthèse des effets sonores — OUTIL DE BUILD, pas chargé par le jeu.
 *
 * Données pures : sfxRecipe(event, payload) renvoie les notes (`tones` : [délai s, fréquence Hz, durée s, gain relatif, onde])
 * et les rafales de bruit filtré (`noises` : [délai, durée, gain relatif, fréquence départ, fréquence fin, type de filtre])
 * d'un effet, chacune avec un multiplicateur de gain. tools/audio/render.mjs les rend hors ligne en MP3 (audio/sfx/).
 */
export function sfxRecipe(eventName, payload = {}) {
    const len = Math.max(3, Math.min(7, Number(payload.length) || 3));
    const isPlayer = payload.isPlayer !== false;
    const tones = [];
    const noises = [];
    const playPattern = (pattern, options = {}) => { const gain = options.gain ?? 1; pattern.forEach(p => tones.push({ p, gain })); };
    const playNoise = (bursts, options = {}) => { const gain = options.gain ?? 1; bursts.forEach(b => noises.push({ b, gain })); };

    switch (eventName) {
        case 'uiClick':
            playPattern([[0, 640, 0.07, 0.7, 'triangle']]);
            break;
        case 'toggleOn':
            playPattern([
                [0,    480, 0.06, 0.8, 'triangle'],
                [0.05, 720, 0.09, 1,   'triangle']
            ]);
            break;
        case 'swap':
            playPattern([
                [0,    380, 0.045, 0.7,  'square'],
                [0.04, 460, 0.045, 0.55, 'square']
            ]);
            break;
        case 'invalid':
            playPattern([
                [0,    220, 0.07, 0.75, 'sawtooth'],
                [0.04, 170, 0.08, 0.65, 'sawtooth']
            ]);
            break;
        case 'match': {
            const type = payload.matchType || 'color';
            const base = type === 'skull' ? 210 : type === 'combat' ? 300 : 520;
            const wave = type === 'color' ? 'triangle' : 'square';
            playPattern([
                [0,    base,            0.06, 0.7, wave],
                [0.05, base + len * 20, 0.09, 0.9, wave]
            ]);
            break;
        }
        case 'turnBonus':
            playPattern([
                [0,    520, 0.06, 0.7, 'triangle'],
                [0.05, 700, 0.06, 0.8, 'triangle'],
                [0.1,  900, 0.08, 1,   'triangle']
            ]);
            break;
        case 'spellCast':   // formule : souffle montant + tintement
            playNoise([[0, 0.22, 0.35, 500, 3200, 'bandpass']]);
            playPattern([
                [0,    430, 0.08, 0.5, 'sine'],
                [0.05, 640, 0.1,  0.6, 'triangle'],
                [0.12, 860, 0.12, 0.55, 'sine']
            ]);
            break;
        case 'spellHit':    // le sort frappe : choc sourd + éclat magique
            playNoise([[0, 0.16, 0.9, isPlayer ? 1800 : 900, 160, 'lowpass']]);
            playPattern([
                [0,     isPlayer ? 150 : 110, 0.14, 1,   'sine'],
                [0.02,  isPlayer ? 760 : 300, 0.08, 0.6, 'square'],
                [0.06,  isPlayer ? 980 : 240, 0.1,  0.4, 'triangle']
            ]);
            break;
        case 'heal':
            playPattern([
                [0,    430, 0.07, 0.65, 'sine'],
                [0.05, 560, 0.08, 0.8,  'sine'],
                [0.11, 720, 0.08, 0.95, 'sine']
            ]);
            break;
        case 'weaponHit':   // coup d'arme : sifflement de lame puis impact sourd
            playNoise([
                [0,    0.07, 0.5, 4200, 1200, 'bandpass'],
                [0.05, 0.16, 1,   1400, 140,  'lowpass']
            ]);
            playPattern([
                [0.05, isPlayer ? 130 : 105, 0.14, 1, 'sine'],
                [0.05, isPlayer ? 210 : 170, 0.05, 0.6, 'square']
            ]);
            break;
        case 'skullHit':    // attaque par alignement de crânes : coup de poing lourd, plus fort selon la longueur
            playNoise([[0, 0.12 + len * 0.02, 0.9, 1500, 120, 'lowpass']]);
            playPattern([
                [0,    isPlayer ? 120 : 95, 0.16 + len * 0.01, 1,    'sine'],
                [0.02, isPlayer ? 190 : 150, 0.07, 0.6, 'square'],
                ...(len >= 4 ? [[0.07, 90, 0.16, 0.8, 'sine']] : [])
            ]);
            break;
        case 'manaGain': {  // mana récolté : scintillement magique ascendant (plus long avec la longueur)
            const notes = [880, 1108, 1318, 1760, 2093, 2637];
            const n = Math.min(notes.length, 2 + Math.floor(len / 2));
            const pat = [];
            for (let k = 0; k < n; k++) pat.push([k * 0.045, notes[k], 0.22, 0.45 + k * 0.05, 'sine'], [k * 0.045, notes[k] * 2.01, 0.12, 0.15, 'sine']);
            playPattern(pat, { gain: isPlayer ? 1 : 0.5 });
            break;
        }
        case 'combatStart': case 'bossStart': {
            // Jingle d'entrée en combat (façon Pokémon) : martèlement alterné rapide, montée pentatonique, note tenue.
            // Durée ≈ COMBAT_INTRO_MS : la musique de combat démarre juste après (voir main.js).
            const boss = eventName === 'bossStart';
            const lo = boss ? 164.8 : 329.6, hi = boss ? 196 : 392;
            const wave = boss ? 'sawtooth' : 'square';
            const p = [];
            const hits = boss ? 8 : 6;
            for (let i = 0; i < hits; i++) p.push([i * 0.075, i % 2 ? hi : lo, 0.06, 0.8, wave]);
            const t0 = hits * 0.075 + 0.05;
            const run = boss ? [220, 261.6, 329.6, 392, 440, 523.3] : [440, 523.3, 659.3, 784];
            run.forEach((f, i) => p.push([t0 + i * 0.09, f, 0.1, 0.85, wave]));
            const tEnd = t0 + run.length * 0.09;
            const top = run[run.length - 1];
            p.push([tEnd, top, 0.45, 1, 'triangle'], [tEnd, top / 2, 0.45, 0.8, wave], [tEnd, top * 1.5, 0.45, 0.5, 'triangle']);
            p.push([0, 90, 0.18, 1, 'sine'], [tEnd, 70, 0.25, 1, 'sine']);
            playPattern(p, { gain: boss ? 1.1 : 1 });
            break;
        }
        case 'victory':
            playPattern([
                [0,    520, 0.08, 0.75, 'triangle'],
                [0.08, 660, 0.08, 0.85, 'triangle'],
                [0.16, 880, 0.12, 1,    'triangle']
            ]);
            break;
        case 'defeat':
            playPattern([
                [0,    320, 0.1,  0.7,  'sawtooth'],
                [0.08, 240, 0.12, 0.85, 'sawtooth'],
                [0.18, 160, 0.18, 0.95, 'triangle']
            ]);
            break;
        case 'battleStart': // petit motif de début de combat
            playPattern([
                [0,    330, 0.09, 0.8, 'square'],
                [0.1,  330, 0.09, 0.8, 'square'],
                [0.2,  440, 0.09, 0.9, 'square'],
                [0.3,  523, 0.18, 1,   'square'],
                [0.3,  262, 0.18, 0.5, 'triangle']
            ]);
            break;
        case 'bossStart': // fanfare plus grave et plus longue pour les boss
            playPattern([
                [0,    196, 0.16, 0.9, 'sawtooth'],
                [0.18, 196, 0.16, 0.9, 'sawtooth'],
                [0.36, 233, 0.16, 0.95, 'sawtooth'],
                [0.54, 294, 0.16, 1,   'sawtooth'],
                [0.72, 392, 0.32, 1,   'square'],
                [0.72, 196, 0.32, 0.7, 'triangle'],
                [1.1,  370, 0.45, 1,   'square'],
                [1.1,  185, 0.45, 0.7, 'triangle']
            ]);
            break;
        case 'introJingle': // lent et mystérieux, façon chant du Fusang
            playPattern([
                [0,   262, 0.5, 0.6, 'triangle'], [0.6, 330, 0.5, 0.6, 'triangle'],
                [1.2, 392, 0.5, 0.7, 'triangle'], [1.8, 523, 0.9, 0.8, 'triangle'],
                [3.5, 392, 0.2, 0.7, 'square'],   [3.8, 392, 0.2, 0.7, 'square'],
                [4.1, 494, 0.2, 0.8, 'square'],   [4.4, 587, 0.6, 0.9, 'square'],
                [6.5, 392, 0.3, 0.9, 'square'],   [6.9, 523, 0.3, 0.9, 'square'],
                [7.3, 659, 0.9, 1,   'square'],   [7.3, 330, 0.9, 0.5, 'triangle']
            ]);
            break;
        case 'endingJingle': // berceuse apaisée
            playPattern([
                [0,   392, 0.6, 0.6, 'sine'], [0.7, 440, 0.6, 0.6, 'sine'],
                [1.4, 523, 0.9, 0.7, 'sine'], [2.6, 440, 0.6, 0.6, 'sine'],
                [3.3, 392, 0.6, 0.6, 'sine'], [4.0, 330, 1.2, 0.7, 'sine'],
                [6.0, 392, 0.6, 0.6, 'sine'], [6.7, 523, 0.6, 0.7, 'sine'],
                [7.4, 659, 1.0, 0.8, 'sine'], [8.8, 523, 0.8, 0.7, 'sine'],
                [9.8, 392, 1.8, 0.7, 'sine'], [9.8, 196, 1.8, 0.4, 'triangle']
            ]);
            break;
        default:
            playPattern([[0, 500, 0.05, 0.6, 'sine']]);
            break;
    }
    return { tones, noises };
}
