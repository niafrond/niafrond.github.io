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
    chiyou: "Selon le Shanhaijing, Chiyou appela le Comte du Vent et le Maître de la Pluie pour déchaîner l'orage contre l'Empereur Jaune, qui envoya Nüba l'assécher. Le Shiji place sa défaite à Zhuolu ; des récits tardifs lui prêtent un front de bronze et quatre-vingt-un frères.",
    suanni: "Dans les listes populaires des « neuf fils du Dragon », qui varient selon les sources, le Suanni est un lion paisible qui aime l'encens et la fumée. On le sculpte sur les brûle-parfums des temples.",
    gui_esprit: "Les gui sont les âmes des morts privées de descendants ou de rites funéraires. Selon des traditions religieuses plus tardives, liées à la fête des fantômes, ils errent parmi les vivants au septième mois en quête d'offrandes.",
    huli_jing: "Le huli jing est un renard qui, après une longue pratique, peut prendre forme humaine ; il séduit et vole le souffle vital. Il déteste qu'on aperçoive la queue qui dépasse de sa robe.",
    hundun: "Hundun est le Chaos primordial, une figure conceptuelle plus qu'un simple monstre. Selon Zhuangzi, Shu et Hu, voulant le remercier, lui percèrent sept orifices, un par jour, pour lui donner les sens ; le septième jour, il mourut. Ici, les colosses sans visage du Gobi passent pour ses rejetons.",
    assassin_masque: "Le Voile Noir est une création de cette légende, inspirée de Jing Ke, l'assassin historique qui cacha un poignard dans une carte roulée pour tuer le roi de Qin. Comme lui, ces lames frappent une seule fois, au plus près.",
    shu_jing: "Les vieux arbres, dit-on, finissent par s'éveiller en esprits (shu jing). Abattre un pin millénaire sans offrande fait saigner son tronc et attire la vengeance de son gardien.",
    lettre_sorcier: "Le lettré-sorcier a réussi les examens impériaux, puis lu les livres interdits. Son pinceau trace des talismans qui lient les esprits : les mots écrits, dit-on, font pleurer les démons.",
    pixiu: "Le Pixiu est une bête protectrice qui dévore l'or et l'argent sans jamais les rendre. Celui-ci a dévoré tant de braises qu'il en est devenu une fournaise, une invention de cette légende.",
    pretresse_lunaire: "Ces prêtresses sont une création de cette légende : elles veillent sur le Palais du Grand Froid, sur la Lune, et attendent celle que les astres leur ont annoncée. Les dix soleils en ont égaré quelques-unes jusque dans les forêts brûlées ; elles se méfient de tout archer.",
    soldat_terre_cuite: "Le premier empereur Qin fit enterrer près de son mausolée une armée de terre cuite composée de milliers de guerriers. Leurs visages et leurs équipements présentent de nombreuses variations. Certains, dit-on ici, se réveillent encore sous la terre.",
    wen_shen: "Les Wen Shen sont les dieux des épidémies ; leur nombre et leur organisation varient selon les régions. Dans certains rites du Sud, on les éloigne en lançant à la mer des barques chargées d'offrandes.",
    lei_gong: "Lei Gong, le Duc du Tonnerre, est souvent représenté avec un bec d'oiseau, des ailes et des tambours. Il foudroie les coupables de crimes cachés, et la tradition populaire lui fait aussi punir ceux qui gaspillent le grain.",
    lingzhi_maudit: "Le lingzhi est le champignon d'immortalité que les Immortels cueillent sur les monts sacrés. Poussé sur un champ de bataille, il donne l'inverse : des spores qui volent la vie.",
    crapaud_boue: "Le crapaud est un animal de la Lune : un texte des Han dit que Chang'e y fut changée en crapaud après avoir avalé l'élixir. Dans ce monde, ses cousins des marais chantent chaque soir vers la lune, comme s'ils savaient déjà qui doit y monter.",
    dame_des_neiges: "Selon le Huainanzi, Qingnü (青女), la Fille bleue, paraît au dernier mois de l'automne pour faire tomber le givre et la neige. Les Dames des Neiges de ce monde sont ses suivantes égarées : chassées des cimes par les dix soleils, elles errent dans les embruns de la mer et sur le Pic de la Lune, éventail de givre à la main.",
    gui_guerrier: "Un mort privé de rites peut devenir un esprit dangereux. Les gui guerriers de ce monde sont des soldats tombés loin de chez eux, qui continuent, sabre rouillé à la main, la bataille qu'ils ont perdue.",
    garde_solaire: "Ces gardes sont une création de cette légende : ils servaient les dix soleils, fils de Xihe et de Di Jun, au pied de l'Arbre Fusang. À mesure que Hou Yi abattait les soleils, ils se sont repliés sur ses racines, jurant de protéger les derniers.",
    jiaolong: "Le jiaolong est un dragon des eaux associé aux crues ; jiao et jiaolong désignent selon les textes des créatures apparentées. Le Shishuo xinyu raconte que Zhou Chu, le héros repenti, en tua un après trois jours de lutte dans le fleuve.",
    immortel_jade: "Les Immortels (xian) atteignent l'éternité par l'alchimie et la méditation. Celui-ci s'est fait jade pour durer toujours, et prédit l'avenir dans les reflets de sa peau.",
    shanxiao: "Le Shanxiao est un esprit des montagnes qui, selon certaines descriptions, n'a qu'une seule patte. Des textes médiévaux disent que le vacarme des bambous éclatant dans le feu le chassait, d'où viendraient en partie les pétards. Dans ce monde, la soif l'a fait descendre des cols jusqu'aux plaines et aux falaises de la mer.",
    tigre_embrase: "Selon la tradition populaire, les rayures du front du tigre dessinent le caractère « roi » (王), d'où son titre de roi des animaux. Celui-ci a survécu aux dix soleils, et sa fourrure en garde les braises.",
    sanglier_flammes: "Le sanglier est le dernier des douze animaux du zodiaque, arrivé en retard à la course de l'Empereur de Jade. Celui-ci charge comme s'il voulait rattraper son rang.",
    loup_braise: "L'étoile du Loup céleste (Sirius) annonçait les invasions, et des poèmes y font viser l'Arc céleste voisin. Les loups de braise de ce monde suivent la trace des incendies.",
    cao_jing: "Les esprits des herbes sont une création de cette légende : dans ce monde, ils naissent dans les prés que personne ne fauche. Timides, ils ne mordent que ceux qui piétinent les jeunes pousses.",
    hua_jing: "Les fées des fleurs prennent l'apparence de jeunes filles parfumées. Dans les contes du Liaozhai, certaines aiment des lettrés et souffrent du sort réservé à leur plante, qu'on la coupe ou la piétine.",
    huli_commun: "Dans le folklore, un renard gagne des pouvoirs de transformation en vieillissant, et certains textes donnent des âges précis pour chaque étape. Celui-ci n'a pas encore commencé.",
    shuihou: "Le singe des eaux ressemble à d'autres monstres aquatiques du folklore qui attirent les baigneurs pour les noyer. Celui-ci se cache dans les mares de la rizière.",
    shui_gui: "Un motif populaire veut que le noyé ne puisse se réincarner qu'en noyant quelqu'un à sa place. Il guette donc les berges, sous la surface, en attendant une cheville à saisir.",
    qing_she: "Petite Verte (Xiao Qing) est la sœur de cœur de Dame Serpent Blanc dans la Légende du Serpent Blanc. Les serpents de jade des rizières se disent de sa famille.",
    jingwei: "Nüwa (女娃), fille de l'Empereur Yan (à ne pas confondre avec la déesse Nüwa, 女娲), se noya dans la mer de l'Est et devint l'oiseau Jingwei. Depuis, elle porte des brindilles et des pierres pour tenter de combler la mer.",
    she_shen: "She Shen est le dieu du sol d'un village, honoré sur un tertre de terre. Les paysans lui offrent les prémices de la récolte ; il se fâche quand on les oublie.",
    zu_xian: "On honore les ancêtres avec de l'encens, des offrandes et du papier-monnaie. Dans ce monde, ceux qu'on a négligés reviennent réclamer leur dû.",
    du_she: "Les serpents à venin font partie des Cinq Venimeux, combattus au cinquième jour du cinquième mois avec du vin au réalgar. Celui-ci n'en a jamais bu.",
    xuan_she: "Le Shanhaijing mentionne un serpent noir qui dévore des cerfs. Dans ce monde, celui-ci en serait un descendant, devenu si grand que son ombre suffit à refroidir les eaux de la rizière.",
    huo_shen: "Selon certains récits, Zhurong, dieu du feu, affronta Gonggong, dieu des eaux, qui, vaincu, brisa d'un coup de tête le mont Buzhou. Dans ce monde, les esprits de la flamme se réclament de Zhurong et attisent les volcans en son nom.",
    huo_shou: "Dans ce monde, les bêtes de cendre naissent dans les forêts que la sécheresse a fait brûler. Elles ne craignent que la pluie, et les dix soleils les ont rendues innombrables.",
    chi_niao: "Dans ce monde, les oiseaux ardents sont parents des corbeaux du soleil, ces oiseaux solaires de la mythologie ancienne. Ils volent au-dessus des cratères et laissent tomber des braises sur les champs.",
    bi_fang: "Bi Fang est un oiseau à une seule patte, au plumage bleu tacheté de rouge. Le Shanhaijing dit que là où il apparaît, un incendie éclate.",
    nuba: "Nüba (女魃), fille de l'Empereur Jaune, fit cesser la pluie de Feng Bo et Yu Shi pour que son père vainque Chiyou. Ne pouvant remonter au ciel, elle apporta la sécheresse partout où elle résidait.",
    zhuque: "L'Oiseau vermillon garde le Sud et l'été, parmi les quatre symboles du ciel. Il préside, dans l'astronomie chinoise, aux sept constellations (« loges ») de la région sud du ciel.",
    zhulong_serpent: "Zhulong, le Dragon-torche, a un visage humain sur un corps de serpent rouge long de mille lieues. Quand il ouvre les yeux, il fait jour ; quand il les ferme, c'est la nuit.",
    dijiang: "Dijiang, sur le mont Tian, est un sac jaune-rouge comme le feu, à six pattes et quatre ailes, sans visage. Il connaît pourtant le chant et la danse.",
    yazi: "Dans les listes populaires tardives des neuf fils du Dragon, Yazi est celui qui aime tuer et se battre : on sculpte son image sur les poignées de sabres. Dans ce monde, il ne se calme qu'après le combat.",
    mei: "Mei (魅) est un terme ancien pour des esprits trompeurs. Ceux de ce monde imitent la voix d'un proche pour égarer les voyageurs dans les dunes.",
    wangliang: "Les wangliang (魍魎) sont, dans les textes anciens, des êtres démoniaques des montagnes et des eaux, à l'aspect variable selon les sources. Ceux-ci hantent les lieux sauvages et désertés.",
    wangxiang: "Selon des sources de l'époque Han, le wangxiang hante les tombes et dévore les morts ; on plante des cyprès et l'on dresse des tigres de pierre pour l'éloigner. Le Guoyu en fait plutôt un monstre des eaux.",
    shi_jing: "Les pierres très anciennes s'éveillent parfois en esprits. Le Singe de pierre, Sun Wukong, naquit lui-même d'un rocher fécondé par le ciel et la terre.",
    houtu: "Houtu, « Souverain de la Terre », fut d'abord, selon le Zuozhuan, le titre de Goulong, fils de Gonggong ; la tradition tardive en fit une déesse. On lui sacrifiait sur un tertre carré, la terre étant carrée et le ciel rond.",
    feima: "Le « cheval volant » est une image de légende. Historiquement, l'empereur Wu des Han fit la guerre au Ferghana pour obtenir des chevaux qui « suaient le sang », qu'on appela chevaux célestes.",
    bashe: "Selon le Shanhaijing, le bashe avale un éléphant et n'en rejette les os qu'au bout de trois ans. Le Huainanzi dit que Hou Yi trancha le serpent Xiushe au lac Dongting ; des textes des Song en font le bashe, dont les os formèrent la colline de Baling.",
    tiangou_noir: "Le Shanhaijing décrit un tiangou à tête blanche, au corps de fauve, inoffensif et capable de repousser le mal. Selon la tradition populaire plus tardive, un chien céleste dévore soleil et lune lors des éclipses, et l'on bat tambours et gongs pour lui faire rendre l'astre.",
    fucanglong: "Le Fucanglong est, dans des traditions tardives, le dragon des trésors souterrains qui garde métaux et pierres précieuses. On raconte ici que les volcans naissent là où il remonte vers le ciel.",
    dilong: "Dilong (地龍), « dragon de la terre », se prête à plusieurs lectures ; c'est aussi le nom chinois du ver de terre. Ici, c'est un dragon fouisseur qui gouverne les eaux souterraines.",
    jing_jing: "Le Baopuzi de Ge Hong enseigne que les choses très anciennes ont des esprits capables de prendre forme humaine, mais qu'un miroir révèle leur vraie forme. Ici, les miroirs de bronze gardent le reflet de ceux qui s'y sont regardés.",
    meng_shou: "Le mo (貘), disent les commentaires de l'Erya, mange le cuivre et le fer ; Bai Juyi, souffrant de la tête, le fit peindre sur le petit paravent qui veillait sur son sommeil. Ici, la bête des rêves s'est mise à dévorer les rêves.",
    wu_shou: "Dans ce monde, les bêtes de brume vivent dans les nuages bas des déserts au petit matin. On ne voit que leurs yeux, et l'on comprend trop tard qu'on est entouré.",
    he_bo: "He Bo, le Comte du Fleuve, exigeait chaque année une épouse jetée au Fleuve Jaune. Le magistrat Ximen Bao mit fin au rite en y jetant les sorciers qui l'organisaient.",
    shui_shen: "Dans la croyance populaire, chaque source et chaque puits abrite un esprit des eaux qu'il convient de ménager. Dans ce monde, on lui jette une pièce avant de boire, pour ne pas tomber malade.",
    jiao: "Jiao (蛟) désigne, selon les textes, un dragon aquatique ou un être des eaux proche du jiaolong. Dans ce monde, c'est sa forme jeune, qui soulève les remous et les crues.",
    bai_she: "Dame Serpent Blanc, après mille ans d'ascèse, épousa le jeune Xu Xian. Le moine Fahai l'emprisonna sous la pagode Leifeng, mais leur amour reste célèbre.",
    heishui_xuan_she: "Le Shanhaijing décrit le pays des Eaux Noires où vivent des serpents noirs. On ne sait jamais où finit l'eau et où commence l'écaille.",
    heilong: "Dans la correspondance des cinq éléments, le noir est la couleur du Nord, de l'hiver et de l'eau ; le dragon noir est ainsi pensé comme un dragon des eaux sombres. Dans ce monde, il dort dans les profondeurs et ne remonte qu'aux jours les plus froids.",
    bailong: "Le Cheval-dragon blanc du Voyage en Occident, roman du XVIe siècle, est un prince-dragon puni, changé en monture pour porter le moine Xuanzang jusqu'en Inde.",
    ao: "Nüwa coupa les pattes de la grande tortue Ao pour soutenir les quatre coins du ciel après que Gonggong eut brisé le mont Buzhou.",
    gui_tortue: "Symbole de longévité, la tortue passe pour vivre mille ans, et sa carapace bombée évoque la voûte du ciel. Sous les Shang, on lisait les fêlures de carapaces chauffées : ces inscriptions divinatoires comptent parmi les plus anciennes écritures chinoises connues.",
    linggui: "Le Yijing dit que le Luo fit surgir un écrit ; la tradition ultérieure en fit une tortue portant sur sa carapace un carré magique, le Luoshu, que le grand Yu aurait médité pour en tirer les neuf catégories de la Grande Règle.",
    xuan_gui: "La grande Tortue noire évoque Xuanwu, gardien du Nord et de l'hiver, souvent représenté comme une tortue entrelacée d'un serpent. Celle-ci n'a pas encore trouvé son serpent.",
    bixi: "Bixi, figure à carapace de tortue rangée dans les listes populaires des fils du Dragon, porte les stèles de pierre des temples et des tombeaux. On raconte ici qu'il soulevait des montagnes avant qu'on lui confie ce fardeau.",
    feiyu: "Les carpes qui remontent la cascade de la Porte du Dragon se changent en dragons. Celles qui échouent recommencent, encore et encore.",
    jiaoyu: "Le poisson-dragon a le corps d'un poisson et la tête d'un dragon. On le place au faîte des toits pour protéger les maisons du feu.",
    yingyu: "Le Shanhaijing (Classique des montagnes de l'Ouest) décrit dans la rivière Meng un poisson à ailes d'oiseau, le 蠃魚, au cri de canard mandarin. Quand il apparaît, sa contrée est submergée par de grandes eaux.",
    mu_mei: "Le folklore prête des esprits aux arbres et aux forêts profondes. Ceux de ce monde prennent l'aspect de jeunes femmes et égarent les bûcherons qui coupent sans demander.",
    mu_gui: "Dans ce monde, quand un arbre meurt sans être abattu, son esprit reste prisonnier de l'écorce. Il gémit les nuits de vent et ses branches attrapent les passants.",
    shan_gui: "Le Shan Gui, célébré dans les Neuf Chants des Chuci (attribués traditionnellement à Qu Yuan), est un esprit des monts vêtu de lianes, qui chevauche une panthère rouge suivie de civettes tachetées.",
    lu_jing: "Dans la tradition populaire, le cerf blanc est la monture des Immortels et un porteur de longévité. Dans ce monde, le cerf lumineux brille la nuit ; le suivre mène aux herbes de jouvence, ou à se perdre.",
    hu_jing: "Le folklore connaît des tigres capables de prendre forme humaine. Ceux de ce monde, dit-on, tiennent auberge au bord des routes.",
    xiong_jing: "Le Démon-ours noir du Voyage en Occident, roman du XVIe siècle, vola la robe du moine Xuanzang. Guanyin le soumit et en fit le gardien de sa montagne.",
    he_jing: "La grue est l'oiseau des Immortels, symbole de longue vie. Elle porte les sages au ciel sur son dos.",
    lang_jing: "Dans ce monde, les loups-esprits rôdent aux frontières et hurlent sur les ruines des tours de guet. Leur nom évoque le Loup céleste (Tianlang), étoile que les Chuci montrent visée par l'arc d'un archer.",
    she_jing: "Un serpent qui vit assez longtemps peut, dans le folklore, devenir esprit et prendre forme humaine, comme Dame Serpent Blanc. Tous ne choisissent pas l'amour.",
    shouling: "Dans ce monde, l'âme d'une bête morte injustement reste attachée à son terrier. Elle prend l'apparence de tous les animaux tués par le même chasseur.",
    jing_shou: "Dans ce monde, on reconnaît les bêtes-esprits à leurs yeux, qui brillent même sans lune. Elles voient les esprits invisibles aux hommes.",
    hanba: "Hanba (旱魃) est un démon de la sécheresse déjà cité dans le Shijing, que les commentateurs assimilent à Nüba du Shanhaijing. Dans ce monde, c'en est une manifestation errante, et non la déesse elle-même : là où il passe, la pluie ne tombe plus.",
    shan_shen: "Chaque montagne a son dieu, et les cinq monts sacrés ont les leurs. Selon le Shiji, les empereurs offraient sur le mont Tai et à ses abords les sacrifices feng au ciel et shan à la terre.",
    qilin: "Le qilin, créature de bon augure, ne foule pas l'herbe vivante. La tradition classique lie son apparition aux sages, et plusieurs récits l'associent à la naissance ou à la mort de Confucius.",
    feng_bo: "Feng Bo, le Comte du Vent, combattit pour Chiyou avec Yu Shi selon le Shanhaijing. Des commentateurs l'identifient au Grand Vent qu'abattit Hou Yi, et des récits tardifs disent que l'archer lui perça le genou.",
    yu_shi: "Yu Shi, le Maître de la Pluie, déchaîna l'orage avec Feng Bo pour Chiyou contre l'Empereur Jaune, selon le Shanhaijing. Nüba sécha cette pluie.",
    dian_mu: "Dian Mu, la Mère des Éclairs, accompagne Lei Gong. On dit qu'elle tient des miroirs pour éclairer sa cible avant qu'il frappe.",
    lei_shou: "Selon le Shanhaijing, le Kui, bête à une seule patte dont la voix est le tonnerre, donna sa peau à l'Empereur Jaune pour un tambour, battu avec un os de la bête du tonnerre (Leishou) et audible à cinq cents li.",
    feng_shou: "Dans ce monde, les bêtes des vents vivent sur les sommets et courent avec les tempêtes. Selon la tradition populaire, Feng Bo garde les vents dans un sac ; elles s'en échappent parfois.",
    yun_shou: "Les bêtes des nuées se cachent dans les nuages d'orage. On aperçoit leurs formes quand on regarde le ciel longtemps.",
    xue_niao: "Les oiseaux des neiges ne descendent des cimes que pour annoncer un hiver terrible. Leur cri fige l'eau des cascades.",
    feilong: "Le dragon volant n'a pas besoin d'ailes : il s'élève en chevauchant les nuages. Les empereurs portaient son image, et « dragon volant au ciel » annonce une ascension.",
    tengshe: "Le Tengshe est un serpent volant qui chevauche la brume. « Bien qu'il chevauche la brume, il finit en poussière », écrivit Cao Cao à propos de la vieillesse.",
    baihu: "Le Tigre blanc garde l'Ouest et l'automne, l'un des quatre symboles de la cosmologie classique. Selon la tradition des présages, son apparition passait pour le signe d'un règne juste.",
    qinglong: "Le Dragon azur garde l'Est et le printemps ; c'est l'un des quatre symboles de la cosmologie classique. La tradition populaire l'associe aux pluies qui font lever les moissons.",
    qiongqi: "Selon le Shanhaijing, Qiongqi est un tigre ailé qui dévore les hommes ; le Zuozhuan range un personnage de ce nom parmi les Quatre Fléaux, et des textes plus tardifs disent qu'il frappe les honnêtes gens et favorise les menteurs.",
    tianma: "Le cheval céleste est, dans la légende, la monture des dieux. Les Han donnèrent aussi ce nom aux chevaux de l'Ouest qu'ils admiraient, sans que les deux traditions se confondent.",
    chiwen: "Le Chiwen, que les listes populaires rangent parmi les fils du Dragon, orne le faîte des toits. On le dit capable d'avaler le feu et de protéger la maison des incendies.",
    pulao: "Pulao, fils du Roi-Dragon, crie fort quand il a peur, surtout des baleines. On le sculpte sur les cloches, et le maillet a la forme d'une baleine.",
    bai_ze: "Selon la tradition populaire, Bai Ze rencontra l'Empereur Jaune au bord de la mer et lui décrivit 11 520 espèces de démons, que l'empereur fit consigner dans un recueil illustré. Les chiffres varient selon les sources.",
    bai_ze_savant: "Selon la tradition populaire, Bai Ze connaît tous les esprits et sait les nommer ; on portait son image pour s'en protéger. Dans ce monde, celui-ci met les voyageurs à l'épreuve de ses questions.",
    zouyu: "Selon le commentaire du Shijing, le Zouyu est un tigre blanc aux rayures noires qui ne mange aucun être vivant ; le Shanhaijing décrit une bête de cinq couleurs à la queue plus longue que le corps. Il paraît sous les règnes vertueux.",
    xiezhi: "Le Xiezhi, à une seule corne, distingue le coupable de l'innocent et frappe le menteur. Son image ornait les coiffes des juges.",
    bixie: "Le Bixie, bête ailée qui repousse le mal, était sculpté le long des allées funéraires, notamment sous les Six Dynasties. Ses représentations se confondent souvent avec celles du Tianlu.",
    tianlu: "Tianlu, la « Fortune céleste », est l'une des bêtes protectrices cornues des allées funéraires, proches du Bixie et du Pixiu dont les images se confondent souvent. On l'associe à la chance.",
    tianlu_gardien: "Les bêtes protectrices des portes, Tianlu, Bixie ou Pixiu selon les régions et les époques, se ressemblent beaucoup. Ces gardiens-ci veillent deux à deux devant les palais.",
    pixiu_tresor: "Le Pixiu, bête protectrice, dévore les richesses sans jamais les rendre. Les marchands portent encore son image pour retenir leur fortune.",
    bian: "Bi'an (狴犴), compté dans les listes populaires des fils du Dragon, est associé à la justice. Son image orne les portes des tribunaux et des prisons.",
    fuxi_dragon: "Selon le Liezi, Fuxi avait un corps de serpent et une tête humaine, et la légende lui attribue les huit trigrammes. Ici, un fils du dragon porte ces trigrammes sur ses écailles : une création de cette légende.",
    chaofeng: "Chaofeng, fils du Roi-Dragon, aime le danger et les hauteurs. Il guette sur l'arête des toits des palais.",
    longma: "Selon la tradition des commentateurs Han, un cheval-dragon sortit du Fleuve Jaune avec un dessin sur le dos, le Hetu, dont Fuxi aurait tiré les huit trigrammes.",
    taotie_bronze: "Le masque dit taotie, une gueule sans corps, orne les bronzes rituels des Shang ; ce nom ne lui fut donné que plus tard, d'après le Lüshi chunqiu, qui y lit une leçon contre la gloutonnerie.",
    taotie_bete: "Selon le Lüshi chunqiu, le Taotie n'est qu'une tête sans corps, dont la gloutonnerie finit par se retourner contre lui. Le Zuozhuan nomme aussi un Taotie parmi les Quatre Fléaux.",
    jiuweihu: "Le renard à neuf queues du mont Qingqiu dévore les hommes. Mais celui qui mange sa chair devient immunisé contre les sortilèges.",
    xiangliu: "Selon le Shanhaijing, Xiangliu, ministre de Gonggong, a neuf têtes humaines sur un corps de serpent ; son sang rend la terre stérile. Yu le tua, mais le sol, comblé à trois reprises, s'effondra et devint un étang.",
    nian: "Selon une légende populaire répandue surtout à l'époque moderne, le Nian sortait à la veille du Nouvel An pour dévorer bétail et enfants. Il craignait le rouge, le feu et le bruit : d'où les lanternes et les pétards.",
    kuafu_geant: "Le géant Kuafu poursuivit le soleil ; assoiffé, il but le Fleuve Jaune et la rivière Wei sans se désaltérer. Il mourut, et son bâton devint une forêt de pêchers.",
    xingtian: "Selon le Shanhaijing, Xingtian disputa le trône divin à l'Empereur (que la tradition tardive identifie à l'Empereur Jaune), qui lui trancha la tête. Sans tête, il continua le combat, des seins pour yeux et un nombril pour bouche, brandissant bouclier et hache.",
    hai_ruo: "Hai Ruo, dieu de la mer du Nord, montra au Comte du Fleuve, selon Zhuangzi, que ses eaux n'étaient rien face à l'océan.",
    hai_shen: "Selon le Shanhaijing, Yuqiang, dieu de la mer du Nord, a un visage humain et un corps d'oiseau ; il porte deux serpents verts aux oreilles et foule deux serpents rouges. Dans ce monde, les dieux de la mer commandent les vents marins.",
    hai_gui: "Les tortues des récifs gardent les entrées des palais sous-marins. Les pêcheurs qui en voient une nager vers eux font demi-tour.",
    hai_she: "Le serpent des tourbillons tourne sur lui-même au fond des mers et crée les vortex qui avalent les jonques.",
    ren_yu: "Les jiaoren, ou gens-poissons, vivent au fond des mers du Sud. Ils tissent une soie qui ne se mouille pas, et leurs larmes se changent en perles.",
    kun: "Zhuangzi décrit le Kun, poisson de la mer du Nord dont on ne sait combien de milliers de li il mesure. Il se transforme en oiseau Peng et s'envole vers le Sud.",
    xuanwu: "Xuanwu, la Tortue noire enlacée d'un serpent, garde le Nord et l'hiver. Elle devint plus tard un dieu taoïste, le Guerrier sombre.",
    longwang: "Les quatre Rois-Dragons gouvernent les mers et la pluie depuis des palais de cristal. Sun Wukong vola au Roi de la mer de l'Est son bâton magique.",
    panlong: "Selon les anciens lexiques, le panlong est le dragon lové qui n'est pas encore monté au ciel. On le sculpte enroulé autour des colonnes ; dans ce monde, il dort au fond des eaux.",
    shenlong: "Le Shenlong, dragon divin, commande au vent et à la pluie. Les paysans lui adressent leurs prières lors des sécheresses.",
    long: "Selon une liste attribuée à Wang Fu (Han), le dragon réunit neuf ressemblances : tête de chameau, cornes de cerf, yeux de démon (ou de lièvre selon les versions), cou de serpent, ventre de mollusque, écailles de carpe, griffes d'aigle, pattes de tigre et oreilles de bœuf.",
    jinwu: "Selon le Shanhaijing, les dix soleils se reposent dans le mûrier Fusang et se relaient chaque jour, chacun porté par un corbeau d'or. Un jour, ils sortirent tous ensemble, et la terre se mit à brûler.",
    sanzu_wu: "Le corbeau à trois pattes vit dans le soleil. Hou Yi abattit neuf des dix corbeaux, et l'on retrouva leurs plumes au sol.",
    fenghuang: "Le Fenghuang n'apparaît qu'en temps de paix, dit la tradition classique. Le Zhuangzi prête au yuanchu, oiseau voisin du phénix, de ne se poser que sur le sterculier, de ne manger que des fruits du bambou et de ne boire qu'à la source douce.",
    qingniao: "Selon le Shanhaijing, trois oiseaux bleus servent la Reine Mère de l'Ouest et lui cherchent sa nourriture. La tradition postérieure en fait ses messagers, annonçant sa venue ; ici, ils portent aussi ses lettres aux souverains.",
    ruiniao: "Dans ce monde, les oiseaux de bon augure se posent sur le toit des justes, et leur chant annonce une naissance heureuse. La tradition chinoise connaît bien les oiseaux de présage, mais celui-ci est une création de cette légende.",
    peng: "Selon le Zhuangzi, le Peng naît du poisson Kun. Son dos s'étend sur des milliers de li, ses ailes sont comme des nuages qui pendent du ciel, et il s'élève par un tourbillon à quatre-vingt-dix mille li.",
    ming_niao: "Dans ce monde, les oiseaux des ténèbres volent la nuit et guident les âmes perdues ; leur cri annonce un deuil dans la maison. C'est une création de cette légende, nourrie des nombreux oiseaux de présage de la tradition chinoise.",
    guai_niao: "Le Shanhaijing décrit nombre d'oiseaux à visage humain, dont chacun annonce un fléau propre : sécheresse, exil, guerre. Le guai niao est ici une figure composite de cette légende, dont le cri d'enfant glace les villages.",
    kuafu: "Kua Fu courut après le soleil pour le capturer. Il mourut de soif ; son bâton devint une forêt de pêchers.",
    shennong: "Shennong, le Divin Laboureur, enseigna l'agriculture et goûta cent herbes en un jour pour connaître leurs vertus, s'empoisonnant soixante-dix fois.",
    huangdi: "Huangdi, l'Empereur Jaune, vainquit Chiyou selon la tradition et passe pour l'ancêtre mythique des Chinois. Le Shiji raconte qu'il monta au ciel sur un dragon venu le chercher.",
    zhulong_torche: "Selon le Shanhaijing, Zhulong, le Dragon-torche, éclaire le monde : le jour quand il ouvre les yeux, la nuit quand il les ferme. Quand il souffle, c'est l'hiver ; quand il expire doucement, c'est l'été.",
    yingzhao_cheval: "Yingzhao garde le jardin suspendu de l'Empereur céleste. Il a un corps de cheval, un visage humain, des rayures de tigre et des ailes.",
    yutu: "Le lièvre de jade vit sur la Lune avec Chang'e et pile l'élixir d'immortalité dans un mortier. On voit son ombre les nuits de pleine lune.",
    gui_po: "Dans ce monde, la vieille aux longs cheveux se tient sous les saules au bord de l'eau. Elle peigne sa chevelure grise et attire les enfants qui s'approchent trop : une création de cette légende, nourrie des fantômes d'eau du folklore.",
    nu_gui: "Les femmes mortes injustement reviennent, cheveux défaits et robe blanche, réclamer justice. Le juge Bao, dit-on, savait les écouter.",
    diaosi_gui: "Le fantôme du pendu porte une langue pendante et une corde. Il souffle aux désespérés de se pendre, afin d'être libéré.",
    yuan_gui: "Selon la croyance populaire, l'esprit vengeur s'attache à celui qui lui a causé du tort, jusqu'à obtenir réparation. Dans ce monde, seuls des rites et des excuses sincères peuvent l'apaiser.",
    heibai_wuchang: "Les Impermanents noir et blanc escortent les âmes des morts vers les enfers. Le blanc souhaite fortune, le noir annonce la paix : rencontrer l'un ou l'autre est rarement bon signe.",
    nuwa: "Nüwa façonna les hommes avec de la glaise jaune. Quand le ciel se brisa, elle le répara avec des pierres de cinq couleurs fondues.",
    fuxi: "Fuxi, selon la tradition, inventa les huit trigrammes, les filets de chasse et de pêche. Les textes tardifs en font le frère et l'époux de Nüwa, tous deux au corps de serpent sous un buste humain.",
    yayu: "Selon le Shanhaijing, Yayu fut tué par les sujets d'Erfu puis, ressuscité, devint un monstre à tête de dragon qui dévore les hommes. Selon le Huainanzi, Hou Yi le tua sur ordre de l'empereur Yao.",
    feiyi: "Selon le Shanhaijing, le Feiyi est un serpent à six pattes et quatre ailes ; une autre version lui prête une tête et deux corps. Là où il apparaît, une grande sécheresse s'abat. Le jeu le représente à deux têtes.",
    yingzhao_ailee: "Selon le Shanhaijing, Yingzhao veille sur le jardin suspendu de l'Empereur céleste et parcourt les quatre mers. Dans ce monde, cet esprit ailé y porte aussi les ordres du souverain.",
    tiangou_lune: "Selon la tradition populaire, le Chien céleste dévore la lune lors des éclipses. Le Shanhaijing connaît un tiangou différent, bête protectrice. Dans ce monde, il rôde au Pic de la Lune et guette l'astre, la gueule ouverte, en attendant une nuit sans veilleur."
};

// Provenance de chaque créature : texte classique, folklore plus tardif, ou adaptation propre au jeu.
export const SOURCE_LABELS = {
    classique: 'Texte classique',
    folklore: 'Folklore',
    adaptation: 'Adaptation du jeu'
};

// Rempli à partir de la relecture des notices ; une créature absente compte comme « adaptation ».
export const BESTIARY_SOURCE = Object.fromEntries(Object.entries({
    classique: ['jing_jing', 'yinglong', 'chiyou', 'gui_esprit', 'hundun', 'crapaud_boue', 'jiaolong', 'loup_braise', 'jingwei', 'she_shen', 'xuan_she', 'huo_shen', 'bi_fang', 'nuba', 'zhuque', 'zhulong_serpent', 'dijiang', 'mei', 'wangliang', 'wangxiang', 'houtu', 'feima', 'bashe', 'he_bo', 'jiao', 'heishui_xuan_she', 'ao', 'gui_tortue', 'linggui', 'xuan_gui', 'yingyu', 'shan_gui', 'hanba', 'shan_shen', 'qilin', 'feng_bo', 'yu_shi', 'lei_shou', 'feilong', 'tengshe', 'baihu', 'qinglong', 'qiongqi', 'tianma', 'zouyu', 'xiezhi', 'longma', 'taotie_bronze', 'taotie_bete', 'jiuweihu', 'xiangliu', 'kuafu_geant', 'xingtian', 'hai_ruo', 'hai_shen', 'kun', 'xuanwu', 'panlong', 'long', 'jinwu', 'sanzu_wu', 'fenghuang', 'qingniao', 'peng', 'kuafu', 'shennong', 'huangdi', 'zhulong_torche', 'yingzhao_cheval', 'nuwa', 'fuxi', 'yayu', 'feiyi', 'yingzhao_ailee'],
    folklore: ['jiangshi', 'suanni', 'huli_jing', 'shu_jing', 'wen_shen', 'lei_gong', 'shanxiao', 'tigre_embrase', 'sanglier_flammes', 'hua_jing', 'huli_commun', 'shuihou', 'shui_gui', 'qing_she', 'du_she', 'yazi', 'shi_jing', 'tiangou_noir', 'fucanglong', 'meng_shou', 'shui_shen', 'bai_she', 'heilong', 'bailong', 'bixi', 'feiyu', 'jiaoyu', 'mu_mei', 'hu_jing', 'xiong_jing', 'he_jing', 'she_jing', 'dian_mu', 'chiwen', 'pulao', 'bai_ze', 'bai_ze_savant', 'bixie', 'tianlu', 'pixiu_tresor', 'bian', 'chaofeng', 'nian', 'ren_yu', 'longwang', 'shenlong', 'yutu', 'nu_gui', 'diaosi_gui', 'yuan_gui', 'heibai_wuchang', 'tiangou_lune'],
    adaptation: ['canglong', 'chilong', 'assassin_masque', 'lettre_sorcier', 'pixiu', 'pretresse_lunaire', 'soldat_terre_cuite', 'lingzhi_maudit', 'dame_des_neiges', 'gui_guerrier', 'garde_solaire', 'immortel_jade', 'cao_jing', 'zu_xian', 'huo_shou', 'chi_niao', 'dilong', 'wu_shou', 'mu_gui', 'lu_jing', 'lang_jing', 'shouling', 'jing_shou', 'feng_shou', 'yun_shou', 'xue_niao', 'tianlu_gardien', 'fuxi_dragon', 'hai_gui', 'hai_she', 'ruiniao', 'ming_niao', 'guai_niao', 'gui_po'],
}).flatMap(([source, ids]) => ids.map(id => [id, source])));

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
