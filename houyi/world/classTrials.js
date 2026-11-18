// Compagnons de combat (allies.js) : les six maîtres de classe se recrutent au fil de l'histoire : un dans la 1re région (Rizières), deux dans la 2e (Volcan),
// puis un par région (Gobi, Fleuve, Bambous).
// Chaque maître (PNJ `trainer_<classe>` du village, voir world/maps et world/text) impose un entraînement contre un ennemi d'épreuve de la zone
// sauvage (`train_<classe>`, champ `training` : combat mené uniquement dans sa classe) ; rendre la quête le fait rejoindre l'équipe de Hou Yi.
// Obligatoire : le soleil de la région (et ses mirages) n'apparaît qu'une fois la quête rendue.
// Absent du monde « historique » de story.js (buildLegacyWorld) : les maîtres et leurs ennemis n'existent que dans le Grand Monde.

export const CLASS_TRIAL_QUESTS = [
    {
        id: 'q_class_barbarian',
        title: 'La voie du Guerrier',
        chapter: '✦ Compagnon — Gorges du Volcan',
        giver: 'trainer_barbarian', turnIn: 'trainer_barbarian', requires: ['q_sun_1'],
        objectives: [{ type: 'kill', target: 'train_barbarian', text: "Vaincre sanglier d'entraînement en Guerrier (coulées et passerelles, à l'ouest du pont) : la classe est imposée" }],
        offer: ["Un archer ? On te dit malin, Hou Yi, tu as visé un soleil sans ciller. Moi, j'ai volé les pêches d'immortalité et mis le Palais Céleste sens dessus dessous. On devrait s'entendre.", "Je suis Sun Wukong, Roi Singe, et ici, sur ces flancs de feu, je m'ennuie. La voie du Guerrier, c'est la rage qui monte quand on est touché, le bâton qui frappe ce que la flèche n'atteint pas.", "Un sanglier de scories rôde dans les coulées, à l'ouest du pont : je l'ai un peu énervé pour toi. Combats-le en Guerrier, rien qu'en Guerrier. Pas de flèche, pas de talisman. Reviens quand il est à terre."],
        hint: ["Le sanglier d'entraînement rôde dans les coulées, à l'ouest du pont rompu. Ce combat se mène uniquement en Guerrier : la classe est imposée."],
        complete: ["Tu as encaissé, tu as frappé, tu as ri en saignant : tu tiens la route. Même moi, j'aurais pas fait mieux, et j'ai fait beaucoup.", "Je te suis, archer. Appelle-moi dans ton équipe quand tu veux : mon bâton parlera pour toi et mes côtes encaisseront à ta place. Si je tombe, je me relève au prochain combat."],
        reward: { gold: 60, xp: 80, fragment: "Croc du sanglier", class: 'barbarian' }
    },
    {
        id: 'q_class_templar',
        title: 'La voie du Commandant',
        chapter: '✦ Compagnon — Désert de Gobi',
        giver: 'trainer_templar', turnIn: 'trainer_templar', requires: ['q_sun_6'],
        objectives: [{ type: 'kill', target: 'train_templar', text: "Vaincre brigand de mêlée en Commandant (la piste ouest, avant les dunes) : la classe est imposée" }],
        offer: ["Archer, tu voyages seul dans un désert où les caravanes meurent faute de rempart. Je suis Nezha, et j'ai commandé les armées du ciel avant d'avoir l'âge de me raser.", "La voie du Commandant : la lance, le mur, l'ordre qui tient quand tout vacille. On ne la comprend qu'en l'éprouvant.", "Un brigand de mêlée traîne sur la piste ouest. Affronte-le en Commandant, uniquement en Commandant. Reviens me rendre compte."],
        hint: ["Le brigand d'entraînement attend sur la piste ouest du désert. Ce combat se mène uniquement en Commandant : la classe est imposée."],
        complete: ["Le mur a tenu : tu as appris à attendre le moment juste. Un Commandant ne gagne pas en frappant le premier, mais en étant encore debout.", "Mes roues de feu sont à toi. Je me joins à ton groupe, archer. Mets-moi devant, et le sable cruel passera sur nous deux."],
        reward: { gold: 60, xp: 80, fragment: "Insigne de la garde", class: 'templar' }
    },
    {
        id: 'q_class_sorcerer',
        title: 'La voie du Mage',
        chapter: '✦ Compagnon — Lit du Fleuve Jaune',
        giver: 'trainer_sorcerer', turnIn: 'trainer_sorcerer', requires: ['q_sun_4'],
        objectives: [{ type: 'kill', target: 'train_sorcerer', text: "Vaincre esprit-cible du gué en Mage (la berge ouest, avant le gué) : la classe est imposée" }],
        offer: ["Le fleuve garde la mémoire de tout ce qu'il emporte, archer. Je suis Longwang, roi des dragons des eaux, et ce lit à sec est le plus triste de mes royaumes.", "Les talismans, les éléments, le qì sous toutes ses couleurs : c'est la voie du Mage antique. On ne l'apprend pas dans les livres, mais en tendant la main vers l'eau et en la laissant te répondre.", "Un esprit-cible s'est installé sur la berge ouest. Combats-le en Mage, uniquement en Mage. Reviens quand le fleuve se sera tu."],
        hint: ["L'esprit-cible attend sur la berge ouest, avant le gué. Ce combat se mène uniquement en Mage : la classe est imposée. C'est la seule voie qui permet de lancer l'ultime."],
        complete: ["Tu as parlé au feu, à l'eau, au vent, et ils t'ont répondu. Un Mage antique n'ordonne pas au qì : il l'invite.", "Le gué peut attendre : je viens avec toi. Les nuages m'obéissent, la pluie aussi. Et retiens ceci : les grands sortilèges, les ultimes, ne répondent qu'à un Mage, au cœur d'une Xiūxiān."],
        reward: { gold: 60, xp: 80, fragment: "Talisman du gué", class: 'sorcerer' }
    },
    {
        id: 'q_class_monk',
        title: 'La voie du Moine',
        chapter: '✦ Compagnon — Rizières Desséchées',
        giver: 'trainer_monk', turnIn: 'trainer_monk', requires: [], startWhen: { quest: 'q_sun_1' },
        objectives: [{ type: 'kill', target: 'train_monk', text: "Vaincre l'esprit des diguettes d'épreuve en Moine (les digues du sud-ouest, près du chemin) : la classe est imposée" }],
        offer: ["Paix à vous, archer. Je suis Fuxi. J'ai tracé les huit trigrammes et appris aux hommes à nouer le filet ; je guette ces rizières desséchées depuis que le soleil a brûlé le monde.", "La voie du Moine ne frappe pas : elle se tient, elle guérit, elle laisse l'adversaire se fatiguer de lui-même. Elle sert surtout à ceux qui ont trop de colère.", "Un vieil esprit des diguettes, sur les digues du sud-ouest, a gardé sa rancune. Affrontez-le en Moine, rien qu'en Moine. Revenez me dire ce que le silence vous a appris."],
        hint: ["L'esprit des diguettes d'épreuve garde les digues du sud-ouest, près du chemin. Ce combat se mène uniquement en Moine : la classe est imposée."],
        complete: ["Vous avez respiré, et les champs ont respiré avec vous. Un Moine n'est jamais le plus fort : il est celui qui reste.", "Je marcherai à vos côtés, seigneur : on n'apprend pas la patience en restant assis. Appelez-moi quand il faudra durer ; je partagerai votre qì et je tiendrai bon pour deux."],
        reward: { gold: 60, xp: 80, fragment: "Cendre de sutra", class: 'monk' }
    },
    {
        id: 'q_class_alchemist',
        title: 'La voie du Alchimiste',
        chapter: '✦ Compagnon — Gorges du Volcan',
        giver: 'trainer_alchemist', turnIn: 'trainer_alchemist', requires: ['q_sun_1', 'q_class_barbarian'],
        objectives: [{ type: 'kill', target: 'train_alchemist', text: "Vaincre le docteur-démon d'essai en Alchimiste (le sentier ouest des gorges) : la classe est imposée" }],
        offer: ["Un archer ! Parfait : j'ai besoin d'un cobaye. Pardon, d'un disciple. Je suis Shennong, j'ai goûté toutes les herbes du monde, et il en reste quelques-unes ici, dans les gorges.", "La voie de l'Alchimiste, c'est le contrôle : un peu de venin ici, un peu d'élixir là, et l'adversaire s'affaiblit pendant que toi, tu tiens.", "J'ai capturé un docteur-démon sur le sentier ouest des gorges : il a tout appris, sauf à se défendre. Combats-le en Alchimiste, uniquement en Alchimiste. Reviens avec les résultats."],
        hint: ["Le docteur-démon d'essai attend sur le sentier ouest des gorges. Ce combat se mène uniquement en Alchimiste : la classe est imposée."],
        complete: ["Excellente expérience ! Ton venin est propre, tes pilules aussi : tu as le sens du dosage. Mon ventre transparent n'aurait pas mieux dit.", "Ma hotte d'herbes se transporte, figure-toi : je viens avec toi ! Appelle-moi quand l'adversaire doit s'user. Mais les fleuves délavent mes poudres : si je tombe, ne me laisse pas dans l'eau."],
        reward: { gold: 60, xp: 80, fragment: "Fiole d'essai", class: 'alchemist' }
    },
    {
        id: 'q_class_shaman',
        title: 'La voie du Chamane',
        chapter: '✦ Compagnon — Forêt de Bambous Calcinée',
        giver: 'trainer_shaman', turnIn: 'trainer_shaman', requires: ['q_sun_2'],
        objectives: [{ type: 'kill', target: 'train_shaman', text: "Vaincre l'esprit-renard d'épreuve en Chamane (la clairière sud-ouest) : la classe est imposée" }],
        offer: ["Approche, petit archer. Je suis Jingwei, la fille qui s'est noyée et qui comble la mer avec des cailloux. Les esprits m'ont dit que tu viendrais, et que tu ne savais pas les écouter.", "La voie du Chamane est celle des sceaux, du froid qui engourdit, des marques des ancêtres. Elle ne tue pas : elle retient. Elle demande de la patience, tu n'en as pas, ça tombe bien.", "Un esprit-renard s'est glissé dans mes bambous, dans la clairière sud-ouest. Affronte-le en Chamane, uniquement en Chamane. Les esprits te regardent : ne les déçois pas."],
        hint: ["L'esprit-renard d'épreuve est dans la clairière sud-ouest. Ce combat se mène uniquement en Chamane : la classe est imposée."],
        complete: ["Les esprits murmurent ton nom, et ils rient : bon signe. Tu les as écoutés, et ils t'ont suivi.", "Alors moi aussi, je te suis, petit archer. Mes ailes feront ce qu'elles peuvent, et mes esprits feront le reste : je saurai sceller, geler, retenir. Mais l'Arbre céleste fait taire les esprits : là-haut, il faudra une autre voie."],
        reward: { gold: 60, xp: 80, fragment: "Plume de renard", class: 'shaman' }
    }
];

// Région → [soleil, quête du maître] : le soleil n'apparaît qu'une fois la quête rendue.
export const CLASS_TRIAL_GATES = {
    rizieres: ['sun_1', 'q_class_monk'],
    volcan: ['sun_6', 'q_class_alchemist'],
    gobi: ['sun_4', 'q_class_templar'],
    fleuve: ['sun_2', 'q_class_sorcerer'],
    bambous: ['sun_3', 'q_class_shaman'],
};

// Région de chaque quête de compagnon (deux dans le Volcan) : elle se place juste avant la quête principale du soleil de sa région.
const TRIAL_REGION = { q_class_monk: 'rizieres', q_class_barbarian: 'volcan', q_class_alchemist: 'volcan', q_class_templar: 'gobi', q_class_sorcerer: 'fleuve', q_class_shaman: 'bambous' };

export function applyClassTrials(screens, quests) {
    // Chaque quête de maître se place juste avant la quête principale du soleil de sa région (ordre du journal et de l'histoire).
    CLASS_TRIAL_QUESTS.forEach(quest => {
        const region = TRIAL_REGION[quest.id];
        const before = quests.findIndex(q => q.id === `q_${CLASS_TRIAL_GATES[region][0]}`);
        quests.splice(before >= 0 ? before : quests.length, 0, { ...quest });
    });
    Object.entries(CLASS_TRIAL_GATES).forEach(([region, [sun, quest]]) => {
        (screens[region]?.enemies || []).forEach(e => { if (e.id === sun || e.templateId === sun) e.showWhen = quest; });
    });
}
