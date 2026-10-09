// Compagnons de route et dialogues contextuels de Match3-Quest (données pures, sans DOM ; propriétaire : agent Scénario).
//
// COMPANIONS : personnages qui rejoignent le héros pendant l'aventure.
//   { id, name, title, npc, joinWhen }
//     - npc      : id d'un PNJ existant dont on réutilise le dessin pour le portrait de dialogue ;
//     - joinWhen : condition d'avancement (id de quête terminée, d'ennemi vaincu, de coffre ouvert ou de PNJ parlé) ; absente = d'emblée.
//
// BANTER : répliques de groupe, jouées UNE FOIS (exploration.js : collectBanter), quand le héros entre dans un lieu ou après un événement.
//   { id, companion, screen?, whenDone?, unless?, lines | scenes }
//     - companion : id (ou liste d'ids) : tous doivent avoir rejoint le groupe ;
//     - screen    : id d'écran (ou liste) où se trouve le héros ; absent = n'importe où ;
//     - whenDone  : condition d'avancement à remplir (événement ou choix récent) ; unless : condition qui annule la réplique ;
//     - scenes    : [{ speaker, lines }] (speaker : { name, title?, npc?, hero? }) ; sinon `speaker` + `lines` pour une seule voix.
//   Un compagnon commente un LIEU, une DÉCISION (chemin pris) ou un ÉVÉNEMENT ; jamais deux fois la même chose, bulles ≤ 160 caractères.
//
// Trois compagnons, trois moments, trois voix (tous facultatifs : ils dépendent de quêtes annexes) :
//   - Xiao Gui (région 1, `sq_rice_thief`) : le démon-renard chapardeur battu aux rizières. Tutoie tout le monde, farceur, « hi hi ».
//     But : gagner ses neuf queues (il en a trois) ; il apprend que les queues se gagnent en rendant service, pas en volant.
//   - Zhi (région 3, `sq_bell`) : le jeune moine novice de Maître Zhen. Vouvoie le héros (« seigneur »), cite son Maître, tutoie Xiao Gui.
//     But : entendre la cloche sonner « l'heure qui n'existe pas encore » et savoir si la compassion s'étend aux soleils.
//   - Dawa (région 4, `sq_oasis`) : le guide du Gobi. Vouvoie le héros, pince-sans-rire, proverbes du désert, tutoie les jeunes.
//     But : voir l'endroit où naît le jour (le Fusang), « un lieu où personne ne se perd ».
//
// Les chemins vers les soleils 2, 3, 5, 6, 8 et 9 (story.js : gardes abattus ou pourparlers `parley_sunN`) y sont commentés par une réplique
// pour chaque choix (`whenDone` + `unless` exclusifs), précédée d'une « aptitude narrative » : un compagnon suggère le pourparler.

const HERO = { name: 'Hou Yi', hero: true };
const GUI = { name: 'Xiao Gui', title: 'Démon-renard repenti', npc: 'huli_xia' };
const ZHI = { name: 'Zhi', title: 'Jeune moine novice', npc: 'young_monk_zhi' };
const DAWA = { name: 'Dawa', title: 'Guide du désert', npc: 'guide_dawa' };

const say = (speaker, ...lines) => ({ speaker, lines });
// Les deux gardes d'un sanctuaire : « les gardes sont abattus » = les deux sont vaincus.
const wardens = n => [`sun${n}_wardens_a`, `sun${n}_wardens_b`];

export const COMPANIONS = [
    { id: 'xiao_gui', name: 'Xiao Gui', title: 'Démon-renard repenti', npc: 'huli_xia', joinWhen: 'sq_rice_thief' },
    { id: 'zhi', name: 'Zhi', title: 'Jeune moine novice', npc: 'young_monk_zhi', joinWhen: 'sq_bell' },
    { id: 'dawa', name: 'Dawa', title: 'Guide du désert', npc: 'guide_dawa', joinWhen: 'sq_oasis' }
];

export const BANTER = [
    // ── Région 1 : Rizières Desséchées (Xiao Gui rejoint le héros) ─────────────────────────────
    { id: 'gui_rejoint', companion: 'xiao_gui', scenes: [
        say(GUI, "Hi hi ! Tu m'as battu, archer. Personne ne m'avait battu depuis que j'ai volé la lune dans une jarre. C'était un reflet, mais quand même."),
        say(HERO, "Tu aurais pu rendre son riz au paysan plus tôt, Xiao Gui."),
        say(GUI,
            "Un renard rend toujours ce qu'il prend, à la fin. C'est la fin qui est longue. Je viens avec toi : j'ai neuf queues à gagner.",
            "Pour l'instant, j'en ai trois. Ne ris pas.")
    ] },
    { id: 'gui_maison_houyi', companion: 'xiao_gui', screen: 'rizieres_h_houyi', scenes: [
        say(GUI,
            "Ça sent la farine et le thé chaud, chez toi. Je n'ai jamais rien volé dans une maison qui sentait aussi bon.",
            "Et cette fiole sur l'autel des ancêtres… non. Je ne la regarde pas."),
        say(HERO, "Gui."),
        say(GUI, "Je regarde le plafond. Il est très beau, ton plafond.")
    ] },
    { id: 'gui_fengmeng_1', companion: 'xiao_gui', whenDone: 'fengmeng_1', scenes: [
        say(GUI,
            "Ton disciple de la digue. Il te regardait comme je regarde les poches des autres.",
            "Je connais ce regard. C'est le mien, avant que je te suive."),
        say(HERO, "Fengmeng n'est pas méchant, Xiao Gui. Il est pressé."),
        say(GUI, "Pressé de quoi ? On ne court pas comme ça après ce qu'on n'a pas envie de voler.")
    ] },

    // ── Région 2 : Lit du Fleuve Jaune (soleil 2 : noyés-gardes ou doyen des noyés) ───────────────
    { id: 'gui_fleuve_village', companion: 'xiao_gui', screen: 'fleuve_village', scenes: [
        say(GUI,
            "Un fleuve sans eau ! C'est comme un renard sans queue. Enfin, comme moi : un renard avec peu de queues.",
            "Regarde les barques, couchées dans la boue comme des chats qui boudent."),
        say(HERO, "Il reviendra, Xiao Gui."),
        say(GUI, "J'espère. J'aimerais voler un poisson avant de mourir. Un seul. Pour la forme.")
    ] },
    // Aptitude narrative : Xiao Gui connaît le doyen des noyés et suggère de lui parler (la quête de Mei est faite, les gardes sont debout).
    { id: 'gui_fleuve_apt', companion: 'xiao_gui', screen: 'fleuve', whenDone: 'sq_drowned', unless: 'sun2_wardens_b', scenes: [
        say(GUI,
            "Eh, archer ! Les noyés de Mei, tu les as renvoyés dormir sans les humilier. Ça se sait, dans la boue.",
            "Leur doyen vit sous les roches. Un vieux têtu, mais poli avec les polis. Parle-lui avant de tirer : il aime qu'on l'écoute."),
        say(HERO, "Tu as déjà parlé à un noyé ?"),
        say(GUI, "Je lui ai volé sa pipe, une fois. Il m'a pardonné. Il pardonne tout, sauf le silence.")
    ] },
    { id: 'gui_fleuve_risque', companion: 'xiao_gui', screen: 'fleuve', whenDone: wardens(2), unless: 'parley_sun2', scenes: [
        say(GUI,
            "Deux gardes à terre, et pas une goutte de sueur ! Tu es un vrai dur, archer.",
            "Mais ils regardaient le lit sec en tombant, tu as vu ? Comme un enfant qui regarde la porte."),
        say(HERO, "Je n'ai pas eu le temps de leur demander ce qu'ils gardaient."),
        say(GUI, "Voilà. Moi, je vole vite et je m'excuse après. Toi, tu tires vite. C'est pareil, hi hi… un peu.")
    ] },
    { id: 'gui_fleuve_parley', companion: 'xiao_gui', screen: 'fleuve', whenDone: 'parley_sun2', unless: 'sun2_wardens_a', scenes: [
        say(GUI, "Il t'a ouvert le chemin rien qu'en parlant ! Moi, il me faut voler trois fois avant qu'on me dise bonjour."),
        say(HERO, "Je lui ai juste promis de rendre l'eau, Xiao Gui."),
        say(GUI, "Voilà. Les promesses, ça ne se vole pas. Je note, je note…")
    ] },
    { id: 'gui_fleuve_soleil', companion: 'xiao_gui', screen: 'fleuve', whenDone: 'sun_2', scenes: [
        say(GUI, "Écoute, écoute ! L'eau revient en faisant du bruit, comme un chat qu'on a mouillé !"),
        say(HERO, "Doucement, Xiao Gui. Elle vient de loin."),
        say(GUI, "Je sais. Moi aussi, je viens de loin : d'un champ de riz. Et regarde-moi, au bord d'un fleuve !")
    ] },

    // ── Région 3 : Forêt de Bambous Calcinée (Zhi rejoint ; soleil 3 : esprits de la cloche ou âme de la cloche) ──
    { id: 'zhi_rejoint', companion: 'zhi', scenes: [
        say(ZHI,
            "Seigneur archer, Maître Zhen m'envoie avec vous. « Qui ne quitte pas sa cour ne connaît que sa cour », dit-il. J'ai pris mon balai, par habitude.",
            "Je voudrais entendre la cloche sonner l'heure qui n'existe pas encore. Et comprendre si la compassion s'étend aux soleils."),
        say(HERO, "Viens, Zhi. Tu m'aideras à écouter.")
    ] },
    { id: 'gui_zhi_rencontre', companion: ['xiao_gui', 'zhi'], scenes: [
        say(GUI, "Un moine ! Il va me faire la morale. Le karma, les balais, les sandales…"),
        say(ZHI, "Je ne fais la morale à personne, Xiao Gui. Je balaie ce qui traîne. Les queues de renard comprises."),
        say(GUI, "Hé ! Je suis très fier de mes queues !"),
        say(ZHI, "Alors il n'y a rien à balayer.")
    ] },
    { id: 'gui_xia_queues', companion: 'xiao_gui', screen: 'bambous_village', scenes: [
        say(GUI,
            "Archer, regarde la dame, là-bas : sept queues ! Sept ! Elle ne les cache même pas.",
            "Il faut que je lui demande comment elle fait. Moi, pour trois queues, j'ai volé trois fois."),
        say(HERO, "On ne vole pas une queue, Xiao Gui."),
        say(GUI, "Alors c'est ça, le secret ? Hi hi… Je déteste ça.")
    ] },
    { id: 'zhi_bambous_wild', companion: 'zhi', screen: 'bambous_wild', scenes: [
        say(ZHI, "Ces tiges noircies sont creuses, seigneur. Maître Zhen dit que le bambou plie sans casser, parce qu'il est vide de lui-même."),
        say(HERO, "Vide de lui-même ?"),
        say(ZHI, "Il n'a rien à défendre, alors il peut se redresser. J'y réfléchis depuis trois ans, sans jamais finir.")
    ] },
    // Aptitude narrative : Zhi entend l'âme de la cloche et suggère de lui parler avant de lever l'arc.
    { id: 'zhi_bambous_apt', companion: 'zhi', screen: 'bambous', whenDone: 'sq_bell', unless: 'sun3_wardens_b', scenes: [
        say(ZHI,
            "Seigneur, la cloche est de nouveau sur son pilier. Écoutez : les deux esprits du soleil tournent au rythme de son tintement.",
            "Maître Zhen dit qu'une cloche a une âme, et qu'on l'entend mieux la bouche fermée. Parlons-lui avant de lever l'arc."),
        say(HERO, "Tu crois qu'elle répondra ?"),
        say(ZHI, "Je crois qu'on ne rend pas sa voix à quelqu'un sans qu'il veuille vous remercier.")
    ] },
    { id: 'zhi_bambous_risque', companion: 'zhi', screen: 'bambous', whenDone: wardens(3), unless: 'parley_sun3', scenes: [
        say(ZHI,
            "Les esprits de la cloche se sont tus. Je prierai pour eux ce soir, seigneur, si vous le permettez.",
            "Vous aviez raison de frapper : ils vous auraient brûlé. Mais ils tournaient depuis si longtemps… Un deuil ne se règle pas à coups de flèches."),
        say(HERO, "Prie pour eux, Zhi. Moi, je n'ai pas su les entendre.")
    ] },
    { id: 'zhi_bambous_parley', companion: 'zhi', screen: 'bambous', whenDone: 'parley_sun3', unless: 'sun3_wardens_a', scenes: [
        say(ZHI,
            "La cloche a parlé, et les échos se sont tus sans qu'on tire une flèche ! Maître Zhen ne me croira jamais.",
            "Je crois avoir compris la leçon du bambou, seigneur : on peut se redresser sans casser personne."),
        say(HERO, "Retiens-la bien, Zhi. Elle te servira plus que mon arc.")
    ] },
    { id: 'zhi_bambous_soleil', companion: 'zhi', screen: 'bambous', whenDone: 'sun_3', scenes: [
        say(ZHI, "Regardez, seigneur : un brin de bambou vert, au pied de la cloche. Pas plus grand qu'une aiguille."),
        say(HERO, "La forêt n'est pas morte."),
        say(ZHI, "Elle attendait, comme moi. Je sonnerai l'heure du matin en rentrant, même si le soleil la connaît déjà.")
    ] },

    // ── Région 4 : Désert de Gobi (Dawa rejoint) ──────────────────────────────────────────────
    { id: 'dawa_rejoint', companion: 'dawa', scenes: [
        say(DAWA,
            "Ma cache était intacte, seigneur. Un guide paie ses dettes : je vous mène jusqu'au bout du Gobi, et plus loin si les cartes l'acceptent.",
            "J'ai guidé cent caravanes vers l'ouest. Jamais vers l'est, là où le jour naît. Je voudrais voir un endroit où personne ne se perd."),
        say(HERO, "Le Fusang. Tu y seras, Dawa."),
        say(DAWA, "On verra. Au désert, on ne promet pas : on marche.")
    ] },
    { id: 'gui_dawa_village', companion: ['xiao_gui', 'dawa'], screen: 'gobi_village', scenes: [
        say(GUI, "Dawa, ce marchand, là-bas, il scintille. C'est un mirage ?"),
        say(DAWA, "C'est Ma. Il scintille parce qu'il transpire. Un mirage ne paie pas ses dettes."),
        say(GUI, "Dommage. J'en aurais volé un."),
        say(DAWA, "Il t'aurait volé la route en échange, Xiao Gui.")
    ] },
    { id: 'dawa_gobi_wild', companion: 'dawa', screen: 'gobi_wild', scenes: [
        say(DAWA, "Les dunes parlent, ici. Ne répondez à aucune voix qui connaît votre nom, seigneur."),
        say(HERO, "Et si elle connaît celui de Chang'e ?"),
        say(DAWA, "Alors c'est la pire. Elle ment mieux que les autres.")
    ] },
    { id: 'dawa_gobi_soleil', companion: 'dawa', screen: 'gobi', whenDone: 'sun_4', scenes: [
        say(DAWA, "L'ombre, seigneur. Le vrai pèse sur le sable, et le sable ne ment pas. Vous avez l'œil d'un guide."),
        say(HERO, "Les autres me souriaient, Dawa. Lui seul m'a regardé en face."),
        say(DAWA, "Un mirage sourit toujours. Un vrai ennemi, jamais : c'est ainsi qu'on le reconnaît.")
    ] },

    // ── Région 5 : Monts du Tonnerre (soleil 5 : foudre-gardes ou petite voix du tonnerre) ─────────────
    // Aptitude narrative : Dawa connaît les orages du désert et suggère de chercher une voix avant de choisir l'arc.
    { id: 'dawa_tonnerre_apt', companion: 'dawa', screen: 'tonnerre', whenDone: 'sq_lei_drum', unless: 'sun5_wardens_b', scenes: [
        say(DAWA,
            "Le vieux Lei avait raison : le tonnerre répond au tambour. Regardez les gardes, seigneur : ils bougent en mesure.",
            "Dans le désert, quand l'orage gronde, on ne le défie pas : on lui parle à voix basse. Les orages ont toujours un enfant, quelque part."),
        say(HERO, "Un enfant du tonnerre ?"),
        say(DAWA, "Je n'en sais pas davantage. Mais je chercherais une petite voix au pied du col, avant de choisir l'arc.")
    ] },
    { id: 'dawa_tonnerre_risque', companion: 'dawa', screen: 'tonnerre', whenDone: wardens(5), unless: 'parley_sun5', scenes: [
        say(DAWA,
            "La cage est tombée, seigneur, et les gardes avec. Vous avez pris la dune par son sommet : on arrive vite, et essoufflé.",
            "Le soleil sera entier devant vous. Au Gobi, on dit qu'une corde coupée ne se renoue pas : gardez votre souffle.")
    ] },
    { id: 'dawa_tonnerre_parley', companion: 'dawa', screen: 'tonnerre', whenDone: 'parley_sun5', unless: 'sun5_wardens_a', scenes: [
        say(DAWA, "Il a suffi d'un enfant et d'un tambour. Au désert, on appelle cela contourner la dune."),
        say(HERO, "Ses frères ont lâché la cage sans broncher."),
        say(DAWA, "On lâche plus volontiers pour une voix connue que pour une flèche. Gardez vos forces pour le soleil, seigneur.")
    ] },
    { id: 'gui_tonnerre_soleil', companion: 'xiao_gui', screen: 'tonnerre', whenDone: 'sun_5', scenes: [
        say(GUI, "Mes poils retombent ! J'avais l'air d'un hérisson depuis trois jours."),
        say(HERO, "Cinq soleils, Xiao Gui."),
        say(GUI, "Cinq ! Il en reste quatre, tu comptes bien. Moi, je compte mes queues : toujours trois, mais je sens que ça vient.")
    ] },

    // ── Région 6 : Gorges du Volcan (Fengmeng, rencontre 2 ; soleil 6 : forgerons de magma ou vieil attiseur) ──
    { id: 'zhi_fengmeng_2', companion: 'zhi', screen: 'volcan', whenDone: 'fengmeng_2', scenes: [
        say(ZHI, "Il respirait comme un tambour de guerre, seigneur. Maître Zhen m'a parlé d'un jeune archer venu méditer, qui demandait un breuvage contre la mort."),
        say(HERO, "Et que lui a répondu ton maître ?"),
        say(ZHI, "« Oui : le temps. » Il n'a pas voulu l'entendre. On guérit mal ce qu'on ne regarde pas, seigneur. Regardons-le.")
    ] },
    { id: 'gui_fengmeng_2', companion: 'xiao_gui', screen: 'volcan', whenDone: 'fengmeng_2', scenes: [
        say(GUI, "Il t'a visé, et toi tu l'as épargné. Moi, je lui aurais piqué l'oreille, hi hi."),
        say(HERO, "Il court après quelque chose qui ne lui revient pas."),
        say(GUI, "Comme moi avant les rizières. Sauf que moi, on m'a battu avec gentillesse. Lui, il n'a pas encore trouvé qui.")
    ] },
    { id: 'zhi_yan_village', companion: 'zhi', screen: 'volcan_village', scenes: [
        say(ZHI, "La prêtresse Yan prie encore, seigneur, mais plus les soleils. Maître Zhen dit qu'on ne quitte pas un autel : on le déplace dans son cœur."),
        say(HERO, "Et le tien, où est-il ?"),
        say(ZHI, "Dans la cour du temple, sous le balai, là où l'on apprend à ne rien posséder.")
    ] },
    // Aptitude narrative : Zhi, qui connaît les temples, suggère de rencontrer le vieil attiseur dont parle Yan.
    { id: 'zhi_volcan_apt', companion: 'zhi', screen: 'volcan', whenDone: 'sq_ember', unless: 'sun6_wardens_b', scenes: [
        say(ZHI,
            "La cendre du phénix est entre de bonnes mains, seigneur. Un feu qu'on a veillé longtemps ne s'éteint pas : il passe à quelqu'un.",
            "Les forgerons de magma soufflent par devoir, sans savoir pourquoi. Yan parle d'un vieil attiseur de son temple. Il écoutera ceux qu'elle estime."),
        say(HERO, "Alors j'irai lui parler avant de bander l'arc.")
    ] },
    { id: 'zhi_volcan_risque', companion: 'zhi', screen: 'volcan', whenDone: wardens(6), unless: 'parley_sun6', scenes: [
        say(ZHI, "Ils soufflaient encore en tombant, seigneur. Je compte les feux que nous éteignons : aujourd'hui, deux de plus."),
        say(HERO, "Ils ne nous laissaient pas le choix, Zhi."),
        say(ZHI, "Peut-être. Mais je garderai ce soir une braise pour eux. Une petite, qui ne brûle personne.")
    ] },
    { id: 'zhi_volcan_parley', companion: 'zhi', screen: 'volcan', whenDone: 'parley_sun6', unless: 'sun6_wardens_a', scenes: [
        say(ZHI, "Le vieil attiseur a parlé, et les soufflets se sont tus. Yan avait raison de le respecter, seigneur."),
        say(HERO, "On gagne parfois plus à écouter qu'à viser."),
        say(ZHI, "Maître Zhen le dit en moins de mots : « Le balai ne combat pas la poussière. Il lui montre la porte. »")
    ] },
    { id: 'dawa_volcan_soleil', companion: 'dawa', screen: 'volcan', whenDone: 'sun_6', scenes: [
        say(DAWA, "La roche refroidit comme un chameau qui se couche : lentement, avec des grognements. Six soleils, seigneur."),
        say(HERO, "Tu penses encore au désert ?"),
        say(DAWA, "Toujours. Mais ici, la pierre me parle moins fort que le sable. C'est moins bavard, un volcan.")
    ] },

    // ── Région 7 : Plaine des Fauves (soleil 7 : la meute, toujours un combat) ──────────────────
    { id: 'gui_fauves_loups', companion: 'xiao_gui', screen: 'fauves_village', scenes: [
        say(GUI, "Des loups de braise ! Archer, ce sont mes cousins éloignés. Très éloignés. Je suis plus petit et beaucoup plus poli."),
        say(HERO, "Reste derrière moi, Xiao Gui."),
        say(GUI, "Je reste derrière toi… et devant tes provisions. C'est stratégique.")
    ] },
    { id: 'gui_fauves_soleil', companion: 'xiao_gui', screen: 'fauves', whenDone: 'sun_7', scenes: [
        say(GUI, "Chut. Les loups dorment contre les brebis. On dirait un conte pour enfants."),
        say(HERO, "Ils avaient peur, pas faim."),
        say(GUI, "Comme moi, avant : on mord quand on a peur. Moi, je volais ; eux, ils brûlaient. C'est pareil, au fond.")
    ] },

    // ── Région 8 : Rivage de la Mer Orientale (soleil 8 : gardes-marée ou amiral du Roi-Dragon) ──────
    { id: 'gui_mer_perles', companion: 'xiao_gui', screen: 'mer_village', scenes: [
        say(GUI, "Des perles ! Des perles partout ! … Je ne les prends pas. Je les regarde très fort."),
        say(HERO, "Bravo."),
        say(GUI, "Je les compte, c'est pareil. Soixante-douze. Soixante-treize ! Non, c'est un œil de poisson.")
    ] },
    // Aptitude narrative : Xiao Gui, qui flaire les trésors, comprend que la perle rendue ouvre la voie de l'amiral.
    { id: 'gui_mer_apt', companion: 'xiao_gui', screen: 'mer', whenDone: 'sq_pearl', unless: 'sun8_wardens_b', scenes: [
        say(GUI,
            "Archer, la perle du Roi-Dragon, c'est la clef de son palais. Quelqu'un en galons rôde près des récifs depuis qu'elle est rentrée.",
            "Je crois que c'est l'amiral. Les gardes-marée n'écoutent que lui, et lui n'écoute que la perle. Va le saluer, il veut te remercier."),
        say(HERO, "Un amiral qui remercie ? Étonnant."),
        say(GUI, "Il paraît qu'il est susceptible. Sois poli, comme avec moi.")
    ] },
    { id: 'gui_mer_risque', companion: 'xiao_gui', screen: 'mer', whenDone: wardens(8), unless: 'parley_sun8', scenes: [
        say(GUI,
            "Splash ! Un serpent, un docteur-démon, et pas une égratignure sur toi, archer !",
            "Tu as remarqué comme ils chantaient bien, avant ? Moi, ça me donnait envie de dormir."),
        say(HERO, "Ils obéissaient à un ordre."),
        say(GUI, "Et toi aussi. C'est ça, le pire avec les ordres : on ne sait plus qui est fâché contre qui.")
    ] },
    { id: 'gui_mer_parley', companion: 'xiao_gui', screen: 'mer', whenDone: 'parley_sun8', unless: 'sun8_wardens_a', scenes: [
        say(GUI, "L'amiral t'a salué comme un roi ! Moi, on me salue avec un balai."),
        say(HERO, "On ne m'a pas obéi par peur, Xiao Gui. On m'a fait confiance. C'est plus lourd à porter."),
        say(GUI, "Je comprends. Et là… attends. Archer, ma queue me chatouille ! Elle pousse ! Une quatrième !")
    ] },
    { id: 'dawa_mer_soleil', companion: 'dawa', screen: 'mer', whenDone: 'sun_8', scenes: [
        say(DAWA, "Je croyais que le Gobi était la plus grande étendue du monde, seigneur. La mer l'est davantage, et elle respire."),
        say(HERO, "Plus qu'un soleil, Dawa."),
        say(DAWA, "Et plus qu'un jour de marche jusqu'à l'endroit où le jour naît. J'ai hâte, et j'ai peur.")
    ] },

    // ── Région 9 : Cime du Fusang (soleil 9 : grues-lige ou Hegui ; le Dixième Soleil) ───────────
    { id: 'dawa_fusang_village', companion: 'dawa', screen: 'fusang_village', scenes: [
        say(DAWA, "Nous y voici, seigneur : le lieu où naît le jour. Je pensais y trouver des cartes. Je n'y trouve que de la lumière."),
        say(HERO, "Tu t'es perdu ?"),
        say(DAWA, "Pour la première fois en connaissance de cause. Devant la beauté, c'est permis.")
    ] },
    // Aptitude narrative : Dawa lit l'attitude des grues et suggère que celle qui doit son nid au héros peut les rappeler.
    { id: 'dawa_fusang_apt', companion: 'dawa', screen: 'fusang', whenDone: 'sq_crane', unless: 'sun9_wardens_b', scenes: [
        say(DAWA,
            "Regardez comment les grues tiennent leurs ailes, seigneur. Pas vers vous : vers le petit, derrière. On ne garde ainsi que ce qu'on aime.",
            "La sœur de la messagère a retrouvé son nid grâce à vous. Une grue qui doit quelque chose est une grue qui écoute."),
        say(HERO, "Elle pourrait les rappeler ?"),
        say(DAWA, "Je l'ignore. Mais au désert, on demande toujours avant de franchir un puits.")
    ] },
    { id: 'dawa_fusang_risque', companion: 'dawa', screen: 'fusang', whenDone: wardens(9), unless: 'parley_sun9', scenes: [
        say(DAWA,
            "Les grues sont tombées, et le petit n'a pas bougé. Votre main a tenu, seigneur.",
            "Il regarde les plumes dans l'herbe. Il ne dira rien : les enfants se taisent quand on tombe devant eux.")
    ] },
    { id: 'dawa_fusang_parley', companion: 'dawa', screen: 'fusang', whenDone: 'parley_sun9', unless: 'sun9_wardens_a', scenes: [
        say(DAWA,
            "Elles se sont posées sur la branche sans un cri. Le petit a levé la tête : il vous a vu les écarter avec des mots.",
            "Il ne tremblera pas quand vous tirerez, seigneur. Pour un tir de précision, c'est la meilleure des nouvelles.")
    ] },
    { id: 'zhi_fusang_dixieme', companion: 'zhi', screen: 'fusang', whenDone: 'sun_9', scenes: [
        say(ZHI, "Le Dixième tremble encore, seigneur. J'avais demandé si la compassion s'étend aux soleils."),
        say(HERO, "Et la réponse ?"),
        say(ZHI, "Vous l'avez donnée en visant : neuf pour sauver tous les jours, un pour garder le jour. Maître Zhen aurait souri.")
    ] },
    // Relation qui évolue : la quatrième queue de Xiao Gui est venue au bord de la mer (pourparlers du soleil 8), ou non.
    { id: 'gui_queues_quatre', companion: 'xiao_gui', screen: 'fusang', whenDone: ['sun_9', 'parley_sun8'], scenes: [
        say(GUI, "Archer, regarde ! J'ai toujours ma quatrième queue ! Elle est petite, mais elle remue toute seule."),
        say(HERO, "Elle te va bien."),
        say(GUI, "J'ai compris le secret : on ne vole pas les gens. On prend ce qu'ils donnent. Hi hi… Je vole des sourires.")
    ] },
    { id: 'gui_queues_trois', companion: 'xiao_gui', screen: 'fusang', whenDone: 'sun_9', unless: 'parley_sun8', scenes: [
        say(GUI, "Trois queues, toujours. Mais tu sais quoi, archer ? Je m'en moque un peu, depuis les rizières."),
        say(HERO, "Tu as changé d'avis ?"),
        say(GUI, "J'ai changé de bande. La dame renarde du village disait qu'on gagne ses queues en rendant service. Je me suis rendu service : je t'ai suivi.")
    ] },

    // ── Région 10 : Pic de la Lune (après la victoire sur Fengmeng, avant l'autel) ───────────────
    { id: 'gui_lune_fin', companion: 'xiao_gui', screen: 'lune', whenDone: 'fengmeng_3b', scenes: [
        say(GUI,
            "Ton disciple redescend à pied. Je lui laisserai un gâteau sur le sentier, un vrai, que je n'aurai pas volé.",
            "Il a manqué d'un renard pour lui dire qu'on peut changer de bande.")
    ] },
    { id: 'zhi_lune_fin', companion: 'zhi', screen: 'lune', whenDone: 'fengmeng_3b', scenes: [
        say(ZHI, "Je sonnerai la cloche cette nuit, seigneur, à l'heure qui n'existe pas encore. Elle montera jusqu'ici, je crois.")
    ] },
    { id: 'dawa_lune_fin', companion: 'dawa', screen: 'lune', whenDone: 'fengmeng_3b', scenes: [
        say(DAWA,
            "J'ai vu des hommes courir après un mirage jusqu'à tomber. Votre disciple courait après un élixir. C'est la même soif, seigneur.",
            "Au désert, on laisse l'homme seul avec sa lune. Nous vous attendrons en bas. Le chemin du retour est balisé.")
    ] }
];
