// Quêtes des colliers de biome. Logique pure, sans DOM.
//
// Chaque biome hostile du combat (Volcan, Bambous, Neige d'orage, Mer : voir terrain.js) a un collier de protection (stuff.js) que
// le héros gagne en finissant une quête en deux temps : un PNJ du village lui demande une relique cachée dans la zone sauvage,
// puis d'abattre le mini-boss qui s'en est emparé. À la remise de la quête, le collier est rangé dans l'onglet Stuff.

import { occupancy, placeInLand } from './junctions.js';

const COLLARS = [
    { region: 'volcan', collar: 'collier_obsidienne', questId: 'sq_collar_volcan', level: 4,
      giver: { id: 'forger_hu', name: 'Hu le Braise-Sage', title: 'Vieux forgeron des gorges',
          idle: ['Trois fois, la lave m\'a brûlé les mains. La quatrième, j\'ai compris qu\'elle me parlait. Elle dit : « Rends-moi mon cœur. »'] },
      chest: { id: 'collar_volcan_relic', label: 'Cœur d\'obsidienne', openText: 'Au fond d\'une crevasse tiède, un cœur d\'obsidienne noire, froid comme une pierre de rivière. Il n\'a jamais connu la chaleur.' },
      enemy: { id: 'collar_volcan_boss', templateId: 'pixiu', name: 'Béhémoth des coulées', offset: 3 },
      title: 'Le cœur d\'obsidienne', fragment: 'Collier d\'obsidienne froide',
      offer: [
          'Seigneur archer, vous qui marchez dans les cendres : écoutez un vieux forgeron. La lave brûle tout ce qu\'elle touche, sauf une pierre : l\'obsidienne froide, celle que la montagne garde pour elle.',
          'J\'ai caché un cœur d\'obsidienne dans une crevasse de la zone sauvage, avant que les soleils ne rendent fou ce pays. Un béhémoth de magma s\'en est fait une tanière. Rapportez-moi la pierre, puis chassez la bête, et je vous en taillerai un collier.'],
      hint: ['Le cœur d\'obsidienne est au sud-est de la zone sauvage des gorges. Le béhémoth de magma rôde non loin : il charge, soyez prêt.'],
      complete: ['La pierre est froide comme au premier jour… et la bête ne souffle plus. Tenez, un collier d\'obsidienne.', 'Tant que vous le porterez, les cases brûlantes ne vous feront plus aucun mal. La lave a de la mémoire : elle saura que vous êtes de la famille.'] },
    { region: 'bambous', collar: 'collier_jade_vert', questId: 'sq_collar_bambous', level: 17,
      giver: { id: 'jade_carver_qing', name: 'Qing le Tailleur', title: 'Sculpteur de jade vert',
          idle: ['Le bambou pousse d\'un mètre par nuit dans cette forêt. Le jade, lui, a mis mille ans. Je préfère encore le jade.'] },
      chest: { id: 'collar_bambous_relic', label: 'Éclat de jade vert', openText: 'Dans un fourré de bambous, un éclat de jade vert, vif comme une pousse de printemps. Les bambous s\'écartent doucement autour.' },
      enemy: { id: 'collar_bambous_boss', templateId: 'shu_jing', name: 'Gardien-bambou ancestral', offset: 3 },
      title: 'Le jade des bambous', fragment: 'Collier de jade vert',
      offer: [
          'Vous avez remarqué comme les bambous se referment sur les voyageurs ? Ils obéissent à un éclat de jade vert que j\'ai enterré au cœur de la forêt, il y a longtemps, pour qu\'ils restent dociles.',
          'Un gardien-bambou s\'est attaché à l\'éclat et refuse de s\'en séparer. Retrouvez l\'éclat, puis réduisez le gardien au silence : je vous sculpterai un collier qui apaise la forêt.'],
      hint: ['L\'éclat de jade dort au sud-est de la zone sauvage des Bambous. Le gardien-bambou ne s\'en éloigne guère.'],
      complete: ['L\'éclat est tiède… la forêt respire mieux. Voici votre collier de jade vert.', 'Portez-le, et les bambous cesseront d\'envahir votre chemin : ils vous prendront pour l\'un des leurs.'] },
    { region: 'tonnerre', collar: 'collier_braise_d_orage', questId: 'sq_collar_tonnerre', level: 22,
      giver: { id: 'storm_sage_lei', name: 'Lei l\'Attiseur', title: 'Sage des crêtes foudroyées',
          idle: ['Le givre d\'orage est le pire : il tombe sans prévenir et gèle ce qu\'il touche. Seule une braise d\'orage lui tient tête.'] },
      chest: { id: 'collar_tonnerre_relic', label: 'Braise d\'orage', openText: 'Dans une faille battue par le vent, une braise captive d\'un cristal clair : elle brûle sans consumer, et le givre fond à son approche.' },
      enemy: { id: 'collar_tonnerre_boss', templateId: 'lei_gong', name: 'Chevalier de l\'orage figé', offset: 3 },
      title: 'La braise d\'orage', fragment: 'Collier de braise d\'orage',
      offer: [
          'Archer, avez-vous déjà vu une case geler sous votre pouce ? C\'est le givre d\'orage. Il n\'y a qu\'un remède : la braise d\'orage, que j\'ai cachée dans une faille de la zone sauvage.',
          'Un chevalier figé par la tempête la garde en croyant protéger son maître. Rapportez-moi la braise, puis mettez fin à sa veille : je la sertirai dans un collier.'],
      hint: ['La braise d\'orage est au sud-est des Crêtes Foudroyées. Le chevalier figé garde le secteur.'],
      complete: ['La braise est vivante… et le chevalier peut enfin se reposer. Voici votre collier.', 'Tant qu\'il pendra sur votre poitrine, le givre d\'orage ne gèlera plus une seule case. Allez, que la tempête vous reconnaisse.'] },
    { region: 'fusang', collar: 'collier_voile_d_ombre', questId: 'sq_collar_fusang', level: 37,
      giver: { id: 'shadow_weaver_mu', name: 'Mu la Tisseuse d\'ombre', title: 'Fileuse des racines dorées',
          idle: ['À Fusang, l\'arbre est si haut que son ombre tombe ailleurs. Je la file. Personne ne remarque jamais la fileuse : c\'est le métier.'] },
      chest: { id: 'collar_fusang_relic', label: 'Fil d\'ombre', openText: 'Entre deux racines dorées, une pelote de fil noir qui ne reflète rien. Votre ombre, elle, hésite un instant avant de vous suivre.' },
      enemy: { id: 'collar_fusang_boss', templateId: 'lei_gong', name: 'Veilleur de l\'ombre dorée', offset: 3 },
      title: 'Le fil d\'ombre', fragment: 'Collier du voile d\'ombre',
      offer: [
          'Seigneur archer, vous qui marchez devant tous les regards : saviez-vous qu\'on peut passer sans être vu ? Il suffit d\'un fil d\'ombre, filé à l\'ombre de l\'arbre de Fusang. J\'en ai caché une pelote dans les racines, au sud-est.',
          'Un veilleur de l\'ombre dorée la garde, par habitude plus que par méchanceté. Rapportez-moi le fil, puis délivrez le veilleur : je tresserai un collier que les yeux ne verront pas.'],
      hint: ['Le fil d\'ombre est au sud-est de la zone sauvage de Fusang. Le veilleur rôde non loin du fil.'],
      complete: ['Le fil est intact… et le veilleur peut enfin fermer les yeux. Voici votre collier du voile d\'ombre.', 'Tant que vous le porterez, aucun ennemi ne vous remarquera. Sauf ceux qui ne regardent jamais ailleurs : les maîtres des soleils.'] },
    { region: 'mer', collar: 'collier_perle_des_marees', questId: 'sq_collar_mer', level: 32,
      giver: { id: 'pearl_diver_meihua', name: 'Mei-Hua', title: 'Plongeuse de perles',
          idle: ['Les courants changent de sens sans prévenir, ici. Mon grand-père disait que seule une perle noire les calme.'] },
      chest: { id: 'collar_mer_relic', label: 'Perle noire', openText: 'Au creux d\'un rocher, une perle noire de la taille d\'un œuf de caille. Les vagues alentour se font plus lentes.' },
      enemy: { id: 'collar_mer_boss', templateId: 'jiaolong', name: 'Serpent-roi des marées', offset: 3 },
      title: 'La perle des marées', fragment: 'Collier de perle des marées',
      offer: [
          'Vous avez vu le sol glisser sous vos pieds quand la mer se met à dériver ? Ce n\'est pas naturel. Une perle noire calmait les courants, avant qu\'un serpent-roi ne l\'avale par jeu.',
          'Retrouvez la perle de remplacement que j\'avais cachée dans un rocher, puis abattez le serpent : je monterai la perle sur un collier.'],
      hint: ['La perle noire est au sud-est de la zone sauvage de la côte. Le serpent-roi nage dans les parages : méfiez-vous de son venin.'],
      complete: ['La perle est là, et la mer respire. Voici votre collier de perle noire.', 'Les courants ne vous feront plus dériver : la mer vous doit un service, et la mer paie toujours.'] }
];

/**
 * Pose, pour chaque biome hostile, le PNJ du village, la relique et le mini-boss de la zone sauvage, et la quête du collier.
 * À appeler après l'agrandissement des cartes (les cases libres sont calculées sur les cartes finales).
 */
export function applyCollarQuests(screens, quests) {
    COLLARS.forEach(c => {
        const village = screens[`${c.region}_village`];
        const wild = screens[`${c.region}_wild`];
        if (!village || !wild) return;
        const npcPos = placeInLand(village, occupancy(village, screens), c.giver.id);
        if (!npcPos) throw new Error(`collier ${c.collar} : pas de place pour ${c.giver.id}`);
        village.npcs.push({
            id: c.giver.id, name: c.giver.name, title: c.giver.title, idle: c.giver.idle, x: npcPos.x, y: npcPos.y,
            talk: [{ whenDone: c.questId, lines: [`« Ce collier vous va à ravir. Prenez soin de la montagne, et elle prendra soin de vous. »`] }]
        });
        const chestPos = placeInLand(wild, occupancy(wild, screens), c.chest.id);
        if (!chestPos) throw new Error(`collier ${c.collar} : pas de place pour la relique`);
        wild.chests.push({ id: c.chest.id, label: c.chest.label, openText: c.chest.openText, gold: 20 * c.level, x: chestPos.x, y: chestPos.y });
        const enemyPos = placeInLand(wild, occupancy(wild, screens), c.enemy.id);
        if (!enemyPos) throw new Error(`collier ${c.collar} : pas de place pour le mini-boss`);
        wild.enemies.push({
            id: c.enemy.id, templateId: c.enemy.templateId, name: c.enemy.name, kind: 'sentinel', offset: c.enemy.offset,
            permanent: true, aggro: 2, x: enemyPos.x, y: enemyPos.y
        });
        quests.push({
            id: c.questId, title: c.title, chapter: `✦ Quête secondaire — ${village.name}`,
            giver: c.giver.id, turnIn: c.giver.id, requires: [], side: true,
            objectives: [
                { type: 'chest', target: c.chest.id, text: `Retrouver la relique cachée (${wild.name}, dans les terres au sud-est)` },
                { type: 'kill', target: c.enemy.id, text: `Abattre le mini-boss : ${c.enemy.name} (${wild.name})` }
            ],
            offer: c.offer, hint: c.hint, complete: c.complete,
            reward: { gold: Math.min(200, 40 + 4 * c.level), fragment: c.fragment, stuff: c.collar, xp: 60 }
        });
    });
    return screens;
}
