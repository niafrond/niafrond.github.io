// Quêtes de base de l'histoire : histoire principale puis quêtes annexes. Données pures, extraites de story.js.
import { STORY_ENDING } from './storyText.js';

// Quêtes, dans l'ordre : d'abord l'histoire principale, puis les quêtes secondaires (`side: true`).
// Statut : locked → available → active → ready → done.
//  - giver      : PNJ qui propose la quête ; avec `autoStart:true` la quête démarre toute seule et le PNJ
//                 ne fait que rappeler l'objectif (`hint`)
//  - turnIn     : PNJ auquel on rend compte (absent = validée automatiquement)
//  - requires   : quêtes à terminer avant
//  - objectives : kill (ennemi), killGroup (groupe d'ennemis), chest (ouvrir un coffre)
//  - side       : quête secondaire (optionnelle) : jamais requise par une quête principale
//  - final      : sa validation met `ended = true` (épilogue, Nouvelle Partie + disponible)
// Les PNJ peuvent aussi avoir `talk: [{ whenDone: id | [ids], lines }]` : répliques d'ambiance
// selon l'avancement (id = quête terminée, ennemi vaincu ou coffre ouvert ; la dernière
// condition remplie l'emporte, sinon `idle`). Un écran peut avoir `arrival: [lignes]`
// (texte du Narrateur à la première visite).
export const BASE_QUESTS = [
    // ── Histoire principale : neuf soleils, Fengmeng, épilogue ───────────────
    {
        id: 'q_sun_1',
        title: 'Le Soleil Ardent',
        chapter: 'Chapitre I — Les Rizières Desséchées',
        giver: 'elder_wen', turnIn: null, requires: [],
        objectives: [{ type: 'kill', target: 'sun_1', text: 'Abattre le Soleil Ardent (sanctuaire à l\'est des Rizières Desséchées, au-delà de la digue)' }],
        offer: [
            "Hou Yi ! Que les ancêtres soient loués. Vous savez l'état du monde : dix soleils, fils de Di Jun, brûlent le ciel depuis trois lunes. Ma vieille tête ne se souvient d'aucun été pareil.",
            "L'empereur Yao m'envoie son décret, scellé de jade : « Que l'archer Hou Yi abatte neuf soleils, et qu'il en épargne un seul, afin que la Terre garde un jour. » Il vous le demande, il ne vous l'ordonne pas.",
            "Le premier se tient sur le tertre du temple des moissons, à l'est, au bout de nos rizières. Mais prenez garde : votre disciple Fengmeng rôde sur la digue, et il a dans les yeux quelque chose que je n'aime pas. Il veut vous éprouver.",
            "Entraînez-vous sur les maraudeurs de nos champs si vous le jugez nécessaire."
        ],
        hint: [
            "Le Soleil Ardent est à l'est, sur le tertre du temple. La digue est étroite : méfiez-vous de Fengmeng, qui y rôde.",
            "Le premier des neuf est moins un brasier qu'un vent brûlant qui court sur les rizières. Une flamme plus franche que la sienne le ferait vaciller.",
            "Les maraudeurs des rizières sont de bons adversaires pour s'échauffer, et ils reviennent toujours. Les monstres se voient de loin : un cercle rouge marque leur zone de vigilance."
        ],
        complete: [
            "Le Soleil Ardent s'effondre en pluie de braise et, pour la première fois depuis trois lunes, un souffle de vent frais traverse les rizières. Les villageois sortent de leurs huttes et tombent à genoux. Certains pleurent.",
            "Du corps du soleil, il ne reste qu'un disque de cendre tiède et une plume de feu que vous glissez dans votre carquois. Huit autres soleils vous attendent.",
            "À l'est, la digue s'ouvre sur les Gorges du Volcan, où la roche fond encore. Chang'e vous a laissé un paquet de gâteaux de lune sur le muret : il est encore chaud."
        ],
        reward: { gold: 80, fragment: 'Éclat du Soleil Ardent' }
    },
    {
        id: 'q_sun_6',
        title: 'Le Soleil de Magma',
        chapter: 'Chapitre II — Les Gorges du Volcan',
        giver: 'priestess_yan', autoStart: true, turnIn: null, requires: ['q_sun_1'],
        objectives: [{ type: 'kill', target: 'sun_6', text: 'Abattre le Soleil de Magma (sanctuaire des Gorges du Volcan, au-delà du défilé)' }],
        offer: [
            "Deuxième soleil : celui de Magma. Il a fait de la gorge une forge, et le basalte coule comme de l'eau. Son sanctuaire se tient à l'est, au-delà du défilé.",
            "Une silhouette connue vous attend à l'entrée des gorges, l'arc déjà tendu…"
        ],
        hint: [
            "Le défilé est étroit : un archer pressé y a tendu une embuscade. Après lui, le Soleil de Magma vous attend à l'est.",
            "Les pixiu de magma gardent les veines de cinabre : prudence, ils chargent la tête baissée.",
            "Trois chemins mènent au soleil. Risque : faites taire les deux forgerons de magma, au prix d'un combat, pour leur expérience et un soleil entier.",
            "Relation : sauvez la cendre du phénix pour Yan, et le vieil attiseur du temple du feu ordonnera aux forgerons de poser leurs soufflets.",
            "Découverte : les veines de cinabre et la cendre du phénix affaiblissent le soleil.",
            "Chaque chemin laisse sa trace : des forgerons éteints ou endormis, un attiseur allié, un soleil moins ardent."
        ],
        complete: [
            "Le Soleil de Magma se fige, noircit, se fend comme une coulée refroidie, puis s'effondre en gravats encore chauds. Les rivières de feu ralentissent et s'éteignent une à une, laissant une roche luisante comme du verre.",
            "La prêtresse Yan s'agenouille, le front contre la pierre : elle priait les soleils comme des dieux, autrefois. « Pardonnez-moi, murmure-t-elle, de les avoir aimés. »",
            "Deux soleils sont tombés. À l'est, les dunes du Gobi miroitent, et le sable y a viré au verre."
        ],
        reward: { gold: 110, fragment: 'Éclat du Soleil de Magma' }
    },
    {
        id: 'q_sun_4',
        title: 'Le Soleil des Mirages',
        chapter: 'Chapitre III — Le Désert de Gobi',
        giver: 'guide_dawa', autoStart: true, turnIn: null, requires: ['q_sun_6'],
        objectives: [{ type: 'kill', target: 'sun_4', text: 'Trouver et abattre le vrai Soleil des Mirages parmi ses doubles (Désert de Gobi)' }],
        offer: [
            "Troisième soleil : celui des Mirages. Il s'est dédoublé, triplé, partout à la fois, et les caravanes marchent en rond jusqu'à mourir de soif. Le vrai est caché parmi ses doubles.",
            "Le guide Dawa saura vous dire comment faire la différence."
        ],
        hint: [
            "Les mirages se dissipent au toucher, sans mal ; mais seul le vrai soleil peut être abattu. Ils lui ressemblent trait pour trait, ombre et nom compris.",
            "Quand un mirage se défait, un autre renaît ailleurs. Le vrai soleil, lui, ne quitte jamais sa place : repérez celui qui ne change pas d'un passage à l'autre.",
            "Retrouver la cache de l'oasis et la carte qui ne ment pas affaiblira le vrai soleil."
        ],
        complete: [
            "Le vrai soleil s'effondre ; autour de lui, tous les mirages s'évanouissent d'un coup, comme des bulles de savon. Le désert redevient simplement le désert : immense, honnête, silencieux.",
            "Dawa ôte son turban et le tend vers le ciel, enfin bleu. « On dit que celui qui sait voir le vrai du faux dans le Gobi n'a plus rien à craindre dans la vie », murmure-t-il.",
            "Trois soleils sont tombés. À l'est, le Lit du Fleuve Jaune attend, craquelé et sans eau."
        ],
        reward: { gold: 140, fragment: 'Éclat du Soleil des Mirages' }
    },
    {
        id: 'q_sun_2',
        title: 'Le Soleil des Eaux Taries',
        chapter: 'Chapitre IV — Le Lit du Fleuve Jaune',
        giver: 'ferryman_gu', autoStart: true, turnIn: null, requires: ['q_sun_4'],
        objectives: [{ type: 'kill', target: 'sun_2', text: 'Abattre le Soleil des Eaux Taries (sanctuaire du Lit du Fleuve Jaune, au sud-est)' }],
        offer: [
            "Quatrième soleil : celui des Eaux Taries a bu le Fleuve Jaune jusqu'au dernier filet. Son sanctuaire, un banc de rochers fendus, se dresse au sud-est du lit asséché.",
            "Le passeur Gu et la tisserande Mei connaissent ces rives mieux que quiconque."
        ],
        hint: [
            "Le Soleil des Eaux Taries se tient au sud-est du lit du fleuve, parmi les rochers fendus. Vous voyez ses gardes de loin : les noyés ne dorment plus.",
            "Quand l'eau reviendra, ma barque sera la première à flotter. Je compte sur vous, seigneur archer.",
            "Trois chemins mènent au soleil. Risque : abattez les deux noyés-gardes, au prix d'un combat, pour leur expérience et un soleil entier.",
            "Relation : apaisez les noyés de Mei, et leur doyen parlera aux gardes au pied des roches. Ils s'écartent sans combat.",
            "Découverte : le serpent du gué et les noyés de Mei affaiblissent le soleil.",
            "Chaque chemin laisse sa trace : des gardes renvoyés à la boue ou rendus au courant, un doyen allié, un soleil moins ardent."
        ],
        complete: [
            "Le Soleil des Eaux Taries pousse un soupir humide et se dissout en brume. Un grondement monte du sol : très loin, en amont, l'eau revient.",
            "Elle avance d'abord comme un murmure, puis comme une main qui lisse la boue. Le passeur Gu enfonce sa perche dans la vase et crie de joie : sa barque se remet à flotter.",
            "Quatre soleils abattus. L'est vous attend : la Forêt de Bambous Calcinée."
        ],
        reward: { gold: 180, fragment: 'Éclat du Soleil des Eaux Taries' }
    },
    {
        id: 'q_sun_3',
        title: 'Le Soleil de Cendres',
        chapter: 'Chapitre V — La Forêt de Bambous Calcinée',
        giver: 'monk_zhen', autoStart: true, turnIn: null, requires: ['q_sun_2'],
        objectives: [{ type: 'kill', target: 'sun_3', text: 'Abattre le Soleil de Cendres (sanctuaire de la Forêt de Bambous Calcinée, au nord-est)' }],
        offer: [
            "Cinquième soleil : celui de Cendres a transformé une forêt entière en cierges noirs. Il se tient à l'est, près du temple brûlé, là où la cloche sonne encore toute seule.",
            "Le moine Zhen veille sur ce qu'il reste du sanctuaire ; l'herboriste Xu cherche encore des plantes vivantes."
        ],
        hint: [
            "Le Soleil de Cendres est au nord-est de la forêt, au-delà des bambous noircis. Évitez les cercles rouges : les esprits y sont nerveux.",
            "Si le feu vous fait peur, souvenez-vous : ce soleil n'est plus que ce que le feu laisse derrière lui. La cendre, c'est déjà de la terre.",
            "Trois chemins mènent au soleil. Risque : éteignez les deux esprits de la cloche, au prix d'un combat, pour leur expérience et un soleil entier.",
            "Relation : rapportez la cloche à Zhen, et son âme parlera aux esprits. Ils se rendorment dans le bronze, sans combat.",
            "Découverte : la cloche du temple et le Vieux Pin Noir affaiblissent le soleil.",
            "Chaque chemin laisse sa trace : des esprits éteints ou rendormis, une cloche qui parle, un soleil moins ardent."
        ],
        complete: [
            "Le Soleil de Cendres s'éteint comme une braise sous l'eau : sans bruit, avec une volute grise. Alors, très doucement, la cloche du temple sonne, et personne ne la touche.",
            "Le moine Zhen joint les mains. Dans la cendre, un premier brin de bambou vert perce, pas plus grand qu'une aiguille. La forêt n'est pas morte : elle attendait.",
            "Cinq soleils sont tombés. Les Monts du Tonnerre grondent à l'est."
        ],
        reward: { gold: 230, fragment: 'Éclat du Soleil de Cendres' }
    },
    {
        id: 'q_sun_5',
        title: 'Le Soleil des Orages',
        chapter: 'Chapitre VI — Les Monts du Tonnerre',
        giver: 'hermit_lei', autoStart: true, turnIn: null, requires: ['q_sun_3'],
        objectives: [{ type: 'kill', target: 'sun_5', text: 'Abattre le Soleil des Orages (sanctuaire des Monts du Tonnerre, au sud-est)' }],
        offer: [
            "Sixième soleil : celui des Orages. Il lance des éclairs sur chaque crête, et les Monts du Tonnerre n'ont plus de nuit. Il règne à l'est, au milieu des nuages noirs.",
            "Le forgeron Tie ajustera vos flèches ; l'ermite Lei sait où frappe l'éclair."
        ],
        hint: [
            "Le tonnerre est un tambour, archer : écoutez-le avant de tirer. Le Soleil des Orages est au sud-est ; ses gardes frappent plus fort qu'ils n'en ont l'air.",
            "Gardez vos distances avec les cercles rouges, et ne comptez pas sur le silence entre deux éclairs.",
            "Trois chemins mènent au soleil. Risque : abattez les deux gardes du col, au prix d'un combat, pour leur expérience et un soleil entier.",
            "Relation : rendez son tambour à Lei, et la petite voix du tonnerre ordonnera aux gardes de lâcher la cage, sans combat.",
            "Découverte : le dragon-serpent et le tambour de Lei affaiblissent le soleil.",
            "Chaque chemin laisse sa trace : des gardes abattus ou boudeurs, une voix du tonnerre alliée, un soleil moins ardent."
        ],
        complete: [
            "Le Soleil des Orages éclate en un dernier coup de tonnerre, si fort que les montagnes en tremblent. Puis le silence, d'une pureté stupéfiante, et une pluie fine, tiède, qui sent le fer et la terre.",
            "Au loin, le forgeron Tie lève son marteau vers le ciel clair. L'ermite Lei, qui parlait au tonnerre depuis trente ans, hoche simplement la tête : le tonnerre a fini de répondre.",
            "Six soleils abattus. À l'est, la Plaine des Fauves ondule encore de chaleur."
        ],
        reward: { gold: 290, fragment: 'Éclat du Soleil des Orages' }
    },
    {
        id: 'q_sun_7',
        title: 'Le Soleil des Bêtes Folles',
        chapter: 'Chapitre VII — La Plaine des Fauves',
        giver: 'hunter_wu', autoStart: true, turnIn: null, requires: ['q_sun_5'],
        objectives: [{ type: 'kill', target: 'sun_7', text: 'Abattre la meute embrasée puis le Soleil des Bêtes Folles (sanctuaire de la Plaine des Fauves, au sud-est)' }],
        offer: [
            "Septième soleil : celui des Bêtes Folles. Il a rendu fous tigres, sangliers et loups, qui ravagent la plaine en meutes embrasées. Le soleil se tient au milieu d'elles, protégé comme une reine.",
            "Le chasseur Wu connaît leurs habitudes."
        ],
        hint: [
            "Tant que la meute vit, le soleil est protégé par un bouclier de flammes : abattez d'abord les quatre bêtes qui l'entourent.",
            "Frappez-les une à une : aucune ne vous suivra loin de son maître.",
            "Chasser le tigre balafré et rapporter sa clochette à la bergère Zi affaiblira le soleil, une fois la meute tombée."
        ],
        complete: [
            "La meute est tombée, puis le soleil. Les flammes qui couraient dans l'herbe s'éteignent d'un coup, et les bêtes survivantes se couchent, hagardes, comme éveillées d'un cauchemar.",
            "Le chasseur Wu dépose sa lance : « Je les ai chassées toute ma vie, dit-il. Je n'ai jamais pensé qu'elles pouvaient avoir peur. »",
            "Sept soleils abattus. La Mer Orientale vous attend à l'est : il paraît qu'elle s'est retirée."
        ],
        reward: { gold: 360, fragment: 'Éclat du Soleil des Bêtes Folles' }
    },
    {
        id: 'q_sun_8',
        title: 'Le Soleil des Marées',
        chapter: 'Chapitre VIII — Le Rivage de la Mer Orientale',
        giver: 'envoy_longwang', autoStart: true, turnIn: null, requires: ['q_sun_7'],
        objectives: [{ type: 'kill', target: 'sun_8', text: 'Abattre le Soleil des Marées (sanctuaire du Rivage de la Mer Orientale, au sud-est)' }],
        offer: [
            "Huitième soleil : celui des Marées. Il a aspiré la mer et la tient en suspens au-dessus de la grève, comme une cloche d'eau prête à retomber. Il siège sur les rochers de l'est.",
            "Un envoyé du Roi-Dragon vous attend sur la grève : il a une faveur à vous demander."
        ],
        hint: [
            "Mon maître le Roi-Dragon supplie le Ciel depuis des semaines : la mer étouffe. Le Soleil des Marées est au sud-est, sur les rochers.",
            "Ses serpents de mer ont perdu leur eau et leur raison : méfiez-vous des cercles rouges.",
            "Trois chemins mènent au soleil. Risque : faites taire les deux gardes-marée, au prix d'un combat, pour leur expérience et un soleil entier.",
            "Relation : rendez sa perle au Roi-Dragon, et l'amiral Xie lèvera la consigne des gardes-marée, sans combat.",
            "Découverte : les filets rendus et la perle du Roi-Dragon affaiblissent le soleil.",
            "Chaque chemin laisse sa trace : des gardes abattus ou rentrés aux récifs, un amiral reconnaissant, un soleil moins ardent."
        ],
        complete: [
            "Le Soleil des Marées éclate en une pluie tiède, et la cloche d'eau, enfin libérée, retombe sur la grève : un bruit de tonnerre mou, un grand soupir d'écume, puis l'immense mer qui revient, doucement, lécher les pieds des pêcheurs.",
            "L'envoyé Longwang s'incline si bas que ses cheveux touchent le sable. « Le Roi-Dragon n'oubliera pas. Il y a, dans son palais, des écailles pour d'autres flèches. »",
            "Huit soleils abattus. Il reste le Neuvième, au sommet du monde, et le Dixième, que vous devez épargner."
        ],
        reward: { gold: 440, fragment: 'Éclat du Soleil des Marées' }
    },
    {
        id: 'q_sun_9',
        title: 'Le Soleil Lâche',
        chapter: 'Chapitre IX — La Cime du Fusang',
        giver: 'crane_envoy', autoStart: true, turnIn: null, requires: ['q_sun_8'],
        objectives: [{ type: 'kill', target: 'sun_9', text: 'Abattre le Soleil Lâche sans toucher au Dixième Soleil (sanctuaire de la Cime du Fusang, au nord-est)' }],
        offer: [
            "Il ne reste que deux soleils, et ils sont ensemble : le Neuvième, qu'on appelle le Lâche, s'est réfugié au pied du Fusang contre son plus jeune frère, le Dixième, qui tremble de tout son corps.",
            "Vous n'en abattrez qu'un. Le Neuvième tombera ; le Dixième doit rester, car la Terre n'aurait plus de jour. Épargner celui qui a peur : c'est la seule faveur que le décret de l'empereur vous laisse."
        ],
        hint: [
            "Le Soleil Lâche est dans le sanctuaire, au nord-est. Le Dixième se tient contre lui, terrifié : ne le visez jamais.",
            "Un archer sans tremblement : c'est ce qu'il faut, ici. Ni trop tôt, ni trop fort. La compassion guide aussi la flèche.",
            "Trois chemins mènent au soleil. Risque : écartez les deux grues-lige, sans toucher au Dixième, pour leur expérience et un soleil entier.",
            "Relation : rapportez les plumes du nid, et Hegui, la sœur de la messagère, rappellera les grues-lige sans combat.",
            "Découverte : le nid de la grue et le sceau des racines affaiblissent le soleil.",
            "Chaque chemin laisse sa trace : des grues abattues ou posées sur la branche, une grue reconnaissante, un soleil moins ardent."
        ],
        complete: [
            "Le Soleil Lâche tombe sans un cri, comme un fruit mûr. Contre lui, le Dixième Soleil, un petit être lumineux de la taille d'un enfant, se serre contre le tronc du Fusang et ose enfin regarder son sauveur.",
            "« Tu… tu ne m'as pas touché », murmure-t-il. Hou Yi baisse l'arc : par compassion, il n'a tiré qu'une fois. « Je serai sage. Je me lèverai à l'heure. Je ne brûlerai personne. »",
            "Neuf soleils sont tombés ; un seul demeure, qui éclairera la Terre à jamais. Mais le bronze, dans la manche de Hou Yi, est froid, et un lièvre de jade accourt dans l'herbe…"
        ],
        reward: { gold: 540, fragment: 'Éclat du Soleil Lâche' }
    },
    {
        id: 'q_changxi',
        title: "L'épreuve de Changxi",
        chapter: 'Chapitre IX bis — Les Hautes-Eaux de la Lune Montante',
        giver: 'crane_envoy', autoStart: true, turnIn: null, requires: ['q_sun_9'],
        objectives: [{ type: 'kill', target: 'changxi', text: "Prouver votre courage à Changxi, mère des douze lunes (Autel de Mazu, au bout des Hautes-Eaux)" }],
        offer: [
            "La grue blanche se penche vers vous : « Hou Yi. Fengmeng a forcé votre porte à l'aube. Dame Chang'e s'était déjà enfuie avec l'élixir vers le Pic de la Lune, et il la suit. Elle a coupé elle-même le miroir, pour qu'il ne la trouve pas par vous. »",
            "« Mais la Lune est montée si haut que la mer a voulu la suivre. Entre le Fusang et le Pic, il n'y a plus de sentier : seulement des pontons, et l'eau noire qui les sépare. Il faudra marcher sur l'eau. »",
            "« Au bout, une divinité dort sur l'autel de Mazu : Changxi, mère des douze lunes. Elle seule peut porter un homme jusqu'à la Lune. Elle ne vous veut aucun mal, archer : elle veut seulement savoir si vous osez. »"
        ],
        hint: [
            "Les Hautes-Eaux sont à l'est du Fusang. Sans le Pas de Yu, l'eau reste infranchissable : le vieux Xu, à la digue, se souvient d'une tortue noire.",
            "L'autel de Mazu est au bout des pontons. Changxi n'est pas un ennemi : c'est une épreuve de bravoure. Restez, et elle vous ouvrira le chemin de la Lune."
        ],
        complete: [
            "Changxi se lève, immense, les douze lunes tournant autour de sa tête. Elle ne dit rien, mais son visage s'adoucit : le sourire d'une mère qui a vu ce qu'elle voulait voir. Elle vous fait signe de passer, et ce geste vaut toutes les paroles.",
            "Le ciel se déchire d'argent, et un sentier de lumière monte de l'autel vers le Pic de la Lune."
        ],
        reward: { gold: 600, fragment: 'Larme de Changxi' }
    },
    {
        id: 'q_fengmeng',
        title: "L'Archer Miroir",
        chapter: 'Chapitre Final — Le Pic de la Lune',
        giver: 'crane_envoy', autoStart: true, turnIn: null, requires: ['q_changxi'],
        objectives: [{ type: 'kill', target: 'fengmeng_3b', text: 'Affronter Fengmeng au sommet du Pic de la Lune (duel en deux phases, au bout du sentier de lumière)' }],
        offer: [
            "Le sentier de lumière s'ouvre sous vos pas, et le vent vous rapporte la voix de la grue blanche, un rouleau scellé de la Reine Mère dans le bec : « Allez, archer. Dame Chang'e vous attend au Pic de la Lune, le seul endroit du monde où la Reine Mère peut encore veiller sur elle. »",
            "« Fengmeng la suit, et il ne reculera devant rien. Il ne vous reste que le temps d'un soupir. »"
        ],
        hint: [
            "Le Pic de la Lune est au bout du sentier de lumière de Changxi, au-delà des Hautes-Eaux. Fengmeng est un archer redoutable, et il connaît vos techniques par cœur : n'attendez pas de lui qu'il tire autrement que vous.",
            "Ne cherchez pas à le détester. Dame Chang'e vous le dirait elle-même."
        ],
        complete: [
            "Fengmeng ne se relève pas tout de suite. Quand il le fait, il a vieilli de dix ans. Il laisse son arc et son carquois au pied de l'autel et redescend vers la vallée à pied, sans arme, en sachant qu'on l'y attend et qu'il devra répondre de ses actes.",
            "On dit qu'il se présenta de lui-même devant l'empereur Yao et devant les villages qu'il avait effrayés, puis qu'il passa le reste de ses jours à tirer sur des cibles de paille, pour ne plus jamais viser personne.",
            "Le silence retombe sur le pic. Il ne reste plus, dans la lumière froide, que l'archer, la lune, et la dernière chose que Chang'e lui demande."
        ],
        reward: { gold: 600, fragment: 'Carquois de Fengmeng' }
    },
    {
        id: 'q_epilogue',
        title: 'Les gâteaux de lune',
        chapter: 'Épilogue — Le Pic de la Lune',
        giver: 'change_moon', autoStart: true, turnIn: null, requires: ['q_fengmeng'], final: true,
        objectives: [{ type: 'chest', target: 'moon_altar', text: "Déposer les gâteaux de lune sur l'autel (sommet du Pic de la Lune)" }],
        offer: [
            "Le calme revient sur le pic. Là où la pierre était nue, un autel blanc apparaît, gravé d'une lune et d'un lièvre de jade : l'autel des gâteaux de lune.",
            "Chang'e vous attend dans la lumière. Elle ne dit rien, elle sourit seulement, et désigne la corbeille posée devant l'autel. Déposez les gâteaux : c'est la dernière chose qu'elle vous demande."
        ],
        hint: [
            "L'autel de pierre blanche attend vos gâteaux de lune. Ouvrez-le : c'est tout ce qu'elle vous demande.",
            "Prenez votre temps. La lune ne s'en va pas."
        ],
        complete: STORY_ENDING,
        reward: { gold: 800, fragment: 'Gâteau de pleine lune' }
    },

    // ── Quêtes secondaires (facultatives) : or et composants de flèche ───────
    {
        id: 'sq_rice_thief', side: true,
        title: 'Le chapardeur des rizières',
        chapter: '✦ Quête secondaire — Rizières Desséchées',
        giver: 'farmer_lin', turnIn: 'farmer_lin', requires: [],
        objectives: [{ type: 'kill', target: 'rice_thief', text: 'Chasser le démon chapardeur (champs de l\'est, au sud, au-delà de la digue)' }],
        offer: [
            "Seigneur archer… Un petit démon-renard vole mes derniers sacs de riz, la nuit. Il a même emporté la jarre d'eau sacrée de mes ancêtres, la seule qui ne soit pas encore vide.",
            "Il se cache dans les champs de l'est, de l'autre côté de la digue, près de la clôture. Il est petit, mais rusé : méfiez-vous des pièges."
        ],
        hint: ["Le petit démon rôde dans les champs de l'est, au sud, près de la clôture. Il aime les pièges."],
        complete: [
            "Ma jarre ! Elle est fêlée au col, mais elle contient encore une larme de l'eau sacrée de mes ancêtres.",
            "Prenez-la, seigneur : pour la pointe de vos flèches. Et ces pièces, c'est tout ce qui me reste du dernier marché."
        ],
        reward: { gold: 40, fragment: 'Eau sacrée' }
    },
    {
        id: 'sq_golden_carp', side: true,
        title: 'La carpe qui voulait être dragon',
        chapter: '✦ Quête secondaire — Lit du Fleuve Jaune',
        giver: 'ferryman_gu', turnIn: 'ferryman_gu', requires: ['q_sun_4'],
        objectives: [{ type: 'kill', target: 'golden_carp', text: 'Éprouver la carpe dorée (coin nord-ouest du lit, près des rochers)' }],
        offer: [
            "Seigneur archer, une dernière chose, sur le fleuve. Une carpe dorée s'est échouée dans une flaque, au nord-ouest. La légende dit qu'une carpe qui franchit la Porte du Dragon devient dragon. Celle-ci est têtue : elle remonte un fleuve sans eau.",
            "Elle ne cédera qu'à un adversaire de valeur. Éprouvez-la, et elle vous suivra : les carpes savent à qui elles doivent leur élan."
        ],
        hint: ["La carpe dorée est dans le coin nord-ouest du lit, dans une flaque. Elle crache l'eau comme un archer ses flèches."],
        complete: [
            "Elle vous suit déjà, regardez ! Elle s'appelle Yu. Elle dit que vous l'avez battue mieux qu'aucun courant ne l'avait fait, et que ça mérite un voyage.",
            "Prenez ces pièces. Et surveillez ses jets d'eau : elle vise juste."
        ],
        reward: { gold: 70, fragment: 'Écaille dorée' }
    },
    {
        id: 'sq_spark_egg', side: true,
        title: "L'œuf de foudre",
        chapter: '✦ Quête secondaire — Monts du Tonnerre',
        giver: 'smith_tie', turnIn: 'smith_tie', requires: ['q_sun_3'],
        objectives: [{ type: 'chest', target: 'spark_egg', text: "Retrouver l'œuf de foudre (coin nord-ouest des monts, entre les rochers)" }],
        offer: [
            "Une dernière chose, archer. Quand le dragon-serpent a niché sur la crête, un œuf de foudre est tombé du nid, au nord-ouest. Il est tiède et il crépite. Si l'éclair le couve, il éclora de toute façon, et mieux vaut que ce soit dans vos mains que dans ma forge.",
            "Rapportez-le-moi, et ne le secouez pas."
        ],
        hint: ["L'œuf est dans le coin nord-ouest des monts, entre les rochers. Aucun ennemi ne le garde."],
        complete: [
            "Il éclot ! Un petit esprit à tête d'aigle, tout crépitant de foudre. Il vous a choisi, archer : il a mordu votre carquois et ne le lâche plus.",
            "Il s'appelle Leigong, comme le dieu du tonnerre. Il fait de la lumière de ce qu'on lui donne à manger, c'est-à-dire du qì. Prenez ces pièces, et gardez-le loin de ma poudre."
        ],
        reward: { gold: 60, fragment: 'Coquille de foudre' }
    },
    {
        id: 'sq_ember_pup', side: true,
        title: 'Le louveteau de braise',
        chapter: '✦ Quête secondaire — Gorges du Volcan',
        giver: 'miner_shan', turnIn: 'miner_shan', requires: ['q_sun_1'],
        objectives: [{ type: 'kill', target: 'ember_pup', text: 'Dompter le louveteau de braise (sud-ouest des gorges, près des éboulis)' }],
        offer: [
            "Un louveteau mord mes mineurs depuis une semaine, au sud-ouest, là où la roche est encore chaude. Il n'a pas de meute : le volcan a mangé la sienne. Il est furieux, et sa rage ne retombe jamais.",
            "Ce n'est pas un monstre, seigneur : c'est un petit qui ne sait plus quoi faire de sa colère. Tenez-lui tête, il saura vous suivre."
        ],
        hint: ["Le louveteau rôde au sud-ouest des gorges, près des éboulis. Il mord fort, mais il n'a qu'un seul coup dans le sac."],
        complete: [
            "Il vous suit ! Il se frotte contre votre botte, et il a l'air presque calme. Presque.",
            "Il s'appelle Braise. Quand les coups pleuvent, sa colère devient la vôtre. Prenez ces pièces, mes mineurs dorment enfin."
        ],
        reward: { gold: 80, fragment: 'Croc de braise' }
    },
    {
        id: 'sq_tou_stash', side: true,
        title: 'La cachette de la belette',
        chapter: '✦ Quête secondaire — Plaine des Fauves',
        giver: 'hunter_wu', turnIn: 'hunter_wu', requires: ['q_sun_5'],
        objectives: [{ type: 'chest', target: 'tou_stash', text: 'Fouiller la cachette de la belette (coin nord-ouest de la plaine)' }],
        offer: [
            "Une belette me vole mes appâts, mes flèches, et même mes bottes depuis l'automne. Elle a une cachette dans le coin nord-ouest, et je veux savoir ce qu'il y a dedans.",
            "Rapportez ce que vous y trouvez. Mais prévenez-la : une belette qu'on dévalise cherche vite quelqu'un à qui voler en retour."
        ],
        hint: ["La cachette est dans le coin nord-ouest de la plaine, sous des broussailles. Aucun ennemi ne la garde."],
        complete: [
            "Mes bottes ! Et quarante appâts, tous comptés. Elle s'est jointe à vous : elle dit que voler à un chasseur est trop facile, et qu'elle préfère voler aux monstres.",
            "Elle s'appelle Tou. Prenez ces pièces, et surveillez vos poches quand même."
        ],
        reward: { gold: 90, fragment: 'Poil de belette' }
    },
    {
        id: 'sq_jian_quiver', side: true,
        title: 'Le carquois du corbeau',
        chapter: '✦ Quête secondaire — Rivage de la Mer Orientale',
        giver: 'fisher_hai', turnIn: 'fisher_hai', requires: ['q_sun_7'],
        objectives: [{ type: 'chest', target: 'jian_quiver', text: 'Retrouver le carquois du corbeau (coin nord-ouest de la grève)' }],
        offer: [
            "Un corbeau de mer a ramassé des flèches perdues sur la grève, et il a bâti son nid dedans, au nord-ouest. Je vous jure qu'il les trie par couleur.",
            "Récupérez le carquois. Le corbeau y tient plus qu'à sa vie : il ne le lâchera qu'à quelqu'un qui sait tirer."
        ],
        hint: ["Le carquois est dans le coin nord-ouest de la grève, dans le nid du corbeau. Aucun ennemi ne le garde."],
        complete: [
            "Il a changé d'avis : il veut voler avec vous. Il dit que vous tirez comme on respire, et qu'il saura transformer les gâteaux de lune en flèches.",
            "Il s'appelle Jian. Prenez ces pièces et laissez-le choisir sa couleur préférée."
        ],
        reward: { gold: 100, fragment: 'Plume de corbeau marin' }
    },
    {
        id: 'sq_river_serpent', side: true,
        title: 'Le serpent du gué',
        chapter: '✦ Quête secondaire — Lit du Fleuve Jaune',
        giver: 'ferryman_gu', turnIn: 'ferryman_gu', requires: ['q_sun_4'],
        objectives: [{ type: 'kill', target: 'river_serpent', text: 'Chasser le Serpent du Fleuve Jaune (coin nord-est du lit, près des rochers)' }],
        offer: [
            "Seigneur archer, vous qui chassez les soleils, auriez-vous un moment pour un serpent ? Un vieux serpent de rivière s'est niché dans une fosse de boue, au nord-est. Depuis que l'eau s'est retirée, il attaque les voyageurs.",
            "Il n'est pas méchant de nature : il a soif, comme tout le monde. Mais soif ou pas, il m'a pris ma perche favorite, et je n'ai plus que mes mains pour pousser la barque quand l'eau reviendra.",
            "Au fait, un jeune archer pressé m'a demandé hier le chemin de l'Occident. Il courait comme on court après un rêve, ou après un remords. Un de vos disciples, peut-être ?"
        ],
        hint: ["Le serpent est au nord-est du lit, dans la fosse, près des rochers fendus. Il frappe d'un coup sec."],
        complete: [
            "Il a cessé de siffler ? Alors le gué est à moi de nouveau ! Quant à ma perche, je la retrouverai bien un jour.",
            "Voici une poignée de limon sacré, ramassé sous la dernière flaque du fleuve : on dit qu'il donne aux flèches la mémoire de l'eau. Et un peu d'or, pour le dérangement."
        ],
        reward: { gold: 55, fragment: 'Limon sacré' }
    },
    {
        id: 'sq_drowned', side: true,
        title: 'Le métier de Mei',
        chapter: '✦ Quête secondaire — Lit du Fleuve Jaune',
        giver: 'weaver_mei', turnIn: 'weaver_mei', requires: ['q_sun_4'],
        objectives: [{ type: 'killGroup', target: 'drowned', text: 'Renvoyer dormir les 2 noyés revenants (nord du lit du fleuve)' }],
        offer: [
            "Seigneur archer… Je suis Mei, tisserande. Mon métier à tisser est resté sur la rive nord, avec les fils de soie que je gardais pour la mariée du village. Mais deux noyés sont remontés de la boue, et ils s'y sont installés comme chez eux.",
            "Je n'ose pas leur parler. Pourriez-vous les renvoyer dormir ? Ils ne vous feront pas de mal… enfin, pas beaucoup."
        ],
        hint: ["Les deux noyés rôdent dans la partie nord du lit, près de mon métier. Ils sont lents, mais ils frappent fort."],
        complete: [
            "Mon métier ! Les fils sont intacts. Le dernier noyé m'a même laissé son sourire, ou ce qu'il en reste.",
            "Prenez cette soie de ver céleste : elle est assez fine pour qu'une flèche passe à travers un anneau. Et ces pièces, pour que vous ayez de quoi manger."
        ],
        reward: { gold: 60, fragment: 'Soie de ver céleste' }
    },
    {
        id: 'sq_bell', side: true,
        title: 'La cloche du temple',
        chapter: '✦ Quête secondaire — Forêt de Bambous Calcinée',
        giver: 'monk_zhen', turnIn: 'monk_zhen', requires: ['q_sun_2'],
        objectives: [{ type: 'chest', target: 'temple_bell', text: 'Retrouver la cloche du temple sous les cendres (coin nord-ouest, près des ruines)' }],
        offer: [
            "Mon temple ne chante plus. Quand le Soleil de Cendres a brûlé la forêt, notre petite cloche de bronze est tombée dans les décombres, au nord-ouest. Sans elle, je ne sais plus à quelle heure prier.",
            "Pouvez-vous la retrouver ? Je ne demande ni gloire ni or : juste un son.",
            "Un jeune archer est venu méditer ici l'autre jour. Il n'a pas réussi : sa respiration battait comme un tambour de guerre. Il m'a demandé s'il existe un breuvage qui épargne la mort. Je lui ai répondu : oui, le temps."
        ],
        hint: ["La cloche est sous les cendres, dans le coin nord-ouest, à côté du temple brûlé. Aucun ennemi ne la garde."],
        complete: [
            "La voilà ! Un peu noircie, un peu fêlée, mais elle chante encore. Écoutez : c'est le son d'un monde qui continue.",
            "Prenez ce cinabre du temple, la poudre rouge qui scelle les talismans. Et ces pièces, offertes par les villageois."
        ],
        reward: { gold: 50, fragment: 'Cinabre du temple' }
    },
    {
        id: 'sq_old_pine', side: true,
        title: 'Le Vieux Pin Noir',
        chapter: '✦ Quête secondaire — Forêt de Bambous Calcinée',
        giver: 'herbalist_xu', turnIn: 'herbalist_xu', requires: ['q_sun_2'],
        objectives: [{ type: 'kill', target: 'old_pine', text: 'Apaiser le Vieux Pin Noir (coin sud-ouest de la forêt)' }],
        offer: [
            "Je cherche des plantes, seigneur. Elles ont toutes brûlé sauf une, qui pousse dans le coin sud-ouest, juste sous le Vieux Pin Noir, un esprit-arbre qui a perdu la tête dans l'incendie.",
            "Il n'attaque que lorsqu'on s'approche trop près. Pouvez-vous l'apaiser ? Ou l'abattre, s'il ne veut pas être apaisé."
        ],
        hint: ["Le Vieux Pin Noir est dans le coin sud-ouest de la forêt, au bord de la zone brûlée. Il charge quand on l'approche."],
        complete: [
            "Il s'est éteint comme une bougie. Je crois qu'il me remercie. La plante est sauve, regardez : une seule feuille, mais verte.",
            "Prenez cette sève de bambou, mise en gourde : elle rend la flèche légère. Et ces pièces, pour l'effort."
        ],
        reward: { gold: 75, fragment: 'Sève de bambou' }
    },
    {
        id: 'sq_oasis', side: true,
        title: "La cache de l'oasis",
        chapter: '✦ Quête secondaire — Désert de Gobi',
        giver: 'guide_dawa', turnIn: 'guide_dawa', requires: ['q_sun_6'],
        objectives: [{ type: 'chest', target: 'oasis_cache', text: "Retrouver la cache de l'oasis (coin nord-ouest du Gobi, près des tentes)" }],
        offer: [
            "Un guide du Gobi ne se perd jamais, seigneur. Mais il laisse parfois des choses derrière lui. J'ai enterré, il y a longtemps, une cache de rosée d'oasis dans le coin nord-ouest, sous une dalle rouge.",
            "Allez la chercher avant que le sable ne la mange. Et méfiez-vous des silhouettes au loin : au Gobi, un mirage a même une ombre, et il change de place chaque fois qu'on le défait."
        ],
        hint: ["La cache est enterrée dans le coin nord-ouest, près des tentes du marchand. Évitez de suivre les silhouettes qui changent de place au loin."],
        complete: [
            "Elle est intacte ! La rosée d'oasis ne se perd jamais, voyez-vous : elle attend qu'on la boive.",
            "Gardez-en pour vos flèches, elles tiendront la soif du désert. Et prenez ces pièces : un guide paie toujours ses dettes."
        ],
        reward: { gold: 45, fragment: "Rosée d'oasis" }
    },
    {
        id: 'sq_bandits', side: true,
        title: 'La caravane de Ma',
        chapter: '✦ Quête secondaire — Désert de Gobi',
        giver: 'merchant_ma', turnIn: 'merchant_ma', requires: ['q_sun_6'],
        objectives: [{ type: 'killGroup', target: 'sand_bandits', text: 'Chasser les 2 brigands du Gobi (sud-ouest du désert, sur la piste des caravanes)' }],
        offer: [
            "Seigneur, un mot ? Je suis Ma, marchand. Deux brigands attaquent ma caravane chaque semaine, au sud-ouest, là où la piste tourne. Ils ne volent pas seulement : ils cassent tout ce qu'ils n'emportent pas.",
            "Si vous pouviez les calmer, mon cœur et mon chargement vous en seraient reconnaissants.",
            "Un caravanier m'a parlé d'un archer qui courait vers l'Occident sans boire ni dormir. « Il fuit quelque chose, disait-il, ou il court après. » Je ne sais pas lequel est pire."
        ],
        hint: ["Les brigands tiennent le sud-ouest du Gobi, sur la piste des caravanes : un gladiateur et une lame masquée."],
        complete: [
            "La piste est libre ! Mes chameaux marchent la tête haute, et mon cœur bat de nouveau régulièrement.",
            "Prenez ce verre du désert, ramassé là où la foudre a frappé le sable : il est dur comme le ciel. Et ces pièces, pour votre peine."
        ],
        reward: { gold: 85, fragment: 'Verre du désert' }
    },
    {
        id: 'sq_thunder_wyrm', side: true,
        title: 'Le dragon-serpent du tonnerre',
        chapter: '✦ Quête secondaire — Monts du Tonnerre',
        giver: 'smith_tie', turnIn: 'smith_tie', requires: ['q_sun_3'],
        objectives: [{ type: 'kill', target: 'thunder_wyrm', text: 'Terrasser le dragon-serpent du tonnerre (coin nord-est des monts, sur la crête)' }],
        offer: [
            "Alors c'est vous, l'archer ? Bien. Je suis Tie, forgeron de flèches. Un dragon-serpent du tonnerre a niché dans le coin nord-est des monts, sur la crête où frappe l'éclair. Il en fait des perles de foudre, que je ne peux plus récolter.",
            "Battez-le, et je vous en garde une, enfermée dans du verre : de la foudre en bouteille, pour la pointe de votre meilleure flèche."
        ],
        hint: ["Le dragon-serpent du tonnerre est dans le coin nord-est, sur la crête. Il lance des éclairs : ne restez pas à découvert."],
        complete: [
            "Il est tombé ? Alors voici : de la foudre en bouteille, la dernière perle qu'il a faite. N'ouvrez jamais le bouchon sans vouloir tirer.",
            "Et ces pièces, gagnées à la sueur de votre front, et de mon enclume. Quand vous reviendrez, je vous referai toutes vos flèches."
        ],
        reward: { gold: 100, fragment: 'Foudre en bouteille' }
    },
    {
        id: 'sq_lei_drum', side: true,
        title: 'Le tambour du tonnerre',
        chapter: '✦ Quête secondaire — Monts du Tonnerre',
        giver: 'hermit_lei', turnIn: 'hermit_lei', requires: ['q_sun_3'],
        objectives: [{ type: 'chest', target: 'lei_drum', text: 'Retrouver le tambour du tonnerre (coin nord-ouest des Monts du Tonnerre)' }],
        offer: [
            "Je parle au tonnerre depuis trente ans, archer. Un jour, il m'a répondu, et il m'a demandé un tambour. J'en ai fabriqué un avec une peau de nuage, mais le vent l'a emporté dans le coin nord-ouest de la montagne.",
            "Rapportez-le-moi, et je vous donnerai un peu de vent céleste, celui qui court sous les nuages. Il rend les flèches droites comme la vérité.",
            "Le tonnerre m'a prévenu : un arc sera tendu contre un autre arc avant la fin de l'histoire. Je ne sais pas lequel des deux se brisera."
        ],
        hint: ["Le tambour est tombé dans le coin nord-ouest, près de ma hutte. Aucun ennemi ne le garde ; seul le vent s'en amuse."],
        complete: [
            "Mon tambour ! Écoutez comme il sonne. Le tonnerre va être content, il s'ennuyait.",
            "Voici le vent céleste que je vous ai promis, enfermé dans cette gourde : à n'ouvrir qu'en tirant. Et ces pièces, pour votre peine."
        ],
        reward: { gold: 70, fragment: 'Vent céleste' }
    },
    {
        id: 'sq_ore', side: true,
        title: 'La veine de cinabre',
        chapter: '✦ Quête secondaire — Gorges du Volcan',
        giver: 'miner_shan', turnIn: 'miner_shan', requires: ['q_sun_1'],
        objectives: [{ type: 'killGroup', target: 'ore_guards', text: 'Chasser les 2 pixiu de magma (nord-est des gorges, au-delà du défilé)' }],
        offer: [
            "Seigneur archer ! Je suis Shan, mineur. Deux pixiu de magma gardent la veine de cinabre, au nord-est de la gorge, derrière la barrière de lave. Impossible d'en tirer un grain de minerai sans se faire charger.",
            "Je suis prêt à vous payer tout ce que j'ai, et à vous offrir un morceau d'obsidienne vive, la plus noire que j'aie jamais taillée.",
            "Prenez garde au défilé, en chemin : un jeune archer y est passé tout à l'heure et vous attend, l'arc tendu. Un garçon qui a faim, voilà ce que j'ai vu. Un garçon qui a faim."
        ],
        hint: ["Les deux pixiu de magma gardent la veine au nord-est des gorges, passé le défilé. Ils chargent la tête baissée."],
        complete: [
            "Voilà la veine libre ! Mes pioches vont chanter.",
            "Voici l'obsidienne vive que je vous avais promise. Elle tranche le feu, dit-on. Et mon or : ne le dépensez pas en gâteaux, ma femme les fait mieux."
        ],
        reward: { gold: 110, fragment: 'Obsidienne vive' }
    },
    {
        id: 'sq_ember', side: true,
        title: 'La braise du phénix',
        chapter: '✦ Quête secondaire — Gorges du Volcan',
        giver: 'priestess_yan', turnIn: 'priestess_yan', requires: ['q_sun_1'],
        objectives: [{ type: 'chest', target: 'phoenix_brazier', text: 'Rapporter la cendre du brasero du phénix (coin nord-ouest, derrière le sanctuaire)' }],
        offer: [
            "Autrefois, je servais les soleils. J'ai rallumé chaque aube un brasero de cendre de phénix, près du sanctuaire, au nord-ouest. Depuis que les soleils sont devenus fous, ce brasero est abandonné.",
            "Récupérez-en la cendre. Elle n'a plus de maître, et je ne veux pas qu'un autre la prenne pour de mauvaises raisons.",
            "Je connais le regard de l'archer qui vous guette au défilé : celui d'un garçon qui croit que le monde lui doit quelque chose. J'ai eu ce regard, à seize ans, devant l'autel d'un soleil."
        ],
        hint: ["Le brasero est à l'ouest, dans l'enceinte du vieux temple du feu, derrière le sanctuaire. Rien ne le garde."],
        complete: [
            "La cendre de phénix… Elle est encore tiède, comme si l'oiseau venait de s'envoler.",
            "Prenez-la : c'est pour vos flèches, pour qu'elles renaissent à chaque tir. Et ces pièces. Je n'ai plus besoin de rien d'autre que de votre pardon."
        ],
        reward: { gold: 80, fragment: 'Cendre de phénix' }
    },
    {
        id: 'sq_scarred_tiger', side: true,
        title: 'Balafré',
        chapter: '✦ Quête secondaire — Plaine des Fauves',
        giver: 'hunter_wu', turnIn: 'hunter_wu', requires: ['q_sun_5'],
        objectives: [{ type: 'kill', target: 'scarred_tiger', text: 'Abattre Balafré, le tigre embrasé (coin nord-est de la plaine)' }],
        offer: [
            "Seigneur archer, je vous attendais. Je suis Wu, chasseur. Balafré, un tigre embrasé, rôde dans le coin nord-est de la plaine : il m'a laissé cette cicatrice, et il a tué mon meilleur chien.",
            "Je ne vous demande pas de tuer pour tuer : la chaleur l'a rendu fou. Mais si vous ne l'arrêtez pas, il mettra le feu au village des bergers."
        ],
        hint: ["Balafré rôde dans le coin nord-est de la plaine, derrière les ennemis de la lisière. Il est rapide : visez avant qu'il charge."],
        complete: [
            "Balafré est tombé… J'avais cru éprouver de la haine. Je n'éprouve que de la fatigue.",
            "Prenez ce croc, il est encore chaud : il aiguisera la pointe de vos flèches. Et ces pièces, pour un chasseur honnête."
        ],
        reward: { gold: 130, fragment: 'Croc de tigre embrasé' }
    },
    {
        id: 'sq_zi_bell', side: true,
        title: 'La clochette du bélier',
        chapter: '✦ Quête secondaire — Plaine des Fauves',
        giver: 'shepherd_zi', turnIn: 'shepherd_zi', requires: ['q_sun_5'],
        objectives: [{ type: 'chest', target: 'zi_bell', text: "Retrouver la clochette du troupeau (sud-ouest de la plaine, derrière l'enclos)" }],
        offer: [
            "Seigneur, je suis Zi. Mon troupeau s'est enfui à cause des flammes, mais la clochette de mon bélier-guide est restée derrière l'enclos, au sud-ouest. Sans elle, les bêtes ne reviendront pas.",
            "Je ne peux pas aller la chercher : la meute rôde plus loin. Vous qui avez de bonnes jambes…"
        ],
        hint: ["La clochette est derrière l'enclos, au sud-ouest de la plaine, loin de la meute. Passez par le sud : c'est le plus sûr."],
        complete: [
            "Ma clochette ! Écoutez comme elle tinte : mes bêtes vont l'entendre de loin et rentrer comme des enfants.",
            "Prenez cette laine de nuage, tressée par mes brebis : légère comme l'air, elle étouffe le bruit des flèches. Et ces pièces."
        ],
        reward: { gold: 60, fragment: 'Laine de nuage' }
    },
    {
        id: 'sq_nets', side: true,
        title: 'Les filets déchirés',
        chapter: '✦ Quête secondaire — Rivage de la Mer Orientale',
        giver: 'fisher_hai', turnIn: 'fisher_hai', requires: ['q_sun_7'],
        objectives: [{ type: 'killGroup', target: 'net_cutters', text: 'Chasser les 2 serpents coupe-filets (nord-est de la grève)' }],
        offer: [
            "Seigneur archer, regardez mes filets : ils pendent en lambeaux. Deux serpents de mer, échoués au nord-est de la grève, les ont déchirés pour s'en faire un nid. Sans filets, pas de poisson ; sans poisson, pas de village.",
            "Ils ont perdu l'eau, ils ont perdu la raison. Si vous pouvez les calmer, je vous donnerai la pierre de glace que je garde dans ma glacière : la dernière du rivage."
        ],
        hint: ["Les serpents coupe-filets sont au nord-est de la grève, sur les rochers. Ils mordent vite, mais sont lents à tourner."],
        complete: [
            "Mes filets ! Presque entiers. On les raccommodera ce soir, en chantant.",
            "Voici la pierre de glace, comme promis : elle garde le poisson frais trois jours, et la flèche froide une vie. Et ces pièces."
        ],
        reward: { gold: 95, fragment: 'Pierre de glace' }
    },
    {
        id: 'sq_pearl', side: true,
        title: 'La perle du Roi-Dragon',
        chapter: '✦ Quête secondaire — Rivage de la Mer Orientale',
        giver: 'envoy_longwang', turnIn: 'envoy_longwang', requires: ['q_sun_7'],
        objectives: [{ type: 'chest', target: 'dragon_pearl', text: 'Retrouver la perle du Roi-Dragon (coin sud-ouest de la grève)' }],
        offer: [
            "Archer, une faveur. J'ai laissé tomber la perle de mon maître en traversant la grève, au sud-ouest. Sans elle, je ne puis rentrer au palais ; avec elle, le Roi-Dragon pourra enfin pleurer, et sa mer avec lui.",
            "Récupérez-la. Je suis tenu de ne pas quitter mon poste, et je tremble à l'idée que le sable l'ait avalée.",
            "Mon maître m'a chargé d'ajouter ceci : la Reine Mère de l'Occident n'offre pas son élixir à n'importe qui. Elle sait lire dans les cœurs. Elle a vu quelque chose dans le vôtre, et quelque chose dans un autre, qu'elle n'a pas aimé."
        ],
        hint: ["La perle est dans le coin sud-ouest de la grève, juste au-dessus de la ligne d'eau. Aucun ennemi ne la garde."],
        complete: [
            "La perle ! Elle est intacte ! Le Roi-Dragon vous en sera redevable dix mille ans.",
            "En gage de sa gratitude, voici une écaille de dragon, détachée de sa propre barbe. Vos flèches voleront aussi droit que la mer. Et ces pièces d'or."
        ],
        reward: { gold: 140, fragment: 'Écaille de dragon' }
    },
    {
        id: 'sq_crane', side: true,
        title: 'Le nid de la grue',
        chapter: '✦ Quête secondaire — Cime du Fusang',
        giver: 'crane_envoy', turnIn: 'crane_envoy', requires: ['q_sun_8'],
        objectives: [{ type: 'chest', target: 'crane_nest', text: 'Rapporter les plumes du nid de grue (coin nord-ouest du Fusang, derrière le pavillon)' }],
        offer: [
            "Archer, ma sœur la grue a perdu ses petits, et son nid, au nord-ouest de l'Arbre, ne tient plus qu'à un fil. J'ai besoin de quelqu'un d'adroit pour y ramasser les dernières plumes avant la pluie.",
            "La Reine Mère en fait des flèches de messager : celles qui ne manquent jamais ceux qu'on aime.",
            "Un jeune archer est venu frapper à sa porte, il y a quelques semaines. Il demandait un élixir pour lui seul. Elle a refusé avec bonté : « Je n'ai qu'un seul véritable élixir, et il est déjà donné. » Je n'ai jamais vu quelqu'un pâlir ainsi, ni sourire en même temps."
        ],
        hint: ["Le nid est dans le coin nord-ouest du Fusang, derrière le pavillon. Aucun ennemi ne le garde."],
        complete: [
            "Elles sont intactes… et chaudes. Ma sœur vous remercie, à sa manière : par ce cri que vous entendrez cette nuit.",
            "Voici une plume de grue, choisie pour vous : elle guide la flèche, même dans le vent. Et ces pièces d'or, de la part de la Reine Mère."
        ],
        reward: { gold: 70, fragment: 'Plume de grue' }
    }
];
