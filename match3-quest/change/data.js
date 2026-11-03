// Mode Chang'e (UNIVERS-CHANGE.md) : trois épisodes seulement, jouables après la mort des soleils des régions 3, 6 et 9. Chang'e, deux régions
// derrière Hou Yi, soigne cinq habitants d'un village par un puzzle sans ennemi (aucun crâne, aucune flèche : voir engine.js).
// Les habitants sont ceux de world/text/<région>.js (ids vérifiés par tests/unit/change.test.js) ; `color` = énergie demandée,
// `need` = points de soin à recueillir (une tuile de la couleur = 1 point, +1 pour un alignement de quatre, +2 pour cinq), `moves` = coups par tentative ; les soins déjà obtenus sont conservés entre deux tentatives.

export const ENERGY_LABEL = { jade: 'Jade', lotus: 'Lotus', perle: 'Perles lunaires', eau: 'Eau céleste', argent: 'Énergie argentée' };

// Soleil abattu par Hou Yi → épisode de Chang'e.
export const SUN_EPISODE = { sun_4: 1, sun_5: 2, sun_9: 3 };

export const EPISODES = [
    {
        id: 1, sun: 'sun_4', region: 'rizieres', village: 'Hameau de Dongqiao', sky: ['#cfe6a8', '#f3e3a0'], ground: '#b9a45b',
        intro: [
            { who: 'hou', text: 'Le Soleil des Mirages est tombé, Chang\'e. Le désert respire de nouveau.' },
            { who: 'change', text: 'Je le sens, même d\'ici. Dongqiao a encore soif, Hou Yi. Je reste auprès de ceux que tu laisses derrière toi.' },
            { who: 'hou', text: 'Prends soin de toi. Je te rejoindrai dès que le dernier soleil sera tombé.' },
            { who: 'change', text: 'Va. Moi, j\'ai du monde à soigner. Regarde dans le miroir : je serai là.' }
        ],
        outro: [
            { who: 'change', text: 'Tu as chassé le soleil du désert, Hou Yi. Ici, Lin a retrouvé ses mains, Wen sa voix, Ping sa rizière, Bao son sourire. Tao a mangé son gâteau. Mange aussi.' },
            { who: 'hou', text: 'Je mangerai. Merci de t\'occuper d\'eux. Je ne sais pas leurs noms, moi.' },
            { who: 'change', text: 'Je te les dirai.' }
        ],
        injured: [
            { id: 'farmer_lin', name: 'Lin', state: 'Coup de chaleur, désespéré', color: 'jade', need: 24, moves: 12, cake: ['Haricot rouge', 'un peu de gingembre, il a toujours les mains froides'], thanks: 'Mes mains sont chaudes, regardez ! Les semis attendront demain.' },
            { id: 'elder_wen', name: 'Doyen Wen', state: 'Épuisé d\'avoir porté le village', color: 'eau', need: 24, moves: 12, cake: ['Peau de neige', 'sans sucre'], thanks: 'Merci, ma fille. Les comptes du village tiendront encore une saison.' },
            { id: 'ping', f: true, name: 'Ping', state: 'Évanouie à la rizière sèche', color: 'lotus', need: 26, moves: 12, cake: ['Taro', 'une fleur de lotus sur la croûte'], thanks: 'J\'ai rêvé d\'eau claire, et vous étiez là. Lin est-il rentré ?' },
            { id: 'xiaobao', name: 'Petit Bao', state: 'Enfant déshydraté', color: 'perle', need: 26, moves: 11, cake: ['Jaune d\'œuf salé', 'tout petit, il n\'en a jamais fini un'], thanks: 'Il est si petit que je vais enfin le finir ! Je peux le montrer à papa ?' },
            { id: 'grandma_tao', f: true, name: 'Grand-mère Tao', state: 'Malaise de la doyenne des commères', color: 'argent', need: 28, moves: 12, cake: ['Matcha', 'double croûte, elle aime croquer'], thanks: 'Je n\'en dis rien à personne. Enfin, à presque personne.' }
        ]
    },
    {
        id: 2, sun: 'sun_5', region: 'fleuve', village: 'Port-à-Sec de Hekou', sky: ['#e6c98e', '#d4a76a'], ground: '#a07a4a',
        intro: [
            { who: 'hou', text: 'Les orages se sont tus, Chang\'e. Les monts respirent.' },
            { who: 'change', text: 'Ici, le fleuve est à sec depuis si longtemps que personne n\'ose espérer. Hekou a besoin de mains, pas de prières.' },
            { who: 'hou', text: 'Tu as raison. Fais ce que je ne sais pas faire.' },
            { who: 'change', text: 'Je note leurs noms. Quelqu\'un doit s\'en souvenir.' }
        ],
        outro: [
            { who: 'change', text: 'Hu m\'a demandé si le fleuve reviendrait. Je lui ai dit que tu faisais ce qu\'il fallait. Il a ri. C\'est la première fois depuis longtemps.' },
            { who: 'hou', text: 'Dis-lui que je passerai goûter son sel.' },
            { who: 'change', text: 'Il le saura.' }
        ],
        injured: [
            { id: 'ferryman_gu', name: 'Gu', state: 'Soif, bateau échoué', color: 'eau', need: 34, moves: 12, cake: ['Peau de neige', 'pas de sucre'], thanks: 'Ma barque ne flotte pas, mais moi, si. Merci.' },
            { id: 'weaver_mei', f: true, name: 'Mei', state: 'Fièvre de boue', color: 'lotus', need: 34, moves: 12, cake: ['Haricot rouge', 'un fil de soie dans le ruban'], thanks: 'Mon métier n\'a pas bougé. Mes doigts, si. Merci.' },
            { id: 'salt_hu', name: 'Hu', state: 'Marchand de sel, les poumons pris', color: 'jade', need: 38, moves: 12, cake: ['Matcha', 'une pincée de sel, bien sûr'], thanks: 'Le sel n\'a plus mauvais goût. C\'est bon signe.' },
            { id: 'girl_lian', f: true, name: 'Lian', state: 'Enfant fiévreuse', color: 'perle', need: 36, moves: 11, cake: ['Taro', 'en forme de coquillage'], thanks: 'Je peux le mettre avec mes coquillages ? Non, je vais le manger.' },
            { id: 'fleuve_village_old_caulker', name: 'Vieux Rao', state: 'Calfat sans coque, épuisé', color: 'argent', need: 40, moves: 12, cake: ['Jaune d\'œuf salé', 'deux jaunes'], thanks: 'Je n\'ai plus de coque à calfater. Mais je peux encore écouter.' }
        ]
    },
    {
        id: 3, sun: 'sun_9', region: 'fauves', village: 'Enclos de Caoyuan', sky: ['#f6e3a1', '#efc77a'], ground: '#b79a52',
        intro: [
            { who: 'hou', text: 'J\'ai abattu l\'un des deux derniers soleils, Chang\'e. L\'autre est tout petit, il tremblait. Je l\'ai laissé vivre.' },
            { who: 'change', text: 'Je sais. Tu as bien fait. Les Fauves s\'éveillent doucement, Hou Yi, moi aussi je dois m\'en occuper.' },
            { who: 'hou', text: 'Reste un peu. J\'aimerais te regarder avant de repartir.' },
            { who: 'change', text: 'Après. Laisse-moi d\'abord tenir ma promesse à ces gens.' }
        ],
        outro: [
            { who: 'change', text: 'Je connais le nom de chaque bête de Zi. Toi, tu en as sauvé des milliers que tu ne connaîtras pas. Moi, je connais leurs noms. On se complète.' },
            { who: 'change', text: 'Hou Yi… écoute-moi. Fengmeng sait que c\'est moi qui garde l\'élixir. S\'il te suit assez longtemps, il me trouvera par ce miroir. Je ne le laisserai pas faire. Pardonne-moi.' },
            { who: 'hou', text: 'Chang\'e, attends, ne…' }
        ],
        finale: 'Le miroir s\'éteint. Le bronze est froid sous vos doigts : c\'est Chang\'e qui a coupé le lien.',
        injured: [
            { id: 'shepherd_zi', f: true, name: 'Zi', state: 'Bergère, troupeau dispersé', color: 'jade', need: 44, moves: 13, cake: ['Matcha', 'un brin de menthe sauvage'], thanks: 'Mes bêtes reviendront. Elles savent mon nom, vous savez le leur.' },
            { id: 'hunter_wu', name: 'Wu', state: 'Morsures et fièvre', color: 'lotus', need: 46, moves: 13, cake: ['Haricot rouge', 'une grosse part'], thanks: 'Un chasseur qui se fait soigner par une boulangère. Ne le répétez pas.' },
            { id: 'cheese_sa', f: true, name: 'Dame Sa', state: 'Coup de chaleur', color: 'perle', need: 48, moves: 13, cake: ['Taro', 'au lait caillé'], thanks: 'Mes meules ont tenu. Moi aussi, on dirait.' },
            { id: 'old_nomad_bayan', name: 'Bai', state: 'Vieux nomade, cœur fatigué', color: 'eau', need: 50, moves: 13, cake: ['Peau de neige', 'tout doux'], thanks: 'J\'ai marché toute ma vie. Aujourd\'hui, je me suis assis, et c\'était bien.' },
            { id: 'fauves_village_khulan', f: true, name: 'Mulan', state: 'Jeune archère mordue', color: 'argent', need: 54, moves: 13, cake: ['Jaune d\'œuf salé', 'un petit arc de pâte'], thanks: 'Dites à Hou Yi que je m\'entraîne. Un jour, je viserai aussi bien.' }
        ]
    }
];

export const episodeById = id => EPISODES.find(e => e.id === id) || null;
export const episodeOfSun = sunId => SUN_EPISODE[sunId] || null;
export const injuredOf = id => EPISODES.flatMap(e => e.injured.map(n => ({ ...n, episode: e.id, village: e.village }))).find(n => n.id === id) || null;
