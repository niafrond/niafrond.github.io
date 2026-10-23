// Bestiaire du carnet : force, faiblesse et notice mythologique de chaque gabarit d'ennemi (enemies.catalog.json).
// Module pur (aucun DOM) : le catalogue est passé en argument, l'interface est dans explorationView.js (onglet « Bestiaire »).
//
// Force    = couleur de mana la mieux encaissée (résistance la plus haute du profil, sinon couleur dominante des sorts)
//            et trait de combat tiré des multiplicateurs (robuste, frappe fort, carapace) et de la classe de combat.
// Faiblesse = table des éléments (elements.js `weaknessOf`, même règle qu'en combat).
// Créatures connues : celles croisées en combat ou observées sur la carte (`session.data.bestiary`, exploration.js).

import { MANA_COLORS, weaknessOf, elementName } from './elements.js';

// Notices mythologiques (Shanhaijing, Huainanzi, Zhuangzi, Liezi, contes populaires…), une par gabarit. Chaque notice distingue
// ce qui est attesté (« selon le Shanhaijing… »), ce qui relève du folklore tardif et ce qui est une invention de cette légende
// (« dans ce monde… », « ici… ») ; la provenance globale est dans BESTIARY_SOURCE.
export const BESTIARY_LORE = {
    canglong: "Canglong (蒼龍) est l'un des noms du Dragon azur, puissance de l'Est et du printemps. Ce Canglong-ci en est une incarnation corrompue par le froid, figée depuis la venue des dix soleils : une invention de cette légende.",
    chilong: "Le Chilong (螭龍) est une figure draconique fréquente dans les décors anciens, souvent dite jeune ou sans cornes, sa forme variant selon les époques. Celui-ci, invention de cette légende, s'est vautré dans la lave jusqu'à en garder la gueule incandescente.",
    jiangshi: "Le jiangshi, cadavre raidi qui se déplace par bonds et boit le souffle des vivants, appartient au folklore des derniers siècles impériaux. Les prêtres taoïstes le figent avec un talisman de papier jaune collé sur son front.",
    yinglong: "Selon le Shanhaijing, Yinglong, le Dragon ailé, tua Chiyou et Kuafu pour l'Empereur Jaune. D'autres récits ajoutent qu'il ne put remonter au ciel et que, depuis, on imite sa forme pour appeler la pluie lors des sécheresses.",
    chiyou: "Chiyou, au front de bronze et aux armes forgées, mena quatre-vingt-un frères contre l'Empereur Jaune à la bataille de Zhuolu. Il appela vent et brouillard, mais Nüba sécha l'orage et il fut vaincu.",
    suanni: "Dans les listes populaires des « neuf fils du Dragon », qui varient selon les sources, le Suanni est un lion paisible qui aime l'encens et la fumée. On le sculpte sur les brûle-parfums des temples.",
    gui_esprit: "Les gui sont les âmes des morts privées de descendants ou de rites funéraires. Selon des traditions religieuses plus tardives, liées à la fête des fantômes, ils errent parmi les vivants au septième mois en quête d'offrandes.",
    huli_jing: "Le huli jing est un renard qui, après une longue pratique, peut prendre forme humaine ; il séduit et vole le souffle vital. Il déteste qu'on aperçoive la queue qui dépasse de sa robe.",
    hundun: "Hundun est le Chaos primordial, une figure conceptuelle plus qu'un simple monstre. Selon Zhuangzi, Shu et Hu, voulant le remercier, lui percèrent sept orifices, un par jour, pour lui donner les sens ; le septième jour, il mourut.",
    assassin_masque: "Le Voile Noir est une création de cette légende, inspirée de Jing Ke, l'assassin historique qui cacha un poignard dans une carte roulée pour tuer le roi de Qin. Comme lui, ces lames frappent une seule fois, au plus près.",
    shu_jing: "Les vieux arbres, dit-on, finissent par s'éveiller en esprits (shu jing). Abattre un pin millénaire sans offrande fait saigner son tronc et attire la vengeance de son gardien.",
    lettre_sorcier: "Le lettré-sorcier a réussi les examens impériaux, puis lu les livres interdits. Son pinceau trace des talismans qui lient les esprits : les mots écrits, dit-on, font pleurer les démons.",
    pixiu: "Le Pixiu est une bête protectrice qui dévore l'or et l'argent sans jamais les rendre. Celui-ci a dévoré tant de braises qu'il en est devenu une fournaise, une invention de cette légende.",
    pretresse_lunaire: "Ces prêtresses sont une création de cette légende : elles servent Chang'e au Palais du Grand Froid sur la Lune. Elles gardent le souvenir de l'élixir pris à Hou Yi et se méfient de tout archer.",
    soldat_terre_cuite: "Le premier empereur Qin fit enterrer près de son mausolée une armée de terre cuite composée de milliers de guerriers. Leurs visages et leurs équipements présentent de nombreuses variations. Certains, dit-on ici, se réveillent encore sous la terre.",
    wen_shen: "Les Wen Shen sont les dieux des épidémies ; leur nombre et leur organisation varient selon les régions. Dans certains rites du Sud, on les éloigne en lançant à la mer des barques chargées d'offrandes.",
    lei_gong: "Lei Gong, le Duc du Tonnerre, est souvent représenté avec un bec d'oiseau, des ailes et des tambours. Il foudroie les coupables de crimes cachés, et la tradition populaire lui fait aussi punir ceux qui gaspillent le grain.",
    lingzhi_maudit: "Le lingzhi est le champignon d'immortalité que les Immortels cueillent sur les monts sacrés. Poussé sur un champ de bataille, il donne l'inverse : des spores qui volent la vie.",
    crapaud_boue: "Le crapaud est un animal de la Lune : un texte des Han dit que Chang'e y fut changée en crapaud après avoir avalé l'élixir. Dans ce monde, ses cousins des marais chantent encore sa honte chaque soir.",
    dame_des_neiges: "La Dame des Neiges est une création de cette légende, qui emprunte aux contes d'esprits des tempêtes répandus en Asie orientale. Elle apparaît aux voyageurs perdus et se venge de ceux qui trahissent son secret.",
    gui_guerrier: "Un mort privé de rites peut devenir un esprit dangereux. Les gui guerriers de ce monde sont des soldats tombés loin de chez eux, qui continuent, sabre rouillé à la main, la bataille qu'ils ont perdue.",
    garde_solaire: "Ces gardes sont une création de cette légende : ils servaient les dix soleils, fils de Xihe et de Dijun. Quand Hou Yi abattit neuf soleils, ils jurèrent de protéger le dernier.",
    jiaolong: "Le jiaolong est un dragon des eaux associé aux crues ; jiao et jiaolong désignent selon les textes des créatures apparentées. Le Shishuo xinyu raconte que Zhou Chu, le héros repenti, en tua un après trois jours de lutte dans le fleuve.",
    immortel_jade: "Les Immortels (xian) atteignent l'éternité par l'alchimie et la méditation. Celui-ci s'est fait jade pour durer toujours, et prédit l'avenir dans les reflets de sa peau.",
    shanxiao: "Le Shanxiao est un esprit des montagnes à une seule patte. Des textes anciens racontent qu'on faisait éclater des bambous dans le feu pour le chasser, une des origines avancées des pétards.",
    tigre_embrase: "Le tigre est le roi des animaux : le caractère « roi » (王) est inscrit sur son front. Celui-ci a survécu aux dix soleils, et sa fourrure en garde les braises.",
    sanglier_flammes: "Le sanglier est le dernier des douze animaux du zodiaque, arrivé en retard à la course de l'Empereur de Jade. Celui-ci charge comme s'il voulait rattraper son rang.",
    loup_braise: "L'étoile du Loup céleste (Sirius) annonçait les invasions, et des poèmes y font viser l'Arc céleste voisin. Les loups de braise de ce monde suivent la trace des incendies.",
    cao_jing: "Les esprits des herbes naissent dans les prés que personne ne fauche. Ils sont timides et ne mordent que ceux qui piétinent les jeunes pousses.",
    hua_jing: "Les fées des fleurs prennent l'apparence de jeunes filles parfumées. Les contes du Liaozhai racontent leurs amours avec des lettrés : elles meurent quand on coupe leur fleur.",
    huli_commun: "Dans le folklore, un renard gagne des pouvoirs de transformation en vieillissant, et certains textes donnent des âges précis pour chaque étape. Celui-ci n'a pas encore commencé.",
    shuihou: "Le singe des eaux ressemble à d'autres monstres aquatiques du folklore qui attirent les baigneurs pour les noyer. Celui-ci se cache dans les mares de la rizière.",
    shui_gui: "Un motif populaire veut que le noyé ne puisse se réincarner qu'en noyant quelqu'un à sa place. Il guette donc les berges, sous la surface, en attendant une cheville à saisir.",
    qing_she: "Petite Verte (Xiao Qing) est la sœur de cœur de Dame Serpent Blanc dans la Légende du Serpent Blanc. Les serpents de jade des rizières se disent de sa famille.",
    jingwei: "Nüwa (女娃), fille de l'Empereur Yan (à ne pas confondre avec la déesse Nüwa, 女娲), se noya dans la mer de l'Est et devint l'oiseau Jingwei. Depuis, elle porte des brindilles et des pierres pour tenter de combler la mer.",
    she_shen: "She Shen est le dieu du sol d'un village, honoré sur un tertre de terre. Les paysans lui offrent les prémices de la récolte ; il se fâche quand on les oublie.",
    zu_xian: "On honore les ancêtres avec de l'encens, des offrandes et du papier-monnaie. Dans ce monde, ceux qu'on a négligés reviennent réclamer leur dû.",
    du_she: "Les serpents à venin font partie des Cinq Venimeux, combattus au cinquième jour du cinquième mois avec du vin au réalgar. Celui-ci n'en a jamais bu.",
    xuan_she: "Le Shanhaijing parle d'un serpent noir qui avale des cerfs. On dit qu'il en est un, devenu si grand que son ombre suffit à refroidir les eaux de la rizière.",
    huo_shen: "Zhurong, dieu du feu, combattit Gonggong, dieu des eaux ; le perdant brisa le mont Buzhou. Les esprits de la flamme se réclament de lui et attisent les volcans en son nom.",
    huo_shou: "Les bêtes de cendre naissent dans les forêts que la sécheresse a fait brûler. Elles ne craignent que la pluie, et les dix soleils les ont rendues innombrables.",
    chi_niao: "Les oiseaux ardents sont parents des corbeaux du soleil. Ils volent au-dessus des cratères et laissent tomber des braises sur les champs.",
    bi_fang: "Bi Fang est un oiseau à une seule patte, au plumage bleu tacheté de rouge. Le Shanhaijing dit que là où il apparaît, un incendie éclate.",
    nuba: "Nüba (女魃), fille de l'Empereur Jaune, fit cesser la pluie de Feng Bo et Yu Shi pour que son père vainque Chiyou. Ne pouvant remonter au ciel, elle apporta la sécheresse partout où elle résidait.",
    zhuque: "L'Oiseau vermillon garde le Sud et l'été, parmi les quatre symboles du ciel. Ses ailes déploient la constellation du même nom.",
    zhulong_serpent: "Zhulong, le Dragon-torche, a un visage humain sur un corps de serpent rouge long de mille lieues. Quand il ouvre les yeux, il fait jour ; quand il les ferme, c'est la nuit.",
    dijiang: "Dijiang, sur le mont Tian, est un sac jaune-rouge comme le feu, à six pattes et quatre ailes, sans visage. Il connaît pourtant le chant et la danse.",
    yazi: "Yazi est le fils du Roi-Dragon qui aime tuer : il orne les poignées des sabres et des haches. Il ne se calme qu'après le combat.",
    mei: "Mei (魅) est un terme ancien pour des esprits trompeurs. Ceux de ce monde imitent la voix d'un proche pour égarer les voyageurs dans les dunes.",
    wangliang: "Les wangliang (魍魎) sont, dans les textes anciens, des êtres démoniaques des montagnes et des eaux, à l'aspect variable selon les sources. Ceux-ci hantent les lieux sauvages et désertés.",
    wangxiang: "Le wangxiang est, dans d'anciennes traditions démonologiques, un être des tombeaux qui dévore les morts. On raconte ici qu'il fuit les tigres et les cyprès plantés sur les tombes.",
    shi_jing: "Les pierres très anciennes s'éveillent parfois en esprits. Le Singe de pierre, Sun Wukong, naquit lui-même d'un rocher fécondé par le ciel et la terre.",
    houtu: "Houtu, la Souveraine de la Terre, est l'une des plus anciennes divinités : on lui sacrifiait sur un autel carré, la terre étant carrée et le ciel rond.",
    feima: "Le « cheval volant » est une image de légende. Historiquement, l'empereur Wu des Han fit la guerre au Ferghana pour obtenir des chevaux qui « suaient le sang », qu'on appela chevaux célestes.",
    bashe: "Le Bashe est un serpent qui avale un éléphant et en recrache les os au bout de trois ans. Hou Yi, raconte le Huainanzi, le tua au lac Dongting.",
    tiangou_noir: "Le Chien céleste dévore le soleil ou la lune lors des éclipses. On frappe tambours et gongs pour lui faire recracher l'astre.",
    fucanglong: "Le Fucanglong est, dans des traditions tardives, le dragon des trésors souterrains qui garde métaux et pierres précieuses. On raconte ici que les volcans naissent là où il remonte vers le ciel.",
    dilong: "Dilong (地龍), « dragon de la terre », se prête à plusieurs lectures ; c'est aussi le nom chinois du ver de terre. Ici, c'est un dragon fouisseur qui gouverne les eaux souterraines.",
    jing_jing: "Un objet qui traverse les siècles finit par avoir une âme. Les miroirs de bronze, surtout, gardent les reflets de ceux qui s'y sont regardés.",
    meng_shou: "Le mo, bête aux airs de tapir, mange les cauchemars ; on dormait sur des oreillers ornés de son image. Celle-ci a pris goût aux rêves, bons ou mauvais.",
    wu_shou: "Dans ce monde, les bêtes de brume vivent dans les nuages bas des déserts au petit matin. On ne voit que leurs yeux, et l'on comprend trop tard qu'on est entouré.",
    he_bo: "He Bo, le Comte du Fleuve, exigeait chaque année une épouse jetée au Fleuve Jaune. Le magistrat Ximen Bao mit fin au rite en y jetant les sorciers qui l'organisaient.",
    shui_shen: "Chaque source, chaque puits a son esprit des eaux. On lui jette une pièce pour boire sans tomber malade.",
    jiao: "Jiao (蛟) désigne, selon les textes, un dragon aquatique ou un être des eaux proche du jiaolong. Dans ce monde, c'est sa forme jeune, qui soulève les remous et les crues.",
    bai_she: "Dame Serpent Blanc, après mille ans d'ascèse, épousa le jeune Xu Xian. Le moine Fahai l'emprisonna sous la pagode Leifeng, mais leur amour reste célèbre.",
    heishui_xuan_she: "Le Shanhaijing décrit le pays des Eaux Noires où vivent des serpents noirs. On ne sait jamais où finit l'eau et où commence l'écaille.",
    heilong: "Le Dragon noir est associé au Nord, à l'hiver et aux eaux sombres. Dans ce monde, il dort dans les profondeurs et ne remonte qu'aux jours les plus froids.",
    bailong: "Le Cheval-dragon blanc du Voyage en Occident, roman du XVIe siècle, est un prince-dragon puni, changé en monture pour porter le moine Xuanzang jusqu'en Inde.",
    ao: "Nüwa coupa les pattes de la grande tortue Ao pour soutenir les quatre coins du ciel après que Gonggong eut brisé le mont Buzhou.",
    gui_tortue: "La tortue vit mille ans et son ventre porte le dessin du ciel. On brûlait sa carapace pour lire les fêlures : c'est l'origine de l'écriture chinoise.",
    linggui: "La tortue des présages sortit de la rivière Luo devant le grand Yu, un carré magique gravé sur la carapace. Yu en tira les lois pour gouverner les eaux.",
    xuan_gui: "La grande Tortue noire évoque Xuanwu, gardien du Nord et de l'hiver, souvent représenté comme une tortue entrelacée d'un serpent. Celle-ci n'a pas encore trouvé son serpent.",
    bixi: "Bixi, figure à carapace de tortue rangée dans les listes populaires des fils du Dragon, porte les stèles de pierre des temples et des tombeaux. On raconte ici qu'il soulevait des montagnes avant qu'on lui confie ce fardeau.",
    feiyu: "Les carpes qui remontent la cascade de la Porte du Dragon se changent en dragons. Celles qui échouent recommencent, encore et encore.",
    jiaoyu: "Le poisson-dragon a le corps d'un poisson et la tête d'un dragon. On le place au faîte des toits pour protéger les maisons du feu.",
    yingyu: "Le Shanhaijing décrit le poisson ailé ying, au cri de canard. Quand il apparaît, de grandes inondations suivent.",
    mu_mei: "Le folklore prête des esprits aux arbres et aux forêts profondes. Ceux de ce monde prennent l'aspect de jeunes femmes et égarent les bûcherons qui coupent sans demander.",
    mu_gui: "Dans ce monde, quand un arbre meurt sans être abattu, son esprit reste prisonnier de l'écorce. Il gémit les nuits de vent et ses branches attrapent les passants.",
    shan_gui: "Le Shan Gui, chanté par Qu Yuan dans les Chants de Chu, est un esprit des monts vêtu de lianes et de fougères, chevauchant une panthère rouge.",
    lu_jing: "Le cerf blanc est la monture des Immortels, porteur de longévité. Le lumineux brille la nuit ; le suivre mène aux herbes de jouvence, ou à se perdre.",
    hu_jing: "Le folklore connaît des tigres capables de prendre forme humaine. Ceux de ce monde, dit-on, tiennent auberge au bord des routes.",
    xiong_jing: "Le Démon-ours noir du Voyage en Occident, roman du XVIe siècle, vola la robe du moine Xuanzang. Guanyin le soumit et en fit le gardien de sa montagne.",
    he_jing: "La grue est l'oiseau des Immortels, symbole de longue vie. Elle porte les sages au ciel sur son dos.",
    lang_jing: "Les loups-esprits rôdent aux frontières, sous la constellation du Loup céleste. Ils hurlent sur les ruines des tours de guet.",
    she_jing: "Un serpent qui vit assez longtemps peut, dans le folklore, devenir esprit et prendre forme humaine, comme Dame Serpent Blanc. Tous ne choisissent pas l'amour.",
    shouling: "Dans ce monde, l'âme d'une bête morte injustement reste attachée à son terrier. Elle prend l'apparence de tous les animaux tués par le même chasseur.",
    jing_shou: "Dans ce monde, on reconnaît les bêtes-esprits à leurs yeux, qui brillent même sans lune. Elles voient les esprits invisibles aux hommes.",
    hanba: "Hanba (旱魃) est le nom donné plus tard au démon de la sécheresse, souvent assimilé à Nüba. Dans ce monde, c'en est une manifestation errante, et non la déesse elle-même : là où il passe, la pluie ne tombe plus.",
    shan_shen: "Chaque montagne a son dieu, et les cinq monts sacrés ont les leurs. Les empereurs y montaient pour offrir les sacrifices feng et shan au ciel et à la terre.",
    qilin: "Le qilin, créature de bon augure, ne foule pas l'herbe vivante. La tradition classique lie son apparition aux sages, et plusieurs récits l'associent à la naissance ou à la mort de Confucius.",
    feng_bo: "Feng Bo, le Comte du Vent, combattit pour Chiyou avec Yu Shi selon le Shanhaijing. Des commentateurs l'identifient au Grand Vent qu'abattit Hou Yi, et des récits tardifs disent que l'archer lui perça le genou.",
    yu_shi: "Yu Shi, le Maître de la Pluie, déchaîna l'orage avec Feng Bo pour Chiyou contre l'Empereur Jaune, selon le Shanhaijing. Nüba sécha cette pluie.",
    dian_mu: "Dian Mu, la Mère des Éclairs, accompagne Lei Gong. On dit qu'elle tient des miroirs pour éclairer sa cible avant qu'il frappe.",
    lei_shou: "La bête du tonnerre, le Kui, n'a qu'une patte ; son cri est le tonnerre. L'Empereur Jaune fit de sa peau un tambour qui s'entendait à cinq cents lieues.",
    feng_shou: "Les bêtes des vents vivent sur les sommets et courent avec les tempêtes. Elles s'échappent parfois du sac de Feng Bo.",
    yun_shou: "Les bêtes des nuées se cachent dans les nuages d'orage. On aperçoit leurs formes quand on regarde le ciel longtemps.",
    xue_niao: "Les oiseaux des neiges ne descendent des cimes que pour annoncer un hiver terrible. Leur cri fige l'eau des cascades.",
    feilong: "Le dragon volant n'a pas besoin d'ailes : il s'élève en chevauchant les nuages. Les empereurs portaient son image, et « dragon volant au ciel » annonce une ascension.",
    tengshe: "Le Tengshe est un serpent volant qui chevauche la brume. « Bien qu'il chevauche la brume, il finit en poussière », écrivit Cao Cao à propos de la vieillesse.",
    baihu: "Le Tigre blanc garde l'Ouest et l'automne. Il n'apparaît que quand l'empereur gouverne avec justice.",
    qinglong: "Le Dragon azur garde l'Est et le printemps, premier des quatre symboles célestes. Il annonce les pluies qui font pousser le riz.",
    qiongqi: "Qiongqi, tigre ailé, est l'un des Quatre Fléaux. Il dévore les honnêtes gens et récompense les menteurs.",
    tianma: "Le cheval céleste est, dans la légende, la monture des dieux. Les Han donnèrent aussi ce nom aux chevaux de l'Ouest qu'ils admiraient, sans que les deux traditions se confondent.",
    chiwen: "Le Chiwen, que les listes populaires rangent parmi les fils du Dragon, orne le faîte des toits. On le dit capable d'avaler le feu et de protéger la maison des incendies.",
    pulao: "Pulao, fils du Roi-Dragon, crie fort quand il a peur, surtout des baleines. On le sculpte sur les cloches, et le maillet a la forme d'une baleine.",
    bai_ze: "Bai Ze rencontra l'Empereur Jaune au bord de la mer et lui décrivit les 11 520 espèces de démons. L'empereur les fit dessiner : premier bestiaire de Chine.",
    bai_ze_savant: "On dit que Bai Ze connaît le nom de chaque esprit, et qu'un esprit nommé perd sa force. Celui-ci teste les voyageurs avec ses questions.",
    zouyu: "Le Zouyu est un tigre blanc à queue plus longue que le corps, qui ne mange pas d'êtres vivants. Il apparaît sous les règnes vertueux.",
    xiezhi: "Le Xiezhi, à une seule corne, distingue le coupable de l'innocent et frappe le menteur. Son image ornait les coiffes des juges.",
    bixie: "Le Bixie, bête ailée qui repousse le mal, était sculpté le long des allées funéraires, notamment sous les Six Dynasties. Ses représentations se confondent souvent avec celles du Tianlu.",
    tianlu: "Tianlu, la « Fortune céleste », est l'une des bêtes protectrices cornues des allées funéraires, proches du Bixie et du Pixiu dont les images se confondent souvent. On l'associe à la chance.",
    tianlu_gardien: "Les bêtes protectrices des portes, Tianlu, Bixie ou Pixiu selon les régions et les époques, se ressemblent beaucoup. Ces gardiens-ci veillent deux à deux devant les palais.",
    pixiu_tresor: "Le Pixiu, bête protectrice, dévore les richesses sans jamais les rendre. Les marchands portent encore son image pour retenir leur fortune.",
    bian: "Bi'an (狴犴), compté dans les listes populaires des fils du Dragon, est associé à la justice. Son image orne les portes des tribunaux et des prisons.",
    fuxi_dragon: "Certaines légendes donnent un corps de dragon aux descendants de Fuxi. Ce fils du dragon porte les huit trigrammes sur ses écailles.",
    chaofeng: "Chaofeng, fils du Roi-Dragon, aime le danger et les hauteurs. Il guette sur l'arête des toits des palais.",
    longma: "Le cheval-dragon sortit du Fleuve Jaune devant Fuxi, un dessin sur le dos. Fuxi en tira les huit trigrammes.",
    taotie_bronze: "Le masque du taotie couvre les bronzes rituels des Shang : une gueule sans corps. Il rappelle aux hommes de modérer leur appétit.",
    taotie_bete: "Le Taotie est si vorace qu'il s'est dévoré lui-même ; il ne reste que sa tête. Il fait partie des Quatre Fléaux.",
    jiuweihu: "Le renard à neuf queues du mont Qingqiu dévore les hommes. Mais celui qui mange sa chair devient immunisé contre les sortilèges.",
    xiangliu: "Xiangliu, ministre de Gonggong, a neuf têtes humaines sur un corps de serpent. Son sang empoisonna la terre ; Yu le tua et en fit un lac.",
    nian: "Selon une légende populaire répandue surtout à l'époque moderne, le Nian sortait à la veille du Nouvel An pour dévorer bétail et enfants. Il craignait le rouge, le feu et le bruit : d'où les lanternes et les pétards.",
    kuafu_geant: "Le géant Kuafu poursuivit le soleil ; assoiffé, il but le Fleuve Jaune et la rivière Wei sans se désaltérer. Il mourut, et son bâton devint une forêt de pêchers.",
    xingtian: "Xingtian défia l'Empereur Jaune, qui lui trancha la tête. Il continua le combat, ses seins pour yeux et son nombril pour bouche, brandissant hache et bouclier.",
    hai_ruo: "Hai Ruo, dieu de la mer du Nord, montra au Comte du Fleuve, selon Zhuangzi, que ses eaux n'étaient rien face à l'océan.",
    hai_shen: "Les dieux de la mer, Yuqiang au nord, commandent les vents marins. Yuqiang porte deux serpents verts aux oreilles et deux sous les pieds.",
    hai_gui: "Les tortues des récifs gardent les entrées des palais sous-marins. Les pêcheurs qui en voient une nager vers eux font demi-tour.",
    hai_she: "Le serpent des tourbillons tourne sur lui-même au fond des mers et crée les vortex qui avalent les jonques.",
    ren_yu: "Les jiaoren, ou gens-poissons, vivent au fond des mers du Sud. Ils tissent une soie qui ne se mouille pas, et leurs larmes se changent en perles.",
    kun: "Zhuangzi décrit le Kun, poisson de la mer du Nord dont on ne sait combien de milliers de li il mesure. Il se transforme en oiseau Peng et s'envole vers le Sud.",
    xuanwu: "Xuanwu, la Tortue noire enlacée d'un serpent, garde le Nord et l'hiver. Elle devint plus tard un dieu taoïste, le Guerrier sombre.",
    longwang: "Les quatre Rois-Dragons gouvernent les mers et la pluie depuis des palais de cristal. Sun Wukong vola au Roi de la mer de l'Est son bâton magique.",
    panlong: "Le Panlong est un dragon lové, qui n'est pas encore monté au ciel. Il dort au fond des lacs, enroulé autour des piliers.",
    shenlong: "Le Shenlong, dragon divin, commande au vent et à la pluie. Les paysans lui adressent leurs prières lors des sécheresses.",
    long: "Le dragon céleste réunit les neuf animaux : tête de chameau, cornes de cerf, yeux de démon, cou de serpent, ventre de mollusque, écailles de carpe, griffes d'aigle, pattes de tigre et oreilles de bœuf.",
    jinwu: "Les dix soleils sont des corbeaux d'or qui se reposent dans le mûrier Fusang et se relaient chaque jour. Un jour, ils sortirent tous ensemble.",
    sanzu_wu: "Le corbeau à trois pattes vit dans le soleil. Hou Yi abattit neuf des dix corbeaux, et l'on retrouva leurs plumes au sol.",
    fenghuang: "Le Fenghuang n'apparaît qu'en temps de paix. Il ne se pose que sur le sterculier, ne mange que les graines de bambou et ne boit qu'à la source de vin doux.",
    qingniao: "Les oiseaux bleus sont les messagers de la Reine Mère de l'Ouest. Ils annoncent sa venue et portent ses lettres aux souverains.",
    ruiniao: "Les oiseaux de bon augure se posent sur le toit des justes. Leur chant annonce une naissance heureuse.",
    peng: "Le Peng naît du poisson Kun. Ses ailes sont comme des nuages qui couvrent le ciel ; il s'élève à quatre-vingt-dix mille lieues.",
    ming_niao: "Les oiseaux des ténèbres volent la nuit et portent les âmes perdues. Leur cri annonce un deuil dans la maison.",
    guai_niao: "Les oiseaux monstrueux du Shanhaijing ont des visages humains et des cris d'enfants. Les voir annonce une guerre.",
    kuafu: "Kua Fu courut après le soleil pour le capturer. Il mourut de soif ; son bâton devint une forêt de pêchers.",
    shennong: "Shennong, le Divin Laboureur, enseigna l'agriculture et goûta cent herbes en un jour pour connaître leurs vertus, s'empoisonnant soixante-dix fois.",
    huangdi: "Huangdi, l'Empereur Jaune, vainquit Chiyou et fonda la civilisation chinoise. Il monta au ciel sur un dragon venu le chercher.",
    zhulong_torche: "Zhulong, le Dragon-torche, éclaire le monde de ses yeux. Ses expirations sont l'hiver et ses inspirations l'été.",
    yingzhao_cheval: "Yingzhao garde le jardin suspendu de l'Empereur céleste. Il a un corps de cheval, un visage humain, des rayures de tigre et des ailes.",
    yutu: "Le lièvre de jade vit sur la Lune avec Chang'e et pile l'élixir d'immortalité dans un mortier. On voit son ombre les nuits de pleine lune.",
    gui_po: "La vieille aux longs cheveux se tient sous les saules au bord de l'eau. Elle peigne sa chevelure grise et attire les enfants qui s'approchent trop.",
    nu_gui: "Les femmes mortes injustement reviennent, cheveux défaits et robe blanche, réclamer justice. Le juge Bao, dit-on, savait les écouter.",
    diaosi_gui: "Le fantôme du pendu porte une langue pendante et une corde. Il souffle aux désespérés de se pendre, afin d'être libéré.",
    yuan_gui: "L'esprit vengeur poursuit celui qui lui a causé du tort, de vie en vie. Seuls des rites et des excuses peuvent l'apaiser.",
    heibai_wuchang: "Les Impermanents noir et blanc escortent les âmes des morts vers les enfers. Le blanc souhaite fortune, le noir annonce la paix : rencontrer l'un ou l'autre est rarement bon signe.",
    nuwa: "Nüwa façonna les hommes avec de la glaise jaune. Quand le ciel se brisa, elle le répara avec des pierres de cinq couleurs fondues.",
    fuxi: "Fuxi, frère et époux de Nüwa, inventa les huit trigrammes, la pêche au filet et l'écriture. Il a un corps de serpent sous un buste humain.",
    yayu: "Yayu était un dieu bienveillant assassiné, ressuscité en monstre dévorant. Hou Yi le tua, dit le Huainanzi, sur ordre de l'empereur Yao.",
    feiyi: "Le Feiyi a un corps de serpent, deux têtes et six pattes. Le Shanhaijing dit que là où il apparaît, une grande sécheresse s'abat.",
    yingzhao_ailee: "Yingzhao, gardien ailé du jardin céleste, survole les quatre mers pour transmettre les ordres de l'Empereur céleste.",
    tiangou_lune: "Le Chien céleste dévore la lune lors des éclipses. Un conte populaire tardif en fait le chien de Hou Yi, qui aurait poursuivi Chang'e et avalé la lune."
};

// Provenance de chaque créature : texte classique, folklore plus tardif, ou adaptation propre au jeu.
export const SOURCE_LABELS = {
    classique: 'Texte classique',
    folklore: 'Folklore',
    adaptation: 'Adaptation du jeu'
};

// Rempli à partir de la relecture des notices ; une créature absente compte comme « adaptation ».
export const BESTIARY_SOURCE = {};

const PLAYSTYLE = {
    sorcerer: 'lanceur de sorts',
    barbarian: 'cogneur',
    assassin: 'rapide et sournois',
    templar: 'défenseur'
};

// Couleur la mieux encaissée : résistance la plus haute, à défaut la couleur dominante des sorts.
export function strongColorOf(template) {
    const res = template?.resistanceProfile || {};
    let best = null;
    MANA_COLORS.forEach(c => { if (Number.isFinite(res[c]) && (best === null || res[c] > res[best])) best = c; });
    return best || String(template?.spellProfile?.preferredColors?.[0] || '').toLowerCase() || null;
}

// Faiblesse du gabarit : même règle que le combat (couleur dominante des sorts → elements.js).
export function weakColorOf(template) {
    const color = String(template?.spellProfile?.preferredColors?.[0] || 'red').toLowerCase();
    return weaknessOf(color);
}

// Traits de combat lisibles à partir des multiplicateurs du gabarit.
export function traitsOf(template) {
    const m = template?.statsModifiers || {};
    const traits = [];
    if (m.hpMult >= 1.5) traits.push('très robuste');
    if (m.atkMult >= 1.4) traits.push('frappe fort');
    if (m.defMult >= 1.25) traits.push('carapace épaisse');
    const style = PLAYSTYLE[template?.playerClass];
    if (style) traits.push(style);
    return traits;
}

// Fiche d'un gabarit : nom, titre, race, force, faiblesse, traits et notice.
export function bestiaryEntry(template) {
    const strong = strongColorOf(template);
    const weak = weakColorOf(template);
    return {
        id: template.id,
        name: template.name,
        title: template.title || '',
        race: template.race || '',
        strongColor: strong,
        strongElement: strong ? elementName(strong) : null,
        weakColor: weak,
        weakElement: weak ? elementName(weak) : null,
        traits: traitsOf(template),
        lore: BESTIARY_LORE[template.id] || "Aucun conte ne parle encore de cette créature.",
        source: BESTIARY_SOURCE[template.id] || 'adaptation'
    };
}

// Fiches des créatures connues (ordre alphabétique) et compteur sur le catalogue (hors gabarit de secours).
export function bestiaryEntries(catalog, knownIds) {
    const list = (Array.isArray(catalog) ? catalog : []).filter(t => t && t.id && t.id !== 'fallback_enemy');
    const known = new Set(knownIds || []);
    const entries = list.filter(t => known.has(t.id)).map(bestiaryEntry)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { entries, known: entries.length, total: list.length };
}
