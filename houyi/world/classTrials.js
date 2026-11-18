// Compagnons de combat (allies.js) : les six maîtres de classe se recrutent au fil de l'histoire, un par région du Volcan aux Fauves.
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
        offer: ["Hou Yi ? On me parle de toi dans les galeries. Un archer qui tient le grand arc à distance, c'est bien. Mais ici, le basalte ne laisse pas la place de tendre la corde : il faut savoir encaisser, et rendre le coup.", "J'enseigne la voie du Guerrier : la rage qui monte quand on est touché, la hache qui tranche ce que la flèche n'atteint pas. Je ne l'enseigne pas avec des mots.", "Va dans les coulées : un sanglier de scories m'attend, je l'ai dressé pour l'occasion. Tu le combattras en Guerrier, et uniquement en Guerrier : pas de flèche de Chasseur, pas de talisman. Reviens me voir quand il sera à terre."],
        hint: ["Le sanglier d'entraînement rôde dans les coulées, à l'ouest du pont rompu. Ce combat se mène uniquement en Guerrier : la classe est imposée."],
        complete: ["Tu as encaissé, tu as frappé, tu as ri en saignant : tu tiens la route. Le basalte m'a tout appris, mais il ne marche pas. Moi, si.", "Je te suis, archer. Appelle-moi dans ton équipe quand tu veux : mes poings parleront pour toi et mes côtes encaisseront à ta place. Si je tombe, je me relève au prochain combat."],
        reward: { gold: 60, xp: 80, fragment: "Croc du sanglier", class: 'barbarian' }
    },
    {
        id: 'q_class_templar',
        title: 'La voie du Commandant',
        chapter: '✦ Compagnon — Désert de Gobi',
        giver: 'trainer_templar', turnIn: 'trainer_templar', requires: ['q_sun_6'],
        objectives: [{ type: 'kill', target: 'train_templar', text: "Vaincre brigand de mêlée en Commandant (la piste ouest, avant les dunes) : la classe est imposée" }],
        offer: ["Archer, tu voyages seul dans un désert où les caravanes meurent faute de rempart. Je commande la garde de ce village depuis vingt ans, et je n'ai perdu qu'un homme : celui qui a quitté la ligne.", "Je t'apprends la voie du Commandant : le bouclier, le mur, l'ordre qui tient quand tout vacille. Tu ne la comprendras qu'en l'éprouvant.", "Un brigand de mêlée traîne sur la piste ouest, payé par mes soins pour jouer son rôle. Affronte-le en Commandant, uniquement en Commandant. Reviens me rendre compte."],
        hint: ["Le brigand d'entraînement attend sur la piste ouest du désert. Ce combat se mène uniquement en Commandant : la classe est imposée."],
        complete: ["Le mur a tenu : tu as appris à attendre le moment juste. Un Commandant ne gagne pas en frappant le premier, mais en étant encore debout.", "Ma garde est tranquille ; mon bouclier est à toi. Je me joins à ton groupe, archer. Mets-moi devant, et le sable cruel passera sur nous deux."],
        reward: { gold: 60, xp: 80, fragment: "Insigne de la garde", class: 'templar' }
    },
    {
        id: 'q_class_sorcerer',
        title: 'La voie du Mage',
        chapter: '✦ Compagnon — Lit du Fleuve Jaune',
        giver: 'trainer_sorcerer', turnIn: 'trainer_sorcerer', requires: ['q_sun_4'],
        objectives: [{ type: 'kill', target: 'train_sorcerer', text: "Vaincre esprit-cible du gué en Mage (la berge ouest, avant le gué) : la classe est imposée" }],
        offer: ["Le fleuve garde la mémoire de tout ce qu'il emporte, archer. Moi, j'ai appris à lui parler. Les talismans, les éléments, le qì sous toutes ses couleurs : c'est la voie du Mage antique.", "On ne l'apprend pas dans les livres, mais en tendant la main vers une flamme et en la laissant te répondre.", "Un esprit-cible s'est installé sur la berge ouest. Combats-le en Mage, uniquement en Mage : c'est ainsi qu'on m'a appris à moi. Reviens quand le fleuve se sera tu."],
        hint: ["L'esprit-cible attend sur la berge ouest, avant le gué. Ce combat se mène uniquement en Mage : la classe est imposée. C'est la seule voie qui permet de lancer l'ultime."],
        complete: ["Tu as parlé au feu, à l'eau, au vent, et ils t'ont répondu. Un Mage antique n'ordonne pas au qì : il l'invite.", "Le gué n'a plus besoin de moi : je viens avec toi. Garde-moi à l'abri, mes os sont fragiles, mais mes talismans te serviront. Et retiens ceci : les grands sortilèges, les ultimes, ne répondent qu'à un Mage, au cœur d'une Xiūxiān."],
        reward: { gold: 60, xp: 80, fragment: "Talisman du gué", class: 'sorcerer' }
    },
    {
        id: 'q_class_monk',
        title: 'La voie du Moine',
        chapter: '✦ Compagnon — Forêt de Bambous Calcinée',
        giver: 'trainer_monk', turnIn: 'trainer_monk', requires: ['q_sun_2'],
        objectives: [{ type: 'kill', target: 'train_monk', text: "Vaincre vieux bambou d'épreuve en Moine (la clairière sud-ouest) : la classe est imposée" }],
        offer: ["Paix à vous. Je prie parmi des bambous noircis depuis que le soleil a brûlé le monastère. Ce qu'il reste, c'est la respiration : la mienne, la vôtre, celle de la forêt.", "La voie du Moine ne frappe pas : elle se tient, elle guérit, elle laisse l'adversaire se fatiguer de lui-même. Elle sert surtout à ceux qui ont trop de colère.", "Un vieux bambou noir, dans la clairière sud-ouest, a gardé sa rancune. Affrontez-le en Moine, rien qu'en Moine. Revenez me dire ce que le silence vous a appris."],
        hint: ["Le vieux bambou d'épreuve se trouve dans la clairière sud-ouest. Ce combat se mène uniquement en Moine : la classe est imposée."],
        complete: ["Vous avez respiré, et la forêt a respiré avec vous. Un Moine n'est jamais le plus fort : il est celui qui reste.", "Je marcherai à vos côtés, seigneur : on n'apprend pas la patience en restant assis. Appelez-moi quand il faudra durer ; je partagerai votre qì et je tiendrai bon pour deux."],
        reward: { gold: 60, xp: 80, fragment: "Cendre de sutra", class: 'monk' }
    },
    {
        id: 'q_class_alchemist',
        title: 'La voie du Alchimiste',
        chapter: '✦ Compagnon — Monts du Tonnerre',
        giver: 'trainer_alchemist', turnIn: 'trainer_alchemist', requires: ['q_sun_3'],
        objectives: [{ type: 'kill', target: 'train_alchemist', text: "Vaincre docteur-démon d'essai en Alchimiste (le sentier ouest, sous la crête) : la classe est imposée" }],
        offer: ["Un archer ! Parfait : j'ai besoin d'un cobaye. Pardon, d'un disciple. Je distille ici la foudre en poudre, le poison en baume et la vigueur en pilule. Les orages sont généreux en ingrédients.", "La voie de l'Alchimiste, c'est le contrôle : un peu de venin ici, un peu d'élixir là, et l'adversaire s'affaiblit pendant que toi, tu tiens.", "J'ai capturé un docteur-démon sur le sentier ouest, sous la crête : il a tout appris, sauf à se défendre. Combats-le en Alchimiste, uniquement en Alchimiste. Reviens avec les résultats."],
        hint: ["Le docteur-démon d'essai attend sur le sentier ouest, sous la crête. Ce combat se mène uniquement en Alchimiste : la classe est imposée."],
        complete: ["Excellente expérience ! Ton venin est propre, tes pilules aussi : tu as le sens du dosage.", "Mon fourneau se transporte, figure-toi : je viens avec toi ! Appelle-moi quand l'adversaire doit s'user. Mais les fleuves délavent mes poudres : si je tombe, ne me laisse pas dans l'eau."],
        reward: { gold: 60, xp: 80, fragment: "Fiole d'essai", class: 'alchemist' }
    },
    {
        id: 'q_class_shaman',
        title: 'La voie du Chamane',
        chapter: '✦ Compagnon — Plaine des Fauves',
        giver: 'trainer_shaman', turnIn: 'trainer_shaman', requires: ['q_sun_5'],
        objectives: [{ type: 'kill', target: 'train_shaman', text: "Vaincre esprit-renard d'épreuve en Chamane (les herbes hautes de l'ouest) : la classe est imposée" }],
        offer: ["Approche, petit archer. Je suis vieille, les esprits parlent plus fort quand on est vieux. Ils m'ont dit que tu viendrais, et que tu ne savais pas les écouter.", "La voie du Chamane est celle des sceaux, du froid qui engourdit, des marques des ancêtres. Elle ne tue pas : elle retient. Elle demande de la patience, tu n'en as pas, ça tombe bien.", "Un esprit-renard est entré dans mes herbes de l'ouest. Affronte-le en Chamane, uniquement en Chamane. Les esprits te regardent : ne les déçois pas."],
        hint: ["L'esprit-renard d'épreuve est dans les herbes hautes de l'ouest. Ce combat se mène uniquement en Chamane : la classe est imposée."],
        complete: ["Les esprits murmurent ton nom, et ils rient : bon signe. Tu les as écoutés, et ils t'ont suivi.", "Alors moi aussi, je te suis, petit archer. Mes vieilles jambes feront ce qu'elles peuvent, et mes esprits feront le reste : je saurai sceller, geler, retenir. Mais l'Arbre céleste fait taire les esprits : là-haut, il faudra une autre voie."],
        reward: { gold: 60, xp: 80, fragment: "Plume de renard", class: 'shaman' }
    }
];

// Région → [soleil, quête du maître] : le soleil n'apparaît qu'une fois la quête rendue.
export const CLASS_TRIAL_GATES = {
    volcan: ['sun_6', 'q_class_barbarian'],
    gobi: ['sun_4', 'q_class_templar'],
    fleuve: ['sun_2', 'q_class_sorcerer'],
    bambous: ['sun_3', 'q_class_monk'],
    tonnerre: ['sun_5', 'q_class_alchemist'],
    fauves: ['sun_7', 'q_class_shaman'],
};

export function applyClassTrials(screens, quests) {
    // Chaque quête de maître se place juste avant la quête principale du soleil de sa région (ordre du journal et de l'histoire).
    CLASS_TRIAL_QUESTS.forEach(quest => {
        const region = Object.keys(CLASS_TRIAL_GATES).find(r => CLASS_TRIAL_GATES[r][1] === quest.id);
        const before = quests.findIndex(q => q.id === `q_${CLASS_TRIAL_GATES[region][0]}`);
        quests.splice(before >= 0 ? before : quests.length, 0, { ...quest });
    });
    Object.entries(CLASS_TRIAL_GATES).forEach(([region, [sun, quest]]) => {
        (screens[region]?.enemies || []).forEach(e => { if (e.id === sun || e.templateId === sun) e.showWhen = quest; });
    });
}
