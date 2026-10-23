// Bestiaire du carnet : force, faiblesse et notice mythologique de chaque gabarit d'ennemi (enemies.catalog.json).
// Module pur (aucun DOM) : le catalogue est passé en argument, l'interface est dans explorationView.js (onglet « Bestiaire »).
//
// Force    = couleur de mana la mieux encaissée (résistance la plus haute du profil, sinon couleur dominante des sorts)
//            et trait de combat tiré des multiplicateurs (robuste, frappe fort, carapace) et de la classe de combat.
// Faiblesse = table des éléments (elements.js `weaknessOf`, même règle qu'en combat).
// Créatures connues : celles croisées en combat ou observées sur la carte (`session.data.bestiary`, exploration.js).

import { MANA_COLORS, weaknessOf, elementName } from './elements.js';

// Notices mythologiques (Shanhaijing, Huainanzi, Zhuangzi, Liezi, contes populaires…), une par gabarit.
export const BESTIARY_LORE = {
    canglong: "Canglong, le Dragon azur, règne sur l'Orient et le printemps dans la cosmologie des quatre orients. Ici, privé de soleil depuis la venue des dix astres, il s'est figé en seigneur du grand froid.",
    chilong: "Le Chilong est un dragon jeune et sans cornes, que les bronziers gravaient sur les vases rituels. Celui-ci s'est vautré dans la lave des volcans jusqu'à en garder la gueule incandescente.",
    jiangshi: "Le jiangshi est un cadavre raidi qui se déplace par bonds, bras tendus, et boit le souffle vital des vivants. Les prêtres taoïstes le figent en collant sur son front un talisman de papier jaune.",
    yinglong: "Yinglong, le Dragon ailé, combattit pour l'Empereur Jaune et tua Chiyou et Kuafu. Ne pouvant plus remonter au ciel, il resta au sud, où il apporte depuis les pluies.",
    chiyou: "Chiyou, au front de bronze et aux armes forgées, mena quatre-vingt-un frères contre l'Empereur Jaune à la bataille de Zhuolu. Il appela vent et brouillard, mais Nüba sécha l'orage et il fut vaincu.",
    suanni: "Le Suanni est l'un des neuf fils du Roi-Dragon : un lion paisible qui aime l'encens et la fumée. On le sculpte sur les brûle-parfums des temples, qu'il garde sans jamais s'endormir.",
    gui_esprit: "Les gui sont les âmes des morts sans descendance ni sépulture. Chaque septième mois, les portes de l'enfer s'ouvrent et ils errent parmi les vivants en quête d'offrandes.",
    huli_jing: "Le huli jing est un renard qui, après des siècles de pratique, prend forme humaine. Il séduit, vole le souffle vital et déteste qu'on aperçoive la queue qui dépasse de sa robe.",
    hundun: "Hundun est le Chaos primordial, sans yeux ni bouche. Selon Zhuangzi, ses amis Shu et Hu lui percèrent sept orifices, un par jour, pour lui offrir les sens ; le septième jour, il mourut.",
    assassin_masque: "Les lames du Voile Noir rappellent Jing Ke, l'assassin qui cacha un poignard dans une carte roulée pour tuer le roi de Qin. Comme lui, elles frappent une seule fois, au plus près.",
    shu_jing: "Les vieux arbres, dit-on, finissent par s'éveiller en esprits (shu jing). Abattre un pin millénaire sans offrande fait saigner son tronc et attire la vengeance de son gardien.",
    lettre_sorcier: "Le lettré-sorcier a réussi les examens impériaux, puis lu les livres interdits. Son pinceau trace des talismans qui lient les esprits : les mots écrits, dit-on, font pleurer les démons.",
    pixiu: "Le Pixiu est un lion ailé qui se nourrit d'or et d'argent et n'a pas d'anus : rien ne ressort de ce qu'il avale. Celui-ci a dévoré tant de braises qu'il en est devenu une fournaise.",
    pretresse_lunaire: "Ces prêtresses servent Chang'e au Palais du Grand Froid sur la Lune. Elles gardent le souvenir de l'élixir volé à Hou Yi et se méfient de tout archer.",
    soldat_terre_cuite: "Le premier empereur Qin se fit enterrer avec une armée de huit mille soldats d'argile, chacun avec son propre visage. Certains, dit-on, ont fini par se lever.",
    wen_shen: "Les Wen Shen sont les cinq dieux des épidémies, un par saison et un pour le centre. On les apaise en lançant à la mer des barques chargées d'offrandes pour qu'ils s'en aillent avec elles.",
    lei_gong: "Lei Gong, le Duc du Tonnerre, a un bec d'oiseau, des ailes et un tambour. Il foudroie les coupables de crimes cachés, en particulier ceux qui gaspillent le riz.",
    lingzhi_maudit: "Le lingzhi est le champignon d'immortalité que les Immortels cueillent sur les monts sacrés. Poussé sur un champ de bataille, il donne l'inverse : des spores qui volent la vie.",
    crapaud_boue: "Le crapaud est l'animal de la Lune : Chang'e, dit une version, y fut changée en crapaud après avoir avalé l'élixir. Ses cousins des marais chantent encore sa honte chaque soir.",
    dame_des_neiges: "La Dame des Neiges apparaît pendant les tempêtes aux voyageurs perdus. Ceux qu'elle épargne doivent garder le secret de sa rencontre, sinon son éventail de givre les retrouve.",
    gui_guerrier: "Les soldats tombés loin de chez eux, sans rites funéraires, deviennent des gui guerriers. Ils continuent la bataille qu'ils ont perdue, sabre rouillé à la main.",
    garde_solaire: "Ces gardes servaient les dix soleils, fils de Xihe et de Dijun. Quand Hou Yi abattit neuf soleils, ils jurèrent de protéger les survivants jusqu'au dernier.",
    jiaolong: "Le jiaolong est un dragon des eaux qui n'a pas encore atteint le ciel ; il provoque crues et noyades. Zhou Chu, le héros repenti, plongea trois jours dans le fleuve pour en tuer un.",
    immortel_jade: "Les Immortels (xian) atteignent l'éternité par l'alchimie et la méditation. Celui-ci s'est fait jade pour durer toujours, et prédit l'avenir dans les reflets de sa peau.",
    shanxiao: "Le Shanxiao est un démon des montagnes à une seule patte, tournée vers l'arrière. Il craint le bruit : on fait éclater des bambous dans le feu pour le chasser, origine des pétards.",
    tigre_embrase: "Le tigre est le roi des animaux : le caractère « roi » (王) est inscrit sur son front. Celui-ci a survécu aux dix soleils, et sa fourrure en garde les braises.",
    sanglier_flammes: "Le sanglier est le dernier des douze animaux du zodiaque, arrivé en retard à la course de l'Empereur de Jade. Celui-ci charge comme s'il voulait rattraper son rang.",
    loup_braise: "Dans le ciel, l'étoile du Loup céleste (Sirius) annonce les invasions ; Hou Yi, dit-on, garde sa flèche pointée sur elle. Les loups de braise suivent la trace des incendies.",
    cao_jing: "Les esprits des herbes naissent dans les prés que personne ne fauche. Ils sont timides et ne mordent que ceux qui piétinent les jeunes pousses.",
    hua_jing: "Les fées des fleurs prennent l'apparence de jeunes filles parfumées. Les contes du Liaozhai racontent leurs amours avec des lettrés : elles meurent quand on coupe leur fleur.",
    huli_commun: "Avant d'être un esprit, un renard vit cinquante ans pour prendre forme humaine, cent ans pour être belle, mille ans pour monter au ciel. Celui-ci n'a pas encore commencé.",
    shuihou: "Le singe des eaux se cache dans les mares et les puits. Il attire les enfants qui se baignent pour les noyer, et ne quitte l'eau que si on lui renverse de l'eau de la tête.",
    shui_gui: "Le noyé ne peut se réincarner qu'en noyant un autre à sa place. Il guette donc les berges, invisible sous la surface, en attendant une cheville à saisir.",
    qing_she: "Petite Verte (Xiao Qing) est la sœur de cœur de Dame Serpent Blanc dans la Légende du Serpent Blanc. Les serpents de jade des rizières se disent de sa famille.",
    jingwei: "Nüwa (« petite fille »), fille de l'empereur Yan, se noya dans la mer de l'Est et devint l'oiseau Jingwei. Depuis, elle porte brindilles et cailloux pour combler la mer, sans jamais renoncer.",
    she_shen: "She Shen est le dieu du sol d'un village, honoré sur un tertre de terre. Les paysans lui offrent les prémices de la récolte ; il se fâche quand on les oublie.",
    zu_xian: "Les ancêtres veillent sur leurs descendants tant qu'on leur brûle encens et papier-monnaie. Négligés, ils deviennent querelleurs et viennent réclamer leur dû.",
    du_she: "Les serpents à venin font partie des Cinq Venimeux, combattus au cinquième jour du cinquième mois avec du vin au réalgar. Celui-ci n'en a jamais bu.",
    xuan_she: "Le Shanhaijing parle d'un serpent noir qui avale des cerfs. On dit qu'il en est un, devenu si grand que son ombre suffit à refroidir les eaux de la rizière.",
    huo_shen: "Zhurong, dieu du feu, combattit Gonggong, dieu des eaux ; le perdant brisa le mont Buzhou. Les esprits de la flamme se réclament de lui et attisent les volcans en son nom.",
    huo_shou: "Les bêtes de cendre naissent dans les forêts que la sécheresse a fait brûler. Elles ne craignent que la pluie, et les dix soleils les ont rendues innombrables.",
    chi_niao: "Les oiseaux ardents sont parents des corbeaux du soleil. Ils volent au-dessus des cratères et laissent tomber des braises sur les champs.",
    bi_fang: "Bi Fang est un oiseau à une seule patte, au plumage bleu tacheté de rouge. Le Shanhaijing dit que là où il apparaît, un incendie éclate.",
    nuba: "Nüba, fille de l'Empereur Jaune, sécha la tempête de Chiyou à Zhuolu. Mais elle ne put remonter au ciel, et partout où elle passe, la pluie cesse de tomber.",
    zhuque: "L'Oiseau vermillon garde le Sud et l'été, parmi les quatre symboles du ciel. Ses ailes déploient la constellation du même nom.",
    zhulong_serpent: "Zhulong, le Dragon-torche, a un visage humain sur un corps de serpent rouge long de mille lieues. Quand il ouvre les yeux, il fait jour ; quand il les ferme, c'est la nuit.",
    dijiang: "Dijiang, sur le mont Tian, est un sac jaune-rouge comme le feu, à six pattes et quatre ailes, sans visage. Il connaît pourtant le chant et la danse.",
    yazi: "Yazi est le fils du Roi-Dragon qui aime tuer : il orne les poignées des sabres et des haches. Il ne se calme qu'après le combat.",
    mei: "Les mei sont des esprits trompeurs nés des lieux sauvages. Ils imitent la voix d'un proche pour égarer les voyageurs dans les dunes.",
    wangliang: "Les wangliang sont les esprits des montagnes et des eaux, de la taille d'un enfant de trois ans, à la peau noire et aux yeux rouges. Les chamans les chassaient en tête des cortèges funéraires.",
    wangxiang: "Le wangxiang dévore le foie et le cerveau des morts dans les tombeaux. Il craint les tigres et les cyprès, qu'on plante pour cette raison sur les tombes.",
    shi_jing: "Les pierres très anciennes s'éveillent parfois en esprits. Le Singe de pierre, Sun Wukong, naquit lui-même d'un rocher fécondé par le ciel et la terre.",
    houtu: "Houtu, la Souveraine de la Terre, est l'une des plus anciennes divinités : on lui sacrifiait sur un autel carré, la terre étant carrée et le ciel rond.",
    feima: "Les chevaux volants viennent de l'Ouest lointain. L'empereur Wu des Han fit la guerre au Ferghana pour obtenir ces chevaux qui « suaient le sang » et galopaient au ciel.",
    bashe: "Le Bashe est un serpent qui avale un éléphant et en recrache les os au bout de trois ans. Hou Yi, raconte le Huainanzi, le tua au lac Dongting.",
    tiangou_noir: "Le Chien céleste dévore le soleil ou la lune lors des éclipses. On frappe tambours et gongs pour lui faire recracher l'astre.",
    fucanglong: "Le Fucanglong, dragon des trésors cachés, vit sous terre et garde les métaux précieux. Les volcans naissent, dit-on, là où il remonte faire son rapport au ciel.",
    dilong: "Le Dilong, dragon de la terre, gouverne les rivières souterraines. « Dilong » est aussi le nom chinois du ver de terre, qui en serait l'humble forme.",
    jing_jing: "Un objet qui traverse les siècles finit par avoir une âme. Les miroirs de bronze, surtout, gardent les reflets de ceux qui s'y sont regardés.",
    meng_shou: "Le mo, bête aux airs de tapir, mange les cauchemars ; on dormait sur des oreillers ornés de son image. Celle-ci a pris goût aux rêves, bons ou mauvais.",
    wu_shou: "Les bêtes de brume vivent dans les nuages bas des déserts au petit matin. On ne voit que leurs yeux, et l'on comprend trop tard qu'on est entouré.",
    he_bo: "He Bo, le Comte du Fleuve, exigeait chaque année une épouse jetée au Fleuve Jaune. Le magistrat Ximen Bao mit fin au rite en y jetant les sorciers qui l'organisaient.",
    shui_shen: "Chaque source, chaque puits a son esprit des eaux. On lui jette une pièce pour boire sans tomber malade.",
    jiao: "Le jiao est un dragon des remous capable de provoquer des inondations. Il devient dragon véritable s'il traverse la mer sans être vu.",
    bai_she: "Dame Serpent Blanc, après mille ans d'ascèse, épousa le jeune Xu Xian. Le moine Fahai l'emprisonna sous la pagode Leifeng, mais leur amour reste célèbre.",
    heishui_xuan_she: "Le Shanhaijing décrit le pays des Eaux Noires où vivent des serpents noirs. On ne sait jamais où finit l'eau et où commence l'écaille.",
    heilong: "Le Dragon noir des profondeurs ne monte au ciel qu'au solstice d'hiver. Il commande aux eaux sombres du nord.",
    bailong: "Le Cheval-dragon blanc du Voyage en Occident était un prince-dragon puni, changé en monture pour porter le moine Xuanzang jusqu'en Inde.",
    ao: "Nüwa coupa les pattes de la grande tortue Ao pour soutenir les quatre coins du ciel après que Gonggong eut brisé le mont Buzhou.",
    gui_tortue: "La tortue vit mille ans et son ventre porte le dessin du ciel. On brûlait sa carapace pour lire les fêlures : c'est l'origine de l'écriture chinoise.",
    linggui: "La tortue des présages sortit de la rivière Luo devant le grand Yu, un carré magique gravé sur la carapace. Yu en tira les lois pour gouverner les eaux.",
    xuan_gui: "La grande Tortue noire garde le Nord. Elle est souvent enlacée par un serpent, l'union du yin et du yang.",
    bixi: "Bixi, fils du Roi-Dragon, porte les stèles de pierre sur son dos. Il aimait trop soulever des montagnes ; le grand Yu le fit porter des inscriptions pour l'apaiser.",
    feiyu: "Les carpes qui remontent la cascade de la Porte du Dragon se changent en dragons. Celles qui échouent recommencent, encore et encore.",
    jiaoyu: "Le poisson-dragon a le corps d'un poisson et la tête d'un dragon. On le place au faîte des toits pour protéger les maisons du feu.",
    yingyu: "Le Shanhaijing décrit le poisson ailé ying, au cri de canard. Quand il apparaît, de grandes inondations suivent.",
    mu_mei: "Les esprits du bois habitent les forêts profondes et prennent l'aspect de jeunes femmes. Ils égarent les bûcherons qui coupent sans demander.",
    mu_gui: "Quand un arbre meurt sans être abattu, son esprit reste prisonnier de l'écorce. Il gémit les nuits de vent et ses branches attrapent les passants.",
    shan_gui: "Le Shan Gui, chanté par Qu Yuan dans les Chants de Chu, est un esprit des monts vêtu de lianes et de fougères, chevauchant une panthère rouge.",
    lu_jing: "Le cerf blanc est la monture des Immortels, porteur de longévité. Le lumineux brille la nuit ; le suivre mène aux herbes de jouvence, ou à se perdre.",
    hu_jing: "Les tigres-esprits sont des tigres devenus maîtres de la transformation. Ils prennent forme humaine et tiennent auberge au bord des routes.",
    xiong_jing: "L'ours-esprit noir du Voyage en Occident vola la robe du moine Xuanzang. Guanyin le soumit et en fit le gardien de sa montagne.",
    he_jing: "La grue est l'oiseau des Immortels, symbole de longue vie. Elle porte les sages au ciel sur son dos.",
    lang_jing: "Les loups-esprits rôdent aux frontières, sous la constellation du Loup céleste. Ils hurlent sur les ruines des tours de guet.",
    she_jing: "Un serpent qui vit assez longtemps devient esprit et peut prendre forme humaine, comme Dame Serpent Blanc. Tous ne choisissent pas l'amour.",
    shouling: "L'âme d'une bête morte injustement reste attachée à son terrier. Elle prend l'apparence de tous les animaux tués par le même chasseur.",
    jing_shou: "On reconnaît les bêtes-esprits à leurs yeux, qui brillent même sans lune. Elles voient les esprits invisibles aux hommes.",
    hanba: "Hanba est un démon de la sécheresse : là où il passe, la pluie ne tombe plus. Les paysans le chassaient en l'insultant et en battant les tombes.",
    shan_shen: "Chaque montagne a son dieu, et les cinq monts sacrés ont les leurs. Les empereurs y montaient pour offrir les sacrifices feng et shan au ciel et à la terre.",
    qilin: "Le qilin ne foule pas l'herbe et ne mange aucun être vivant. Il annonce la naissance d'un sage : sa venue précéda celle de Confucius.",
    feng_bo: "Feng Bo, le Comte du Vent, garde les vents dans un sac. Il aida Chiyou contre l'Empereur Jaune, puis fut vaincu par Hou Yi, qui lui transperça le genou.",
    yu_shi: "Yu Shi, le Maître de la Pluie, verse l'eau d'un bol pour arroser le monde. Il combattit aux côtés de Feng Bo pour Chiyou.",
    dian_mu: "Dian Mu, la Mère des Éclairs, tient deux miroirs pour éclairer la cible de Lei Gong avant qu'il frappe, afin qu'il ne punisse jamais un innocent.",
    lei_shou: "La bête du tonnerre, le Kui, n'a qu'une patte ; son cri est le tonnerre. L'Empereur Jaune fit de sa peau un tambour qui s'entendait à cinq cents lieues.",
    feng_shou: "Les bêtes des vents vivent sur les sommets et courent avec les tempêtes. Elles s'échappent parfois du sac de Feng Bo.",
    yun_shou: "Les bêtes des nuées se cachent dans les nuages d'orage. On aperçoit leurs formes quand on regarde le ciel longtemps.",
    xue_niao: "Les oiseaux des neiges ne descendent des cimes que pour annoncer un hiver terrible. Leur cri fige l'eau des cascades.",
    feilong: "Le dragon volant n'a pas besoin d'ailes : il s'élève en chevauchant les nuages. Les empereurs portaient son image, et « dragon volant au ciel » annonce une ascension.",
    tengshe: "Le Tengshe est un serpent volant qui chevauche la brume. « Bien qu'il chevauche la brume, il finit en poussière », écrivit Cao Cao à propos de la vieillesse.",
    baihu: "Le Tigre blanc garde l'Ouest et l'automne. Il n'apparaît que quand l'empereur gouverne avec justice.",
    qinglong: "Le Dragon azur garde l'Est et le printemps, premier des quatre symboles célestes. Il annonce les pluies qui font pousser le riz.",
    qiongqi: "Qiongqi, tigre ailé, est l'un des Quatre Fléaux. Il dévore les honnêtes gens et récompense les menteurs.",
    tianma: "Le cheval céleste est la monture des dieux. Les chevaux des steppes, disait-on, descendaient de lui.",
    chiwen: "Chiwen, fils du Roi-Dragon, aime contempler le lointain. On le place aux extrémités des toits ; il avale le feu et protège la maison.",
    pulao: "Pulao, fils du Roi-Dragon, crie fort quand il a peur, surtout des baleines. On le sculpte sur les cloches, et le maillet a la forme d'une baleine.",
    bai_ze: "Bai Ze rencontra l'Empereur Jaune au bord de la mer et lui décrivit les 11 520 espèces de démons. L'empereur les fit dessiner : premier bestiaire de Chine.",
    bai_ze_savant: "On dit que Bai Ze connaît le nom de chaque esprit, et qu'un esprit nommé perd sa force. Celui-ci teste les voyageurs avec ses questions.",
    zouyu: "Le Zouyu est un tigre blanc à queue plus longue que le corps, qui ne mange pas d'êtres vivants. Il apparaît sous les règnes vertueux.",
    xiezhi: "Le Xiezhi, à une seule corne, distingue le coupable de l'innocent et frappe le menteur. Son image ornait les coiffes des juges.",
    bixie: "Le Bixie, lion ailé, repousse le mal. On le sculptait sur les allées funéraires des empereurs pour garder les tombeaux.",
    tianlu: "Tianlu, la « Fortune céleste », est une bête cornue qui attire la chance. Elle accompagne souvent le Bixie dans les sculptures.",
    tianlu_gardien: "Placés deux à deux devant les palais, les Tianlu gardent les portes : ce qui entre doit apporter la fortune.",
    pixiu_tresor: "Le Pixiu dévore l'or sans jamais le rendre. Les marchands portent encore son image pour retenir leur fortune.",
    bian: "Bi'an, fils du Roi-Dragon, aime la justice et les procès. Il orne les portes des prisons et surveille les condamnés.",
    fuxi_dragon: "Certaines légendes donnent un corps de dragon aux descendants de Fuxi. Ce fils du dragon porte les huit trigrammes sur ses écailles.",
    chaofeng: "Chaofeng, fils du Roi-Dragon, aime le danger et les hauteurs. Il guette sur l'arête des toits des palais.",
    longma: "Le cheval-dragon sortit du Fleuve Jaune devant Fuxi, un dessin sur le dos. Fuxi en tira les huit trigrammes.",
    taotie_bronze: "Le masque du taotie couvre les bronzes rituels des Shang : une gueule sans corps. Il rappelle aux hommes de modérer leur appétit.",
    taotie_bete: "Le Taotie est si vorace qu'il s'est dévoré lui-même ; il ne reste que sa tête. Il fait partie des Quatre Fléaux.",
    jiuweihu: "Le renard à neuf queues du mont Qingqiu dévore les hommes. Mais celui qui mange sa chair devient immunisé contre les sortilèges.",
    xiangliu: "Xiangliu, ministre de Gonggong, a neuf têtes humaines sur un corps de serpent. Son sang empoisonna la terre ; Yu le tua et en fit un lac.",
    nian: "Le Nian sortait de la mer à la veille du Nouvel An pour dévorer bétail et enfants. Il craint le rouge, le feu et le bruit : d'où les lanternes et les pétards.",
    kuafu_geant: "Le géant Kuafu poursuivit le soleil ; assoiffé, il but le Fleuve Jaune et la rivière Wei sans se désaltérer. Il mourut, et son bâton devint une forêt de pêchers.",
    xingtian: "Xingtian défia l'Empereur Jaune, qui lui trancha la tête. Il continua le combat, ses seins pour yeux et son nombril pour bouche, brandissant hache et bouclier.",
    hai_ruo: "Hai Ruo, dieu de la mer du Nord, montra au Comte du Fleuve, selon Zhuangzi, que ses eaux n'étaient rien face à l'océan.",
    hai_shen: "Les dieux de la mer, Yuqiang au nord, commandent les vents marins. Yuqiang porte deux serpents verts aux oreilles et deux sous les pieds.",
    hai_gui: "Les tortues des récifs gardent les entrées des palais sous-marins. Les pêcheurs qui en voient une nager vers eux font demi-tour.",
    hai_she: "Le serpent des tourbillons tourne sur lui-même au fond des mers et crée les vortex qui avalent les jonques.",
    ren_yu: "Les jiaoren, ou gens-poissons, vivent au fond des mers du Sud. Ils tissent une soie qui ne se mouille pas, et leurs larmes se changent en perles.",
    kun: "Zhuangzi décrit le Kun, poisson de la mer du Nord long de mille lieues, qui se transforme en oiseau Peng et vole vers le Sud.",
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
    tiangou_lune: "Le Chien céleste dévore la lune lors des éclipses. Selon une légende, c'était le chien de Hou Yi, qui suivit Chang'e et avala la lune."
};

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
        lore: BESTIARY_LORE[template.id] || "Aucun conte ne parle encore de cette créature."
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
