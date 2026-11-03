// Mode Chang'e (UNIVERS-CHANGE.md) : trois épisodes seulement, jouables après la mort des soleils des régions 3, 6 et 9. Chang'e, deux régions
// derrière Hou Yi, soigne cinq habitants d'un village par un puzzle sans ennemi (aucun crâne, aucune flèche : voir engine.js).
// Les habitants sont ceux de world/text/<région>.js (ids vérifiés par tests/unit/change.test.js) ; `color` = énergie demandée,
// `need` = points de soin à recueillir (une tuile de la couleur = 1 point, +1 pour un alignement de quatre, +2 pour cinq), `moves` = coups par tentative ; les soins déjà obtenus sont conservés entre deux tentatives.

// Le don de soigner de Chang'e vient d'une goutte d'élixir bue par accident, PAS de la lune (elle n'y est pas encore) : aucune énergie n'est « lunaire ».
export const ENERGY_LABEL = { jade: 'Jade', lotus: 'Lotus', perle: 'Perles de nacre', eau: 'Eau claire', argent: 'Énergie argentée', lune: 'Goutte d\'élixir' };

// Soleil abattu par Hou Yi → épisode de Chang'e.
export const SUN_EPISODE = { sun_4: 1, sun_5: 2, sun_9: 3 };

export const EPISODES = [
    {
        id: 1, sun: 'sun_4', region: 'rizieres', screen: 'rizieres_village', village: 'Hameau de Dongqiao', sky: ['#cfe6a8', '#f3e3a0'], ground: '#b9a45b',
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
        // Chang'e arrive au village : elle avoue à quoi tient son don (UNIVERS-CHANGE.md §1).
        arrival: [
            { who: 'change', text: 'Me voici à Dongqiao. Hou Yi ne le sait pas, mais j\'ai un secret.' },
            { who: 'change', text: 'En rangeant l\'élixir, une goutte est tombée sur ma langue. Par accident, rien de plus : je n\'ai pas voulu l\'immortalité, et je ne l\'ai pas eue.' },
            { who: 'change', text: 'Mais depuis ce jour, mes mains sentent le mal des gens, et savent le soulager. Ce n\'est pas un pouvoir de la lune : je n\'y suis pas, je ne suis qu\'une boulangère avec une goutte de trop.' },
            { who: 'change', text: 'Alors je soigne. Allons les voir, un par un.' }
        ],
        ambient: [
            { id: 'rizieres_village_potter', name: 'Yun', line: 'Mes jarres sont vides, mais on dit que vos gâteaux, eux, ne le sont jamais. Courage, Chang\'e.' },
            { id: 'rizieres_village_kid_lan', name: 'Lan', line: 'J\'ai vu Lin se redresser tout à l\'heure. Vous êtes magicienne ?' },
            { id: 'rizieres_village_old_watch', name: 'Vieux Fang', line: 'Je veille la porte est depuis quarante ans. Aujourd\'hui, personne ne passe : tout le monde est ici, à vous attendre.' },
            { id: 'rizieres_village_porter', name: 'Bang', line: 'Mes seaux sont vides, mais je les porte quand même. On ne sait jamais, la pluie.' },
            { id: 'rizieres_hamlet_weaver_zhu', name: 'Zhu', line: 'Je tresse des nattes pour les malades, c\'est plus doux que la paille. Prenez-en une.' },
            { id: 'buffalo_dahei', name: 'Dahei', line: 'Dahei lève la tête, souffle doucement, et se remet à ruminer sans bouger d\'un sabot.' }
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
        id: 2, sun: 'sun_5', region: 'fleuve', screen: 'fleuve_village', village: 'Port-à-Sec de Hekou', sky: ['#e6c98e', '#d4a76a'], ground: '#a07a4a',
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
        ambient: [
            { id: 'fleuve_village_kid_ming', name: 'Ming', line: 'Les barques ne bougent plus, alors je cours sur les quais. Vous soignez aussi les enfants qui courent ?' },
            { id: 'fleuve_village_dock_clerk', name: 'Maître Qi', line: 'Cent sept barques échouées, vingt-trois familles à nourrir. Je note tout, même vos bonnes actions.' },
            { id: 'fleuve_village_rope_maker', name: 'Dame Cho', line: 'Des cordes, il m\'en reste. Si une barque a besoin d\'être remorquée, je suis prête.' },
            { id: 'boatman_shan', name: 'Laoshan', line: 'Un batelier sans fleuve, c\'est comme une tortue sans mare. Merci de vous occuper des nôtres.' },
            { id: 'scribe_ou', name: 'Maître Ou', line: 'Je prends votre nom en note, madame. On oublie vite les gens qui aident.' },
            { id: 'gui_turtle', name: 'Gui', line: 'Gui sort la tête de sa carapace, vous regarde longuement, puis la rentre sans un mot.' }
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
        id: 3, sun: 'sun_9', region: 'fauves', screen: 'fauves_village', village: 'Enclos de Caoyuan', sky: ['#f6e3a1', '#efc77a'], ground: '#b79a52',
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
        ambient: [
            { id: 'fauves_village_naran', name: 'Rixi', line: 'J\'ai réparé trois chaudrons ce matin. Si vous avez des gâteaux à faire cuire, je prête la braise.' },
            { id: 'fauves_village_erdene', name: 'Zhubao', line: 'Les pâtures sont à sec, mais personne ne se dispute. C\'est bon signe.' },
            { id: 'fauves_village_tsetseg', name: 'Huahua', line: 'Du lait fermenté pour les malades ? Il est un peu fort, mais il remet debout.' },
            { id: 'shaman_ula', name: 'Fengpo', line: 'Les vents chuchotent votre nom, Chang\'e. Ils disent que vous restez, et que vous partirez.' },
            { id: 'twins_mu', name: 'Les jumeaux Mu', line: 'On garde les moutons ensemble ! Mais l\'un des deux dort debout, regardez.' },
            { id: 'horse_tian', name: 'Tian', line: 'Tian, le vieux cheval céleste, vous pousse l\'épaule du museau puis retourne brouter.' }
        ],
        injured: [
            { id: 'shepherd_zi', f: true, name: 'Zi', state: 'Bergère, troupeau dispersé', color: 'jade', need: 44, moves: 13, cake: ['Matcha', 'un brin de menthe sauvage'], thanks: 'Mes bêtes reviendront. Elles savent mon nom, vous savez le leur.' },
            { id: 'hunter_wu', name: 'Wu', state: 'Morsures et fièvre', color: 'lotus', need: 46, moves: 13, cake: ['Haricot rouge', 'une grosse part'], thanks: 'Un chasseur qui se fait soigner par une boulangère. Ne le répétez pas.' },
            { id: 'cheese_sa', f: true, name: 'Dame Sa', state: 'Coup de chaleur', color: 'perle', need: 48, moves: 13, cake: ['Taro', 'au lait caillé'], thanks: 'Mes meules ont tenu. Moi aussi, on dirait.' },
            { id: 'old_nomad_bayan', name: 'Bai', state: 'Vieux nomade, cœur fatigué', color: 'eau', need: 50, moves: 13, cake: ['Peau de neige', 'tout doux'], thanks: 'J\'ai marché toute ma vie. Aujourd\'hui, je me suis assis, et c\'était bien.' },
            { id: 'fauves_village_khulan', f: true, name: 'Mulan', state: 'Jeune archère mordue', color: 'argent', need: 54, moves: 13, cake: ['Jaune d\'œuf salé', 'un petit arc de pâte'], thanks: 'Dites à Hou Yi que je m\'entraîne. Un jour, je viserai aussi bien.' }
        ]
    }
];

// Habitants de passage (ambiance) : se baladent dans le village, ne sont jamais blessés ; toucher l'un d'eux donne sa réplique.
export const ambientOf = (episodeId, npcId) => episodeById(episodeId)?.ambient?.find(a => a.id === npcId) || null;
export const episodeByScreen = id => EPISODES.find(e => e.screen === id) || null;
export const episodeById = id => EPISODES.find(e => e.id === id) || null;
export const episodeOfSun = sunId => SUN_EPISODE[sunId] || null;
export const injuredOf = id => EPISODES.flatMap(e => e.injured.map(n => ({ ...n, episode: e.id, village: e.village }))).find(n => n.id === id) || null;
