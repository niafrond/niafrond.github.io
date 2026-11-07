// Noms du bestiaire : pinyin avec tons, caractères chinois et épithète française de chaque gabarit d'ennemi (enemies.catalog.json).
// Affichage « Bái Zé (白泽) » puis « 白泽 · Bête de la connaissance » : uniquement dans le bestiaire (carnet et soluce) ;
// les noms de combat (`template.name`) ne changent pas. Entrée : id → [pinyin, hanzi] ou [pinyin, hanzi, épithète] (sinon `template.title`).
// Les noms inventés par cette légende (soldats, maîtres d'arène…) reçoivent un nom chinois plausible, à l'image de leur rôle.
export const BESTIARY_NAMES = {
    canglong: ['Cāng Lóng', '苍龙'], chilong: ['Chī Lóng', '螭龙'], jiangshi: ['Jiāng Shī', '僵尸'], yinglong: ['Yìng Lóng', '应龙'],
    chiyou: ['Chī Yóu', '蚩尤'], suanni: ['Suān Ní', '狻猊'], gui_esprit: ['Guǐ', '鬼'], huli_jing: ['Hú Lí Jīng', '狐狸精'],
    hundun: ['Hùn Dùn', '混沌'], assassin_masque: ['Méng Miàn Cì Kè', '蒙面刺客'], shu_jing: ['Shù Jīng', '树精'],
    lettre_sorcier: ['Shū Shēng Wū Shī', '书生巫师'], pixiu: ['Pí Xiū', '貔貅'], pretresse_lunaire: ['Yuè Wū Nǚ', '月巫女'],
    soldat_terre_cuite: ['Táo Yǒng Bīng', '陶俑兵'], wen_shen: ['Wēn Shén', '瘟神'], lei_gong: ['Léi Gōng', '雷公'],
    lingzhi_maudit: ['Líng Zhī Yāo', '灵芝妖'], crapaud_boue: ['Ní Chán', '泥蟾'], dame_des_neiges: ['Xuě Niáng', '雪娘'],
    gui_guerrier: ['Guǐ Zú', '鬼卒'], garde_solaire: ['Rì Wèi', '日卫'], jiaolong: ['Jiāo Lóng', '蛟龙'], immortel_jade: ['Yù Xiān', '玉仙'],
    shanxiao: ['Shān Xiāo', '山魈'], tigre_embrase: ['Yán Hǔ', '炎虎'], sanglier_flammes: ['Huǒ Zhū', '火猪'], loup_braise: ['Jìn Láng', '烬狼'],
    cao_jing: ['Cǎo Jīng', '草精'], hua_jing: ['Huā Jīng', '花精'], huli_commun: ['Hú Lí', '狐狸'], shuihou: ['Shuǐ Hóu', '水猴'],
    shui_gui: ['Shuǐ Guǐ', '水鬼'], qing_she: ['Qīng Shé', '青蛇'], jingwei: ['Jīng Wèi', '精卫'], she_shen: ['Shè Shén', '社神'],
    zu_xian: ['Zǔ Xiān', '祖先'], du_she: ['Dú Shé', '毒蛇'], xuan_she: ['Xuán Shé', '玄蛇'], huo_shen: ['Huǒ Shén', '火神'],
    huo_shou: ['Huǒ Shòu', '火兽'], chi_niao: ['Chì Niǎo', '赤鸟'], bi_fang: ['Bì Fāng', '毕方'], nuba: ['Nǚ Bá', '女魃'],
    zhuque: ['Zhū Què', '朱雀'], zhulong_serpent: ['Zhú Lóng', '烛龙'], dijiang: ['Dì Jiāng', '帝江'], yazi: ['Yá Zì', '睚眦'],
    mei: ['Mèi', '魅'], wangliang: ['Wǎng Liǎng', '魍魉'], wangxiang: ['Wǎng Xiàng', '罔象'], shi_jing: ['Shí Jīng', '石精'],
    houtu: ['Hòu Tǔ', '后土'], feima: ['Fēi Mǎ', '飞马'], bashe: ['Bā Shé', '巴蛇'], tiangou_noir: ['Tiān Gǒu', '天狗'],
    fucanglong: ['Fú Zàng Lóng', '伏藏龙'], dilong: ['Dì Lóng', '地龙'], jing_jing: ['Qì Jīng', '器精'], meng_shou: ['Mèng Shòu', '梦兽'],
    wu_shou: ['Wù Shòu', '雾兽'], he_bo: ['Hé Bó', '河伯'], shui_shen: ['Shuǐ Shén', '水神'], jiao: ['Jiāo', '蛟'],
    bai_she: ['Bái Shé', '白蛇'], heishui_xuan_she: ['Hēi Shuǐ Xuán Shé', '黑水玄蛇'], heilong: ['Hēi Lóng', '黑龙'], bailong: ['Bái Lóng', '白龙'],
    ao: ['Áo', '鳌'], gui_tortue: ['Guī', '龟'], linggui: ['Líng Guī', '灵龟'], xuan_gui: ['Xuán Guī', '玄龟'], bixi: ['Bì Xì', '赑屃'],
    feiyu: ['Fēi Yú', '飞鱼'], jiaoyu: ['Jiāo Yú', '蛟鱼'], yingyu: ['Yīng Yú', '鹰鱼'], mu_mei: ['Mù Mèi', '木魅'], mu_gui: ['Mù Guǐ', '木鬼'],
    shan_gui: ['Shān Guǐ', '山鬼'], lu_jing: ['Lù Jīng', '鹿精'], hu_jing: ['Hǔ Jīng', '虎精'], xiong_jing: ['Xióng Jīng', '熊精'],
    he_jing: ['Hè Jīng', '鹤精'], lang_jing: ['Láng Jīng', '狼精'], she_jing: ['Shé Jīng', '蛇精'], shouling: ['Shòu Líng', '兽灵'],
    jing_shou: ['Jīng Shòu', '精兽'], hanba: ['Hàn Bá', '旱魃'], shan_shen: ['Shān Shén', '山神'], qilin: ['Qí Lín', '麒麟'],
    feng_bo: ['Fēng Bó', '风伯'], yu_shi: ['Yǔ Shī', '雨师'], dian_mu: ['Diàn Mǔ', '电母'], lei_shou: ['Léi Shòu', '雷兽'],
    feng_shou: ['Fēng Shòu', '风兽'], yun_shou: ['Yún Shòu', '云兽'], xue_niao: ['Xuě Niǎo', '雪鸟'], feilong: ['Fēi Lóng', '飞龙'],
    tengshe: ['Téng Shé', '螣蛇'], baihu: ['Bái Hǔ', '白虎'], qinglong: ['Qīng Lóng', '青龙'], qiongqi: ['Qióng Qí', '穷奇'],
    tianma: ['Tiān Mǎ', '天马'], chiwen: ['Chī Wěn', '螭吻'], pulao: ['Pú Láo', '蒲牢'], bai_ze: ['Bái Zé', '白泽'],
    bai_ze_savant: ['Bái Zé', '白泽', 'Bête de la connaissance'], zouyu: ['Zōu Yú', '驺虞'], xiezhi: ['Xiè Zhì', '獬豸'],
    bixie: ['Bì Xié', '辟邪'], tianlu: ['Tiān Lù', '天禄'], tianlu_gardien: ['Tiān Lù', '天禄'], pixiu_tresor: ['Pí Xiū', '貔貅'],
    bian: ['Bì Àn', '狴犴'], fuxi_dragon: ['Fù Xì', '负屃'], chaofeng: ['Cháo Fēng', '嘲风'], longma: ['Lóng Mǎ', '龙马'],
    taotie_bronze: ['Tāo Tiè', '饕餮'], taotie_bete: ['Tāo Tiè', '饕餮'], jiuweihu: ['Jiǔ Wěi Hú', '九尾狐'], xiangliu: ['Xiāng Liǔ', '相柳'],
    nian: ['Nián', '年'], kuafu_geant: ['Kuā Fù', '夸父'], xingtian: ['Xíng Tiān', '刑天'], hai_ruo: ['Hǎi Ruò', '海若'],
    hai_shen: ['Hǎi Shén', '海神'], hai_gui: ['Hǎi Guī', '海龟'], hai_she: ['Hǎi Shé', '海蛇'], ren_yu: ['Rén Yú', '人鱼'], kun: ['Kūn', '鲲'],
    xuanwu: ['Xuán Wǔ', '玄武'], longwang: ['Lóng Wáng', '龙王'], panlong: ['Pán Lóng', '蟠龙'], shenlong: ['Shén Lóng', '神龙'],
    long: ['Lóng', '龙'], jinwu: ['Jīn Wū', '金乌'], sanzu_wu: ['Sān Zú Wū', '三足乌'], fenghuang: ['Fèng Huáng', '凤凰'],
    qingniao: ['Qīng Niǎo', '青鸟'], ruiniao: ['Ruì Niǎo', '瑞鸟'], peng: ['Péng', '鹏'], ming_niao: ['Míng Niǎo', '冥鸟'],
    guai_niao: ['Guài Niǎo', '怪鸟'], kuafu: ['Kuā Fù', '夸父'], shennong: ['Shén Nóng', '神农'], huangdi: ['Huáng Dì', '黄帝'],
    zhulong_torche: ['Zhú Lóng', '烛龙'], yingzhao_cheval: ['Yīng Zhāo', '英招'], yutu: ['Yù Tù', '玉兔'], gui_po: ['Guǐ Pó', '鬼婆'],
    nu_gui: ['Nǚ Guǐ', '女鬼'], diaosi_gui: ['Diào Sǐ Guǐ', '吊死鬼'], yuan_gui: ['Yuān Guǐ', '冤鬼'],
    heibai_wuchang: ['Hēi Bái Wú Cháng', '黑白无常'], nuwa: ['Nǚ Wā', '女娲'], fuxi: ['Fú Xī', '伏羲'], yayu: ['Yà Yǔ', '窫窳'],
    feiyi: ['Féi Yí', '肥遗'], yingzhao_ailee: ['Yīng Zhāo', '英招'], tiangou_lune: ['Tiān Gǒu', '天狗'], changxi: ['Cháng Xī', '常羲'],
    // Les dix soleils
    sun_1: ['Liè Rì', '烈日'], sun_2: ['Hàn Rì', '旱日'], sun_3: ['Huī Rì', '灰日'], sun_4: ['Shèn Rì', '蜃日'], sun_5: ['Léi Rì', '雷日'],
    sun_6: ['Yán Jiāng Rì', '岩浆日'], sun_7: ['Kuáng Rì', '狂日'], sun_8: ['Cháo Rì', '潮日'], sun_9: ['Qiè Rì', '怯日'],
    // Ennemis nommés
    fengmeng_1: ['Féng Méng', '逢蒙', 'Le Disciple, élève jaloux de Hou Yi'],
    fengmeng_2: ['Féng Méng', '逢蒙', "L'Archer pressé, rival de la route du Volcan"],
    fengmeng_3a: ['Féng Méng', '逢蒙', "L'Archer miroir, voleur d'élixir"],
    fengmeng_3b: ['Féng Méng', '逢蒙', 'Rage et désespoir, disciple brisé'],
    maitresse_tong: ['Tóng Shī', '铜师'], maitre_hong_gang: ['Hóng Gāng', '洪罡'], maitre_tie_bi: ['Tiě Bì', '铁臂'],
    dame_yin_yue: ['Yín Yuè', '银月'], seigneur_jin_long: ['Jīn Lóng', '金龙'], dame_bi_yu: ['Bì Yù', '碧玉'],
    immortel_yun_zhong: ['Yún Zhōng Jūn', '云中君'], grand_maitre_qian_jian: ['Qiān Jiàn', '千箭'],
    noye_garde: ['Nì Shuǐ Wèi', '溺水卫'], esprit_cloche: ['Zhōng Líng', '钟灵'], foudre_garde: ['Léi Wèi', '雷卫'],
    forgeron_magma: ['Yán Jiāng Jiàng', '岩浆匠'], forgeron_lave: ['Róng Yán Jiàng', '熔岩匠'], garde_maree: ['Cháo Wèi', '潮卫'],
    grue_lige: ['Hè Shǐ', '鹤使'], brigand_sables: ['Shā Fěi', '沙匪'], chef_de_dune: ['Shā Tóu Lǐng', '沙头领'],
    petit_gui: ['Xiǎo Guǐ', '小鬼'], corbeau_demon: ['Wū Yāo', '乌妖'], singe_demon: ['Hóu Yāo', '猴妖'], taureau_braise: ['Jìn Niú', '烬牛'],
    crabe_soldat: ['Xiè Bīng', '蟹兵'], carpe_doree: ['Jīn Lǐ', '金鲤'], tortue_dragon: ['Lóng Guī', '龙龟'],
    shuimu_denglong: ['Shuǐ Mǔ Dēng', '水母灯'], baoyu_jian: ['Bào Yǔ Jiàn Yú', '暴雨剑鱼'], lu_ci_gui: ['Lú Cí Guǐ', '鸬鹚鬼'],
    hai_ma_xing: ['Hǎi Mǎ Qiāng Bīng', '海马枪兵']
};

// { pinyin, hanzi, heading: « Bái Zé (白泽) », subtitle: « 白泽 · Bête de la connaissance » } ; sans entrée : nom et titre du gabarit.
export function beastLabel(template) {
    const n = BESTIARY_NAMES[template.id];
    const title = (n && n[2]) || template.title || '';
    if (!n) return { pinyin: '', hanzi: '', heading: template.name, subtitle: title };
    return { pinyin: n[0], hanzi: n[1], heading: `${n[0]} (${n[1]})`, subtitle: [n[1], title].filter(Boolean).join(' · ') };
}

// Nom de l'ennemi dans la barre de stats du combat : caractères (asHanzi) ou pinyin ; sans entrée, le nom du gabarit.
export const enemyNameLabel = (e, asHanzi = true) => BESTIARY_NAMES[e?.templateId]?.[asHanzi ? 1 : 0] || e?.name || '';
