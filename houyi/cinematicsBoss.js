// Dialogues de début de combat de boss : provocations, répliques, duels et animation d'introduction. Extrait de cinematics.js.
import { icon } from './icons.js';
import { playSfx } from './sound.js';
import { prefersReducedMotion, text } from './cinematicsCore.js';

// ── Dialogues de début de combat de boss ────────────────────────────────────
const SUN_TAUNTS = [
    'Petit archer ! Mon père Di Jun me protège. Tes flèches fondront avant de m\'atteindre !',
    'Pourquoi éteindre la joie ? Nous ne faisions que jouer dans le ciel…',
    'Brûle avec les rizières, Hou Yi ! Je ne tomberai pas comme mes frères.',
    'Neuf d\'entre nous doivent mourir ? Alors je serai le dernier à rire !',
    'Le ciel est à nous. Retourne à ta poussière, mortel !'
];
const SUN_REPLIES = [
    "Je ne tire pas par haine. Je tire pour que la Terre revive.",
    "Le jeu est fini, soleil. Les hommes ont soif, et Chang'e attend la nuit.",
    "Chaque soleil qui tombe lui rend une heure de lune. Tu es le prochain.",
    "Mes flèches n'ont jamais manqué leur but. Pas aujourd'hui : elle m'attend.",
    "Rends-nous la nuit. J'ai promis la fête de la lune à Chang'e."
];
// Gardes, gardiens et chefs de zone : ils protègent un passage ou un soleil, ils ne sont pas des soleils.
const GUARD_TAUNTS = [
    'Halte, archer ! On ne passe pas ici sans me passer sur le corps.',
    'Ma consigne est de tenir cette place. Je la tiendrai jusqu\'au bout.',
    'Tu as de bons yeux, mais pas de laissez-passer. Recule, ou tire.',
    'Beaucoup ont essayé avant toi. Aucun n\'a fini la route.',
    'Je ne te hais pas, étranger. Mais ce que je garde ne se prête pas.'
];
const GUARD_REPLIES = [
    "Je n'en veux pas à ta consigne, seulement à ce qu'elle protège. Écarte-toi.",
    "Je dois passer, gardien. Le monde brûle derrière toi.",
    "Tiens ta place, je tiendrai ma flèche : voyons qui cède le premier.",
    "Je ne cherche pas la bagarre, mais je ne reculerai pas.",
    "Alors défends-toi bien. Je ne tire pas pour tuer, mais pour passer."
];
const FENGMENG_TAUNTS = [
    'Maître… vous avez tout : le renom, l\'élixir, Chang\'e. Moi, que me reste-t-il ?',
    'Je ne serai pas toujours votre disciple. Aujourd\'hui, c\'est moi qui tends l\'arc !',
    'Regardez-moi enfin, Maître. Regardez-moi comme vous regardez les soleils !'
];
const FENGMENG_REPLIES = [
    'Fengmeng… baisse ton arc. Je ne veux pas te blesser.',
    'Tu as du talent, mais la jalousie guide mal les flèches.',
    'Si je dois te vaincre pour te retrouver, alors soit.'
];

// Échanges propres à chaque duel contre Fengmeng (id de l'ennemi de la carte) : [réplique de Fengmeng, réponse].
const FENGMENG_DUEL_LINES = {
    fengmeng_1: ["Montrez-moi, Maître. Montrez-moi enfin ce que vous ne m'avez jamais appris.",
        'Garde ton souffle, Fengmeng. Et vise.'],
    fengmeng_2: ["Ce soleil-là est à moi ! Cette fois, c'est mon nom que les chroniques retiendront.",
        'La gloire ne se vole pas, Fengmeng. Elle te brûlera les doigts.'],
    fengmeng_3a: ["Neuf soleils… Vous tenez à peine debout, Maître. Je connais chacune de vos flèches : l'élixir, maintenant.",
        "Alors tu sais qu'aucune ne t'a jamais visé au cœur."],
    fengmeng_3b: ["Elle a tout bu ! Il ne me reste rien… rien que mes flèches, et la terre où vous tomberez !",
        'Pose ton arc, Fengmeng. Elle ne voudrait pas cela.']
};

// Échanges propres à chaque soleil (id de l'ennemi de la carte) : alternance [soleil, Hou Yi, soleil, Hou Yi].
const SUN_DUEL_LINES = {
    sun_1: [
        "Tu es venu seul, petit archer ? Nous étions dix à jouer dans le ciel, et personne ne nous a jamais dit d'arrêter.",
        "Les rizières sont noires, soleil. Les enfants ne sortent plus. Ce n'est plus un jeu.",
        "Père Di Jun nous a promis l'éternité. Il ne m'a pas parlé d'un homme avec un arc.",
        "Alors il t'a menti. Éteins-toi sans souffrir : je ne tire pas pour faire mal."
    ],
    sun_2: [
        "Tu as vu le fleuve, archer ? Je l'ai bu d'une gorgée. Il avait un goût de jade et de soupirs.",
        "Les poissons agonisent sur la vase. Rends-lui son eau, ou je la lui rends moi-même.",
        "Je ne voulais que me rafraîchir. Est-ce un crime d'avoir soif quand on brûle ?",
        "Non. Mais tu as bu pour tout un village. Je suis désolé, soleil."
    ],
    sun_3: [
        "Regarde mes cendres, Hou Yi. Elles volent jusqu'aux montagnes. Ce sont mes plumes, mes rires.",
        "Ce sont aussi les arbres de ces forêts. Un vieux pin m'a dit ton nom avant de se taire.",
        "Il me parlait de pluie. Je ne savais pas ce que c'était. Est-ce beau ?",
        "Très beau. Je te le promets : tu l'entendras, de l'autre côté de ma flèche."
    ],
    sun_4: [
        "Tu me vois, archer ? Ou vois-tu l'oasis que je t'ai dessinée ? Le désert aime ceux qui doutent.",
        "J'ai déjà bu à trois mirages. Celui-ci est plus soif que les autres.",
        "Tu sens ma chaleur dans ton dos. Elle est dans ta tête depuis que tu as quitté les rizières.",
        "Alors je viserai ce qui ne ment pas : le bruit de ton souffle."
    ],
    sun_5: [
        "Les nuages sont mes tambours, les éclairs mes baguettes ! Écoute, Hou Yi : le ciel parle comme moi !",
        "Il hurle, soleil. Il a peur de toi, et des orages que tu forces.",
        "Peur ? Moi ? Je suis le jeu ! Je suis le tonnerre de mon père Di Jun !",
        "Alors joue encore une fois. La dernière note sera la mienne."
    ],
    sun_6: [
        "Tu as traversé la lave comme on traverse une fête ? Les pixiu montaient la garde pour moi, pas pour toi.",
        "Ils dormaient depuis des siècles. Tu les as éveillés pour te faire un trône de braise.",
        "Le magma est ma chair. Que me restera-t-il, sans lui ? Un caillou froid dans le ciel ?",
        "Une lune, peut-être. Je connais quelqu'un qui s'en contenterait."
    ],
    sun_7: [
        "Mes bêtes sont dans ma flamme, archer. Elles ne te laisseront pas passer sans mordre.",
        "Elles ont mordu, et je les ai épargnées autant que j'ai pu. Les loups hurlent à la lune, maintenant.",
        "Elles se souvenaient de moi. Elles m'aimaient. Pourquoi les as-tu rendues à elles-mêmes ?",
        "Parce qu'on n'aime pas vraiment quand on brûle. Viens, soleil. Il est temps."
    ],
    sun_8: [
        "J'ai bu la marée à chaque coucher du jour. Pourtant la mer est toujours là, et je ne peux plus y entrer.",
        "Tu l'as fait bouillir. Les pêcheurs ne reconnaissent plus leurs filets.",
        "Elle chantait, avant. Maintenant elle crie. Est-ce ma faute ou celle de mon père ?",
        "Celle de ton père, sans doute. Mais c'est toi qui tiens la flamme. C'est toi que je dois arrêter."
    ],
    sun_9: [
        "Huit frères sont tombés, et tu me cherches, Hou Yi ? J'ai peur. Je l'avoue : j'ai peur.",
        "Je n'aime pas tirer sur qui tremble. Rends-toi, et laisse-moi finir ma route.",
        "Me rendre ? Pour que mon père me jette en pâture aux flammes ? Non. Non, je préfère me battre.",
        "Alors bats-toi bien. C'est la dernière chose que je peux t'offrir."
    ]
};

function pick(list, seed) {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return list[h % list.length];
}

// Boss muets : leur visage, leur humeur et leurs gestes sont décrits par le Narrateur ; eux ne disent que « ... ».
export const SILENT_BOSS_LINES = {
    changxi: [
        { who: 'narrator', text: "Changxi ne bouge pas. Allongée contre la balustrade, elle garde les paupières closes, et les douze lunes qui tournent autour de sa tête ralentissent à mesure que vous approchez." },
        { who: 'narrator', text: "Un souffle d'embruns passe sur son visage, long, pâle, d'une beauté fatiguée. Une ride fine entre ses sourcils : celle de quelqu'un qui a veillé trop de nuits sans que personne ne l'en remercie." },
        { who: 'boss', text: '...' },
        { who: 'narrator', text: "Elle ouvre un œil, comme on ouvre une fenêtre sur un ciel qu'on ne connaît que trop. Elle vous regarde longtemps. Ni colère ni mépris : seulement l'attente de savoir si vous allez détourner la tête." },
        { who: 'boss', text: '...' },
        { who: 'narrator', text: "Sa main se lève, lentement, et les lunes se détachent de sa chevelure, une à une. Elle n'a pas dit un mot. Elle n'en a pas besoin : l'épreuve commence." }
    ]
};

// Lignes d'un échange de début de combat de boss : [{ who: 'boss' | 'hero' | 'narrator', text }].
export function bossIntroLines(enc) {
    if (SILENT_BOSS_LINES[enc?.enemyId]) return SILENT_BOSS_LINES[enc.enemyId].map(line => ({ ...line }));
    const name = enc?.boss?.name || enc?.name || 'Boss';
    // Répliques propres à la rencontre (maîtres de l'Arène des Mille Flèches) : [adversaire, héros].
    if (enc?.introLines?.length === 2) return [{ who: 'boss', text: enc.introLines[0] }, { who: 'hero', text: enc.introLines[1] }];
    const sunLines = SUN_DUEL_LINES[enc?.enemyId];
    if (sunLines) return sunLines.map((text, i) => ({ who: i % 2 ? 'hero' : 'boss', text }));
    const duelLines = FENGMENG_DUEL_LINES[enc?.enemyId];
    if (duelLines) return [{ who: 'boss', text: duelLines[0] }, { who: 'hero', text: duelLines[1] }];
    const isRival = /fengmeng/i.test(name);
    const isSun = /^(sun_|mirage_)/.test(enc?.enemyId || '') || /soleil/i.test(name) || !enc?.boss && !enc?.enemyId;
    const taunts = isRival ? FENGMENG_TAUNTS : isSun ? SUN_TAUNTS : GUARD_TAUNTS;
    const replies = isRival ? FENGMENG_REPLIES : isSun ? SUN_REPLIES : GUARD_REPLIES;
    return [
        { who: 'boss', text: pick(taunts, name) },
        { who: 'hero', text: pick(replies, name + enc.level) }
    ];
}

// Boîte de dialogue pixel au-dessus de l'écran de transition : texte tapé lettre à lettre,
// toucher/clic/Entrée/Espace pour accélérer puis passer à la réplique suivante.
// `host` : l'élément `.battle-transition` ; `spriteHtml` : portrait du boss ; renvoie une Promise.
export function playBossDialogue(host, enc, spriteHtml, heroName = 'Hou Yi') {
    const lines = bossIntroLines(enc);
    const bossName = enc.boss?.name || enc.name;
    return new Promise(resolve => {
        const box = document.createElement('div');
        box.className = 'bt-dialog';
        box.innerHTML = `<div class="bt-dialog-portrait"></div>
            <div class="bt-dialog-body"><div class="bt-dialog-name"></div><div class="bt-dialog-text"></div></div>
            <div class="bt-dialog-next">▼</div>`;
        host.appendChild(box);
        const portrait = box.querySelector('.bt-dialog-portrait');
        const nameEl = box.querySelector('.bt-dialog-name');
        const textEl = box.querySelector('.bt-dialog-text');
        const reduced = prefersReducedMotion();
        let idx = 0;
        let typing = null;
        let full = '';
        let pos = 0;
        let ended = false;

        const showLine = () => {
            const line = lines[idx];
            const isBoss = line.who === 'boss', isNarrator = line.who === 'narrator';
            box.classList.toggle('hero', !isBoss && !isNarrator);
            box.classList.toggle('narrator', isNarrator);
            portrait.innerHTML = isBoss || isNarrator ? spriteHtml : icon('bow');   // le Narrateur décrit le boss : son portrait reste à l'écran
            nameEl.textContent = isNarrator ? 'Narrateur' : isBoss ? bossName : heroName;
            full = line.text;
            pos = 0;
            textEl.textContent = '';
            clearInterval(typing);
            if (reduced) { textEl.textContent = full; pos = full.length; return; }
            typing = setInterval(() => {
                pos++;
                textEl.textContent = full.slice(0, pos);
                if (pos % 3 === 0) playSfx('uiClick');
                if (pos >= full.length) clearInterval(typing);
            }, 28);
        };

        const finish = () => {
            if (ended) return;
            ended = true;
            clearInterval(typing);
            document.removeEventListener('keydown', onKey, true);
            host.removeEventListener('pointerdown', advance);
            box.remove();
            resolve();
        };
        const advance = () => {
            if (pos < full.length) { clearInterval(typing); pos = full.length; textEl.textContent = full; return; }
            idx++;
            if (idx >= lines.length) { finish(); return; }
            showLine();
        };
        const onKey = e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); advance(); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(); }
        };
        host.addEventListener('pointerdown', advance);
        document.addEventListener('keydown', onKey, true);
        showLine();
    });
}
