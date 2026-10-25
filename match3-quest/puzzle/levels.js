// Énigmes du jeu : { id, title, mode, intro, hint, level }. Un coffre les référence par `puzzle: '<id>'` (carte du monde) ; la liste est
// la seule chose à compléter pour en ajouter une (le mode doit exister dans modes.js). Chaque niveau est prouvé faisable par un test.
export const PUZZLES = {
    // Pousser : amener les trois caisses sur les cibles rouges sans les coincer contre un mur.
    riz_caisses: {
        title: 'Les jarres du grenier',
        mode: 'push',
        intro: 'Le coffret est calé derrière des jarres. Poussez chaque jarre sur son socle rouge ; on ne peut pousser qu\'une jarre à la fois, jamais la tirer.',
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
    // Miroirs : orienter les miroirs (un appui les bascule) pour éclairer les deux cristaux.
    fleuve_miroirs: {
        title: 'Les miroirs du lutrin',
        mode: 'mirror',
        intro: 'Une lanterne au fond de la haie fait briller le coffret... à condition d\'éclairer les deux cristaux. Touchez un miroir pour le faire basculer ; le prisme laisse passer le rayon et en renvoie un second sur le côté.',
        hint: 'Suivez le rayon depuis la lanterne, miroir après miroir : le prisme sépare le rayon en deux, un pour chaque cristal.',
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
    // Glisser : sortir le bloc rouge par l'ouverture verte en déplaçant les autres blocs le long de leur axe.
    bambous_charrette: {
        title: 'La charrette bloquée',
        mode: 'slide',
        intro: 'Une charrette barre la ruelle. Faites sortir la charrette rouge par l\'ouverture verte : chaque bloc ne glisse que dans le sens de sa longueur. Touchez un bloc pour le choisir, puis une case libre dans son axe.',
        hint: 'Libérez d\'abord la rangée de la charrette rouge, en commençant par le bloc qui la gêne le plus tôt.',
        level: {
            w: 6, h: 6, exit: { side: 'right', at: 2 },
            blocks: [
                { id: 'H', x: 0, y: 2, w: 2, h: 1, hero: true },
                { id: 'b1', x: 2, y: 1, w: 1, h: 2 }, { id: 'b2', x: 3, y: 4, w: 3, h: 1 }, { id: 'b3', x: 2, y: 0, w: 2, h: 1 },
                { id: 'b4', x: 1, y: 5, w: 3, h: 1 }, { id: 'b5', x: 5, y: 0, w: 1, h: 3 }, { id: 'b6', x: 0, y: 0, w: 2, h: 1 },
                { id: 'b7', x: 0, y: 3, w: 3, h: 1 }, { id: 'b8', x: 3, y: 2, w: 1, h: 2 }, { id: 'b9', x: 3, y: 1, w: 2, h: 1 }
            ]
        }
    }
};

export const puzzleDef = id => PUZZLES[id] ? { id, ...PUZZLES[id] } : null;
