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
                '#########',
                '##......#',
                '##......#',
                '#.$..#..#',
                '#.#**#..#',
                '#.$..$.##',
                '#..*##@##',
                '#########'
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
                '#########',
                '###.##..#',
                '#...$...#',
                '#...##*.#',
                '#..#@*$.#',
                '#.#.$..##',
                '#...#.*.#',
                '#########'
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
                '#########',
                '###.##..#',
                '#.$@$...#',
                '#...##*.#',
                '#..#.*$.#',
                '#.#....##',
                '#...#.*.#',
                '#########'
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
                '#############',
                '#\\....//./..#',
                '#..#...\\.#..#',
                '#../../..///#',
                '#...........#',
                '#....#.>.*\\.#',
                '#Ta...#T...\\#',
                '#......./a..#',
                '#############'
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
                '#############',
                '#T.\\./.\\./.\\#',
                '#.a........##',
                '#...........#',
                '#/.\\..\\.....#',
                '#.>..*.\\.\\./#',
                '#.#..\\..#...#',
                '#...b.#../.T#',
                '#############'
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
                '#############',
                '#/.\\.#\\..../#',
                '#...........#',
                '#\\....\\...#.#',
                '#.v\\\\....T#T#',
                '#\\*........\\#',
                '#\\\\..\\.#....#',
                '#/..\\...ba..#',
                '#############'
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
                { id: 'b31973741', x: 2, y: 1, w: 1, h: 2 },
                { id: 'b3197854', x: 5, y: 0, w: 1, h: 3 },
                { id: 'b3221096', x: 2, y: 3, w: 1, h: 2 },
                { id: 'b32385315', x: 4, y: 4, w: 2, h: 1 },
                { id: 'b33067596', x: 4, y: 1, w: 1, h: 3 },
                { id: 'b33664559', x: 1, y: 3, w: 1, h: 2 },
                { id: 'b33777704', x: 3, y: 4, w: 1, h: 2 }
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
                { id: 'b31973741', x: 2, y: 1, w: 1, h: 2 },
                { id: 'b3197854', x: 5, y: 0, w: 1, h: 3 },
                { id: 'b3221096', x: 2, y: 3, w: 1, h: 2 },
                { id: 'b32385315', x: 4, y: 4, w: 2, h: 1 },
                { id: 'b33067596', x: 4, y: 1, w: 1, h: 3 },
                { id: 'b33664559', x: 1, y: 3, w: 1, h: 2 },
                { id: 'b33777704', x: 3, y: 4, w: 1, h: 2 },
                { id: 'b38943554', x: 4, y: 5, w: 2, h: 1 },
                { id: 'b39183111', x: 0, y: 4, w: 1, h: 2 },
                { id: 'b53738944', x: 1, y: 0, w: 2, h: 1 },
                { id: 'b61636731', x: 3, y: 2, w: 1, h: 2 }
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
                { id: 'b5480574', x: 3, y: 2, w: 1, h: 2 },
                { id: 'b54805213', x: 2, y: 0, w: 1, h: 2 },
                { id: 'b54814176', x: 4, y: 0, w: 1, h: 3 },
                { id: 'b55007725', x: 3, y: 0, w: 1, h: 2 },
                { id: 'b55073323', x: 2, y: 4, w: 2, h: 1 },
                { id: 'b5516535', x: 3, y: 5, w: 2, h: 1 },
                { id: 'b55192499', x: 2, y: 2, w: 1, h: 2 },
                { id: 'b65450436', x: 5, y: 0, w: 1, h: 2 },
                { id: 'b65598716', x: 1, y: 5, w: 2, h: 1 },
                { id: 'b65984584', x: 0, y: 0, w: 2, h: 1 },
                { id: 'b82957181', x: 4, y: 3, w: 2, h: 1 },
                { id: 'b17453277', x: 0, y: 4, w: 1, h: 2 }
            ]
        }
    },
    marees_jarres: {
        title: 'Les jarres du toit flottant',
        mode: 'push',
        set: 'jarres',
        intro: 'Une jarre coincée entre deux pieux cache le coffret. Poussez chaque jarre sur son socle rouge ; on ne pousse qu\'une jarre à la fois et on ne peut jamais la tirer.',
        hint: 'Une jarre collée à un mur ne peut plus que glisser le long de celui-ci : n\'en coincez pas dans un angle.',
        level: {
            grid: [
                '#########',
                '#.#.##..#',
                '##......#',
                '#..$.#**#',
                '#.#.#.#*#',
                '#.$$....#',
                '#...#@.##',
                '#########'
            ]
        }
    },
    fusang_miroirs: {
        title: 'Les miroirs de Fusang',
        mode: 'mirror',
        set: 'lumiere',
        intro: 'Les feuilles de Fusang renvoient la lumière du matin. Touchez un miroir pour le faire basculer et éclairez tous les cristaux ; le prisme laisse passer le rayon et en renvoie un second sur le côté.',
        hint: 'Suivez le rayon depuis la lanterne, miroir après miroir ; le prisme sépare le rayon en deux, un pour chaque cristal.',
        level: {
            grid: [
                '#############',
                '#/.\\..../\\..#',
                '#.....\\.*./b#',
                '#.#.\\#..^...#',
                '#......\\./..#',
                '#.././..#T.##',
                '#./..../..\\.#',
                '#..T.\\....a/#',
                '#############'
            ]
        }
    },
    marees_charrette: {
        title: 'La charrette du radeau-marché',
        mode: 'slide',
        set: 'charrette',
        intro: 'Le radeau-marché est encombré de charrettes. Faites sortir la charrette rouge par l\'ouverture verte : chaque bloc ne glisse que dans le sens de sa longueur. Touchez un bloc pour le choisir, puis une case libre dans son axe.',
        hint: 'Libérez d\'abord la rangée de la charrette rouge, en commençant par le bloc qui la gêne le plus tôt.',
        level: {
            w: 6, h: 6, exit: { side: 'right', at: 2 },
            blocks: [
                { id: 'H', x: 0, y: 2, w: 2, h: 1, hero: true },
                { id: 'b5480574', x: 3, y: 2, w: 1, h: 2 },
                { id: 'b54805213', x: 2, y: 0, w: 1, h: 2 },
                { id: 'b54814176', x: 4, y: 0, w: 1, h: 3 },
                { id: 'b55007725', x: 3, y: 0, w: 1, h: 2 },
                { id: 'b55073323', x: 2, y: 4, w: 2, h: 1 },
                { id: 'b5516535', x: 3, y: 5, w: 2, h: 1 },
                { id: 'b55192499', x: 2, y: 2, w: 1, h: 2 },
                { id: 'b65450436', x: 1, y: 3, w: 1, h: 2 },
                { id: 'b65598716', x: 1, y: 5, w: 2, h: 1 },
                { id: 'b65984584', x: 0, y: 0, w: 2, h: 1 },
                { id: 'b82957181', x: 4, y: 3, w: 2, h: 1 },
                { id: 'b17453277', x: 0, y: 4, w: 1, h: 2 },
                { id: 'b71638739', x: 5, y: 0, w: 1, h: 2 }
            ]
        }
    }
};

// Familles d'énigmes = armures antiques (ANTIQUE_ARMORS dans stuff.js, même clé) : chaque énigme résolue donne la pièce de même rang
// (`pieces`, dans l'ordre de `puzzlesOfSet` : casque, collier, bracelet, bague) : 4 énigmes, 4 pièces par famille.
export const PUZZLE_SETS = {
    jarres: { label: 'Jarres', pieces: ['jarres_heaume', 'jarres_gorgerin', 'jarres_brassard', 'jarres_anneau'] },
    lumiere: { label: 'Lumière', pieces: ['prisme_heaume', 'prisme_gorgerin', 'prisme_brassard', 'prisme_anneau'] },
    charrette: { label: 'Charrette', pieces: ['charrette_heaume', 'charrette_gorgerin', 'charrette_brassard', 'charrette_anneau'] }
};

export const puzzlesOfSet = set => Object.keys(PUZZLES).filter(id => PUZZLES[id].set === set);
/** Famille complète (toutes ses énigmes résolues) ? `solved` = ids résolus. */
export const isSetComplete = (set, solved) => puzzlesOfSet(set).every(id => solved.includes(id));
/** Pièce d'armure antique offerte par une énigme (ou null). */
export const pieceOfPuzzle = id => { const set = PUZZLES[id]?.set; return set ? PUZZLE_SETS[set].pieces[puzzlesOfSet(set).indexOf(id)] || null : null; };

export const puzzleDef = id => PUZZLES[id] ? { id, ...PUZZLES[id] } : null;
