// Énigmes du jeu : { id, title, mode, intro, hint, level }. Un coffre les référence par `puzzle: '<id>'` (carte du monde) ; la liste est
// la seule chose à compléter pour en ajouter une (le mode doit exister dans modes.js). Chaque niveau est prouvé faisable par un test.
export const PUZZLES = {
    riz_jarres: {
        title: 'Les jarres du grenier',
        mode: 'push',
        set: 'jarres',
        intro: 'Le coffret est calé derrière des jarres. Poussez chaque jarre sur son socle rouge ; on ne pousse qu\'une jarre à la fois et on ne peut jamais la tirer.',
        hint: 'Une jarre collée à un mur ne peut plus que glisser le long de celui-ci : n\'en coincez pas dans un angle.',
        level: {
            grid: [
                '#######',
                '#.....#',
                '#.$.*.#',
                '#.#.#.#',
                '#.$.*@#',
                '#######'
            ]
        }
    },
    gobi_jarres: {
        title: 'Les jarres du caravansérail',
        mode: 'push',
        set: 'jarres',
        intro: 'Des jarres d\'eau encombrent la réserve du caravansérail. Poussez chaque jarre sur son socle rouge ; on ne pousse qu\'une jarre à la fois et on ne peut jamais la tirer.',
        hint: 'Une jarre collée à un mur ne peut plus que glisser le long de celui-ci : n\'en coincez pas dans un angle.',
        level: {
            grid: [
                '########',
                '#....#.#',
                '#.###@.#',
                '#..$...#',
                '#..*.$.#',
                '#..*.#.#',
                '########'
            ]
        }
    },
    fauves_jarres: {
        title: 'Les jarres du marché aux fauves',
        mode: 'push',
        set: 'jarres',
        intro: 'Les jarres de grain du marché cachent le coffret. Poussez chaque jarre sur son socle rouge ; on ne pousse qu\'une jarre à la fois et on ne peut jamais la tirer.',
        hint: 'Une jarre collée à un mur ne peut plus que glisser le long de celui-ci : n\'en coincez pas dans un angle.',
        level: {
            grid: [
                '########',
                '#@....*#',
                '#.$.##.#',
                '#..#.#.#',
                '#*$$...#',
                '##...#*#',
                '########'
            ]
        }
    },
    volcan_miroirs: {
        title: 'Les miroirs du cratère',
        mode: 'mirror',
        set: 'lumiere',
        intro: 'Une lanterne au fond du cratère fait briller le coffret... à condition d\'éclairer les deux cristaux. Touchez un miroir pour le faire basculer et éclairez tous les cristaux ; le prisme laisse passer le rayon et en renvoie un second sur le côté.',
        hint: 'Suivez le rayon depuis la lanterne, miroir après miroir ; le prisme sépare le rayon en deux, un pour chaque cristal.',
        level: {
            grid: [
                '#########',
                '#...\\../#',
                '#......T#',
                '#...*/..#',
                '#.......#',
                '#>..\\T..#',
                '#########'
            ]
        }
    },
    fleuve_miroirs: {
        title: 'Les miroirs du lutrin',
        mode: 'mirror',
        set: 'lumiere',
        intro: 'Une lanterne éclairait jadis le lutrin du fleuve. Touchez un miroir pour le faire basculer et éclairez tous les cristaux ; le prisme laisse passer le rayon et en renvoie un second sur le côté.',
        hint: 'Suivez le rayon depuis la lanterne, miroir après miroir ; le prisme sépare le rayon en deux, un pour chaque cristal.',
        level: {
            grid: [
                '#########',
                '#...#./.#',
                '#..\\*./.#',
                '#.T./.*T#',
                '#T../../#',
                '##.\\\\.\\^#',
                '#########'
            ]
        }
    },
    lune_miroirs: {
        title: 'Les miroirs du Palais froid',
        mode: 'mirror',
        set: 'lumiere',
        intro: 'La lumière de la lune, bien reflétée, ouvrira le coffret. Touchez un miroir pour le faire basculer et éclairez tous les cristaux ; le prisme laisse passer le rayon et en renvoie un second sur le côté.',
        hint: 'Suivez le rayon depuis la lanterne, miroir après miroir ; le prisme sépare le rayon en deux, un pour chaque cristal.',
        level: {
            grid: [
                '#########',
                '#T.\\\\.T.#',
                '#.\\.\\\\..#',
                '#/..*^/.#',
                '#./.\\..*#',
                '#.##....#',
                '#########'
            ]
        }
    },
    bambous_charrette: {
        title: 'La charrette bloquée',
        mode: 'slide',
        set: 'charrette',
        intro: 'Une charrette barre la ruelle de bambous. Faites sortir la charrette rouge par l\'ouverture verte : chaque bloc ne glisse que dans le sens de sa longueur. Touchez un bloc pour le choisir, puis une case libre dans son axe.',
        hint: 'Libérez d\'abord la rangée de la charrette rouge, en commençant par le bloc qui la gêne le plus tôt.',
        level: {
            w: 6, h: 6, exit: { side: 'right', at: 2 },
            blocks: [
                { id: 'H', x: 0, y: 2, w: 2, h: 1, hero: true },
                { id: 'b1', x: 2, y: 1, w: 1, h: 2 },
                { id: 'b2', x: 3, y: 4, w: 3, h: 1 },
                { id: 'b3', x: 2, y: 0, w: 2, h: 1 },
                { id: 'b4', x: 1, y: 5, w: 3, h: 1 },
                { id: 'b5', x: 5, y: 0, w: 1, h: 3 },
                { id: 'b6', x: 0, y: 0, w: 2, h: 1 },
                { id: 'b7', x: 0, y: 3, w: 3, h: 1 },
                { id: 'b8', x: 3, y: 2, w: 1, h: 2 },
                { id: 'b9', x: 3, y: 1, w: 2, h: 1 }
            ]
        }
    },
    tonnerre_charrette: {
        title: 'La charrette du col',
        mode: 'slide',
        set: 'charrette',
        intro: 'Une charrette d\'orage s\'est coincée dans le col. Faites sortir la charrette rouge par l\'ouverture verte : chaque bloc ne glisse que dans le sens de sa longueur. Touchez un bloc pour le choisir, puis une case libre dans son axe.',
        hint: 'Libérez d\'abord la rangée de la charrette rouge, en commençant par le bloc qui la gêne le plus tôt.',
        level: {
            w: 6, h: 6, exit: { side: 'right', at: 2 },
            blocks: [
                { id: 'H', x: 0, y: 2, w: 2, h: 1, hero: true },
                { id: 'b1', x: 3, y: 2, w: 1, h: 2 },
                { id: 'b2', x: 1, y: 1, w: 2, h: 1 },
                { id: 'b3', x: 2, y: 3, w: 1, h: 2 },
                { id: 'b4', x: 3, y: 0, w: 1, h: 2 },
                { id: 'b5', x: 4, y: 0, w: 1, h: 3 },
                { id: 'b6', x: 0, y: 0, w: 2, h: 1 },
                { id: 'b7', x: 2, y: 5, w: 2, h: 1 },
                { id: 'b8', x: 3, y: 4, w: 2, h: 1 },
                { id: 'b9', x: 5, y: 0, w: 1, h: 2 },
                { id: 'b10', x: 4, y: 3, w: 2, h: 1 },
                { id: 'b11', x: 0, y: 3, w: 1, h: 2 }
            ]
        }
    },
    mer_charrette: {
        title: 'La charrette du port',
        mode: 'slide',
        set: 'charrette',
        intro: 'Un amas de charrettes encombre le quai du port. Faites sortir la charrette rouge par l\'ouverture verte : chaque bloc ne glisse que dans le sens de sa longueur. Touchez un bloc pour le choisir, puis une case libre dans son axe.',
        hint: 'Libérez d\'abord la rangée de la charrette rouge, en commençant par le bloc qui la gêne le plus tôt.',
        level: {
            w: 6, h: 6, exit: { side: 'right', at: 2 },
            blocks: [
                { id: 'H', x: 0, y: 2, w: 2, h: 1, hero: true },
                { id: 'b1', x: 1, y: 3, w: 2, h: 1 },
                { id: 'b2', x: 5, y: 2, w: 1, h: 2 },
                { id: 'b3', x: 4, y: 1, w: 1, h: 2 },
                { id: 'b4', x: 2, y: 4, w: 2, h: 1 },
                { id: 'b5', x: 4, y: 3, w: 1, h: 2 },
                { id: 'b6', x: 3, y: 0, w: 3, h: 1 },
                { id: 'b7', x: 1, y: 0, w: 1, h: 2 },
                { id: 'b8', x: 2, y: 1, w: 1, h: 2 },
                { id: 'b9', x: 0, y: 4, w: 1, h: 2 },
                { id: 'b10', x: 5, y: 4, w: 1, h: 2 }
            ]
        }
    }
};

// Familles d'énigmes : quand les trois énigmes d'une famille sont résolues, le héros reçoit la pièce d'armure antique correspondante (stuff.js).
export const PUZZLE_SETS = {
    jarres: { label: 'Jarres', stuff: 'brassard_antique_des_jarres' },
    lumiere: { label: 'Lumière', stuff: 'heaume_antique_du_prisme' },
    charrette: { label: 'Charrette', stuff: 'gorgerin_antique_de_la_charrette' }
};

export const puzzlesOfSet = set => Object.keys(PUZZLES).filter(id => PUZZLES[id].set === set);
/** Famille complète (toutes ses énigmes résolues) ? `solved` = ids résolus. */
export const isSetComplete = (set, solved) => puzzlesOfSet(set).every(id => solved.includes(id));

export const puzzleDef = id => PUZZLES[id] ? { id, ...PUZZLES[id] } : null;
