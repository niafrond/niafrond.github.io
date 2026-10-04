// Icônes pixel art du jeu (12 x 12) : le jeu n'affiche AUCUN emoji. Chaque emoji encore présent dans les textes
// ou les données est remplacé à l'affichage par l'icône pixel de même sens (EMOJI_ICON), ou retiré s'il n'en a pas
// (simple ornement). pixelText.js applique ce remplacement au DOM ; les canvas (exploration, carte du monde)
// dessinent directement ces icônes.
//
// Format : grille de 12 lignes de 12 caractères ; « . » = transparent, les autres lettres = couleurs de PAL
// (palette commune, contour #2b1b17 comme les sprites des personnages). `pal` surcharge la palette (variantes).

export const PAL = {
    k: '#2b1b17', w: '#fff8e1', l: '#d1d5db', s: '#9ca3af', S: '#4b5563',
    y: '#facc15', Y: '#b8860b', o: '#f59e0b', r: '#e0262b', R: '#8b1a1a', p: '#f9a8d4',
    g: '#4ade80', G: '#15803d', b: '#38bdf8', B: '#1d4ed8', c: '#a5f3fc',
    v: '#a855f7', V: '#6b21a8', n: '#a16207', N: '#5a3e1b', t: '#e6d29a', T: '#c9a46b', m: '#f3d1b0',
    x: '#facc15', X: '#b8860b'   // or : pièce de mana jaune, médaille d'or ; les variantes changent x / X
};

const ICONS = {
    coin: ['...kkkkkk...', '..kyyyyyyk..', '.kyywwyyyYk.', '.kywyyyyyYk.', 'kyyyykkyyyYk', 'kyyykyykyyYk',
        'kyyykyykyyYk', 'kyyyykkyyyYk', '.kyyyyyyyYk.', '.kYyyyyyYYk.', '..kYYYYYYk..', '...kkkkkk...'],
    star: ['.....kk.....', '....kyyk....', '....kyyk....', 'kkkkkyykkkkk', 'kyyyywyyyyyk', '.kyyywyyyyk.',
        '..kyyyyyyk..', '..kyyyyyyk..', '.kyyyykyyyk.', '.kyyk..kyyk.', 'kyyk....kyyk', 'kkk......kkk'],
    sparkle: ['.....k......', '....kyk.....', '....kyk.....', '..kkkykkk...', '.kyyywyyyk..', '..kkkykkk...',
        '....kyk..k..', '....kyk.kyk.', '.....k.kywyk', '.........kyk', '..........k.', '............'],
    heart: ['............', '.kkk....kkk.', 'krrrk..krrrk', 'krwrrkkrrrrk', 'krwrrrrrrrrk', 'krrrrrrrrrRk',
        '.krrrrrrrRk.', '..krrrrrRk..', '...krrrRk...', '....krRk....', '.....kk.....', '............'],
    skull: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', 'kwwwwwwwwwlk', 'kwkkwwwkkwlk', 'kwkkwwwkkwlk',
        'kwwwwkwwwwlk', '.kwwwwwwwlk.', '..kwkwkwlk..', '..kwkwkwlk..', '...kkkkkk...', '............'],
    arrow: ['.......kkkk.', '........kssk', '.......ksssk', '......knkssk', '.....knk.kk.', '....knk.....',
        '...knk......', '..knk.......', 'krnk........', 'krrk........', 'kkrk........', '.kk.........'],
    bow: ['..kkk.......', '.knNk.......', 'knk.kk......', 'kn...kk.....', 'kn....kk....', 'kn.....kk...',
        'kn.....kk...', 'kn....kk....', 'kn...kk.....', 'knk.kk......', '.knNk.......', '..kkk.......'],
    swords: ['k..........k', 'lk........kl', '.lk......kl.', '..lk....kl..', '...lk..kl...', '....lkkl....',
        '....kllk....', '...kl..lk...', '.kkk....kkk.', '.knk....knk.', 'knk......knk', 'kk........kk'],
    sword: ['.........kk.', '........kwk.', '.......kwlk.', '......kwlk..', '.....kwlk...', '....kwlk....',
        '.k.kwlk.....', '.kkklk......', '..kyk.......', '.knkkk......', 'knk..k......', 'kk..........'],
    shield: ['.kkkkkkkkkk.', 'kbbbbkkbbbbk', 'kbccbkkbbbBk', 'kbcbbkkbbbBk', 'kkkkkyykkkkk', 'kkkkkyykkkkk',
        'kbbbbkkbbbBk', '.kbbbkkbbBk.', '.kbbbkkbbBk.', '..kbbkkbBk..', '...kbkkBk...', '....kkkk....'],
    axe: ['....kkkk....', '...kllllk...', '..klwllllk..', '..kllkkllk..', '..klk.nklk..', '...k..nk.k..',
        '......nk....', '......nk....', '......nk....', '......nk....', '......Nk....', '......kk....'],
    pick: ['..kkkkkkkk..', '.klllllllllk', 'kllkknkkklk.', 'kk...nk..kk.', '.....nk.....', '.....nk.....',
        '.....nk.....', '.....nk.....', '.....nk.....', '.....nk.....', '.....Nk.....', '.....kk.....'],
    lock: ['....kkkk....', '...kssssk...', '..ksk..ksk..', '..ksk..ksk..', '..ksk..ksk..', '.kkkkkkkkkk.',
        '.kyyyyyyyYk.', '.kyyykkyyYk.', '.kyyykkyyYk.', '.kyyyykyyYk.', '.kYYYYYYYYk.', '.kkkkkkkkkk.'],
    unlock: ['....kkkk....', '...kssssk...', '..ksk..ksk..', '..ksk..ksk..', '.......ksk..', '.kkkkkkkkkk.',
        '.kgggggggGk.', '.kgggkkggGk.', '.kgggkkggGk.', '.kggggkggGk.', '.kGGGGGGGGk.', '.kkkkkkkkkk.'],
    chest: ['............', '..kkkkkkkk..', '.knnnnnnnnk.', 'knNNNNNNNNnk', 'knnnnnnnnnnk', 'kkkkkyykkkkk',
        'knnnkyykknnk', 'knnnnkknnnnk', 'knnnnnnnnnnk', 'kNNNNNNNNNNk', 'kkkkkkkkkkkk', '............'],
    gift: ['...kk..kk...', '..krrkkrrk..', '...kkrrkk...', 'kkkkkrrkkkkk', 'kbbbbrrbbbbk', 'kkkkkrrkkkkk',
        '.kbbbrrbbbk.', '.kbbbrrbbbk.', '.kbbbrrbbbk.', '.kBBBrrBBBk.', '.kkkkkkkkkk.', '............'],
    scroll: ['.kkkkkkkkk..', 'ktTtttttttk.', 'kTkttttttttk', '.ktkkkkktTk.', '.kttttttttk.', '.ktkkkkkttk.',
        '.kttttttttk.', '.ktkkkkkktk.', '.kttttttttk.', 'kkttttttttTk', 'ktTkkkkkkkk.', '.kk.........'],
    book: ['.kkkkkkkkkk.', 'kRrrrrrrrrrk', 'kRrryyyyrrrk', 'kRrrrrrrrrrk', 'kRrryyyyrrrk', 'kRrrrrrrrrrk',
        'kRrrrrrrrrrk', 'kRrrrrrrrrrk', 'kRkkkkkkkkkk', 'kRkwwwwwwwwk', '.kkkkkkkkkkk', '............'],
    map: ['............', 'kkkk.kkkk.kk', 'ktTkkTttkkTk', 'kttTttTttTtk', 'ktgttTtrtTtk', 'kggtTttktTtk',
        'kgtgTtttrTtk', 'kttTttkttTbk', 'ktTttTttkbbk', 'kTkkkTkkkkkk', 'kk..kk......', '............'],
    bag: ['....kkkk....', '...kN..Nk...', '..kkkkkkkk..', '.knnnnnnnnk.', 'knnnnnnnnnnk', 'knnkkkkkknnk',
        'knnkyyyyknnk', 'knnkkkkkknnk', 'knnnnnnnnnnk', 'kNnnnnnnnnNk', '.kNNNNNNNNk.', '..kkkkkkkk..'],
    trophy: ['.kkkkkkkkkk.', 'kkyywyyyyykk', 'kykyywyyykyk', 'kykyyyyyykyk', '.kkyyyyyykk.', '...kyyyyk...',
        '....kyyk....', '.....yy.....', '....kYYk....', '...kyyyyk...', '..kkkkkkkk..', '............'],
    medal: ['.kkk...kkk..', '.kbbk.kbbk..', '..kbbkbbk...', '...kbbbk....', '...kkkkk....', '..kxxxxxk...',
        '.kxxwxxxXk..', '.kxwxxxxXk..', '.kxxxxxxXk..', '.kxxxxxXXk..', '..kXXXXXk...', '...kkkkk....'],
    crown: ['............', 'k....k....k.', 'kk..kyk..kk.', 'kyk.kyk.kyk.', 'kyykyyykyyk.', 'kyyyyyyyyyk.',
        'kyryyryyryk.', 'kyyyyyyyyyk.', 'kYYYYYYYYYk.', 'kkkkkkkkkkk.', '............', '............'],
    door: ['..kkkkkkkk..', '.knnnnnnnnk.', 'knNnnNNnnNnk', 'knNnnNNnnNnk', 'knNnnNNnnNnk', 'knNnnNNnnNnk',
        'knNnnNNnnyYk', 'knNnnNNnnNnk', 'knNnnNNnnNnk', 'knNnnNNnnNnk', 'knnnnnnnnnnk', 'kkkkkkkkkkkk'],
    arena: ['.r...r...r..', 'krk.krk.krk.', 'kkkkkkkkkkkk', 'krrrrrrrrrrk', 'kkkkkkkkkkkk', 'kTk.kTTk.kTk',
        'kTk.kTTk.kTk', 'kTk.kTTk.kTk', 'kTkkkkkkkkTk', 'kTkk....kkTk', 'kTTk....kTTk', 'kkkk....kkkk'],
    target: ['...kkkkkk...', '..kwwwwwwk..', '.kwwrrrrwwk.', 'kwwrrwwrrwwk', 'kwrrwwwwrrwk', 'kwrwwrrwwrwk',
        'kwrwwrrwwrwk', 'kwrrwwwwrrwk', 'kwwrrwwrrwwk', '.kwwrrrrwwk.', '..kwwwwwwk..', '...kkkkkk...'],
    check: ['..........kk', '.........kgk', '........kggk', '.......kggk.', 'kk....kggk..', 'kgk..kggk...',
        'kggkkggk....', '.kgggggk....', '..kgggk.....', '...kgk......', '....k.......', '............'],
    cross: ['kk........kk', 'krk......krk', '.krk....krk.', '..krk..krk..', '...krkkrk...', '....krrk....',
        '....krrk....', '...krkkrk...', '..krk..krk..', '.krk....krk.', 'krk......krk', 'kk........kk'],
    warning: ['.....kk.....', '....kyyk....', '....kyyk....', '...kyyyyk...', '...kykkyk...', '..kyykkyyk..',
        '..kyykkyyk..', '.kyyykkyyyk.', '.kyyyyyyyyk.', 'kyyyykkyyyyk', 'kyyyyyyyyyyk', 'kkkkkkkkkkkk'],
    hourglass: ['kkkkkkkkkkkk', 'kNNNNNNNNNNk', '.kwyyyyyywk.', '..kwyyyywk..', '...kwyywk...', '....kyyk....',
        '....kwwk....', '...kwwywk...', '..kwwyyywk..', '.kwyyyyyywk.', 'kNNNNNNNNNNk', 'kkkkkkkkkkkk'],
    swirl: ['...kkkkkk...', '..kbbbbbbk..', '.kbkkkkkkbk.', 'kbk.kkkk.kbk', 'kbkkbbbbk.kb', 'kbkbk..kbkbk',
        'kbkbkk.kbkbk', 'kbk.kbbbkkbk', 'kbk..kkkk.bk', '.kbk......k.', '..kbbbbbbk..', '...kkkkkk...'],
    fire: ['.....k......', '....kok.....', '....kok..k..', '...koyok.kk.', '..koyyok.kok', '..koyyyokoyk',
        '.koyywyyyoyk', '.koywwyyyook', 'koyywwwyyyok', 'koyywwwyyyok', '.koyyyyyyok.', '..kkkkkkkk..'],
    bolt: ['......kkkkk.', '.....kyyyk..', '....kyyyk...', '...kyyyk....', '..kyyyykkkk.', '.kyyyyyyyk..',
        '.kkkkyyyk...', '....kyyk....', '...kyyk.....', '..kyyk......', '..kyk.......', '..kk........'],
    snow: ['.....kk.....', '..k..cc..k..', '..kc.cc.ck..', '...kcwwck...', '.kkkcwwckkk.', 'kccwwwwwwcck',
        'kccwwwwwwcck', '.kkkcwwckkk.', '...kcwwck...', '..kc.cc.ck..', '..k..cc..k..', '.....kk.....'],
    moon: ['...kkkkkk...', '..kwwwwwlk..', '.kwwwlwwwlk.', 'kwwwwwwwwwlk', 'kwlwwwwlwwlk', 'kwwwwwwwwwlk',
        'kwwwwlwwwwlk', 'kwwwwwwwlwlk', '.kwlwwwwwlk.', '..kllwwllk..', '...kkkkkk...', '............'],
    crescent: ['...kkkk.....', '..kyyyk.....', '.kyyyk......', 'kyyyk.......', 'kyyyk.......', 'kyyyk.......',
        'kyyyk.......', 'kyyyyk......', '.kyyyykkk...', '..kyyyyyyk..', '...kkkkkk...', '............'],
    sun: ['.....kk.....', '.k...yy...k.', '..k.kkkk.k..', '...kyyyyk...', '.kkyywyyykk.', 'kyyywyyyyyyk',
        'kyyyyyyyyyok', '.kkyyyyyokk.', '...kyyyok...', '..k.kkkk.k..', '.k...yy...k.', '.....kk.....'],
    potion: ['....kkkk....', '....kwwk....', '....kllk....', '....kllk....', '...kllllk...', '..kllllllk..',
        '.kvvvvvvvvk.', 'kvwvvvvvvvVk', 'kvwvvvvvvvVk', 'kvvvvvvvvVVk', '.kVVVVVVVVk.', '..kkkkkkkk..'],
    gem: ['..kkkkkkkk..', '.kccwcccbbk.', 'kcwcccccbbBk', 'kkkkkkkkkkkk', '.kcccccbbBk.', '.kccccbbBBk.',
        '..kcccbbBk..', '...kccbBk...', '....kcBk....', '.....kk.....', '............', '............'],
    key: ['..kkkk......', '.kyyyyk.....', 'kyykkyyk....', 'kyk..kyk....', 'kyykkyykkkkk', '.kyyyyyyyyyk',
        '..kkkkkykyyk', '.......kkkyk', '.........kk.', '............', '............', '............'],
    lantern: ['.....kk.....', '....kNNk....', '..kkkkkkkk..', '.krrrrrrrrk.', 'kryrrrrrrrRk', 'kryyrrrrrrRk',
        'kryrrrrrrrRk', 'krrrrrrrrrRk', '.krrrrrrrRk.', '..kkkkkkkk..', '....kyyk....', '.....kk.....'],
    house: ['.....kk.....', '....krrk....', '...krrrrk...', '..krrrrrrk..', '.krrrrrrrrk.', 'kkkkkkkkkkkk',
        '.kttttttttk.', '.kttkkttwtk.', '.kttknkttwk.', '.kttknkttTk.', '.kTTknkTTTk.', '.kkkkkkkkkk.'],
    pin: ['...kkkkk....', '..krrrrrk...', '.krrwwrrrk..', '.krwkkrrrk..', '.krrkkrrrk..', '.krrrrrrRk..',
        '..krrrrRk...', '...krrRk....', '....krk.....', '....krk.....', '.....k......', '............'],
    speech: ['.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwwwwwwwwwlk', 'kwkkwkkwkkwk', 'kwwwwwwwwwlk', 'kwwwwwwwwllk',
        '.kkwwkkkkkk.', '..kwk.......', '..kk........', '............', '............', '............'],
    mirror: ['...kkkkkk...', '..kyyyyyyk..', '.kyccccccyk.', '.kycwccccyk.', '.kycwccccyk.', '.kycccccbyk.',
        '.kyccccbbyk.', '..kyyyyyyk..', '...kkyykk...', '....kNNk....', '....kNNk....', '....kkkk....'],
    trap: ['k.k.k..k.k.k', 'kskskkkskskk', '.ksssssssss.', 'kkkkkkkkkkkk', 'ksssssssssss', 'kSSkkkkkkSSk',
        '.kk.....kk..', '............', 'kkkkkkkkkkkk', 'kNNNNNNNNNNk', 'kkkkkkkkkkkk', '............'],
    drop: ['.....kk.....', '....krrk....', '....krrk....', '...krrrrk...', '...krrrrk...', '..krwrrrrk..',
        '..krwrrrRk..', '.krrwrrrrRk.', '.krrrrrrrRk.', '.krrrrrrRRk.', '..kRRRRRRk..', '...kkkkkk...'],
    fist: ['............', '..kkkkkkkk..', '.kmmkmmkmmk.', 'kmmmkmmkmmmk', 'kmmmmmmmmmmk', 'kkmmmmmmmmmk',
        'kmkmmmmmmmmk', 'kmmmmmmmmmmk', '.kmmmmmmmmk.', '..kkmmmmkk..', '...kmmmmk...', '...kkkkkk...'],
    chart: ['k...........', 'k.......kkk.', 'k.......kgk.', 'k...kkk.kgk.', 'k...kyk.kgk.', 'k...kyk.kgk.',
        'kkkkkyk.kgk.', 'krrkkyk.kgk.', 'krrkkyk.kgk.', 'krrkkyk.kgk.', 'kkkkkkkkkkkk', '............'],
    note: ['......kkkkkk', '......kvvvvk', '......kkkkvk', '......k...vk', '......k...vk', '......k...vk',
        '..kkkkk.kkvk', '.kvvvvk.kvvk', 'kvvvvvkkvvvk', 'kvvvvk.kvvk.', '.kkkk...kk..', '............'],
    sound: ['....k.......', '...kk...k...', 'kkkSk.k..k..', 'ksskSk.k.k..', 'ksskSk.k..k.', 'ksskSk.k..k.',
        'ksskSk.k..k.', 'ksskSk.k.k..', 'kkkSk.k..k..', '...kk...k...', '....k.......', '............'],
    mute: ['....k.......', '...kk.......', 'kkkSk.......', 'ksskSk.k...k', 'ksskSk..k.k.', 'ksskSk...k..',
        'ksskSk..k.k.', 'ksskSk.k...k', 'kkkSk.......', '...kk.......', '....k.......', '............'],
    refresh: ['...kkkkk.k..', '..kbbbbbkbk.', '.kbkkkkkbbk.', 'kbk....kbbbk', 'kbk...kkkkk.', 'kbk.........',
        '.........kbk', '.kkkkk...kbk', 'kbbbk....kbk', '.kbbkkkkkbk.', '.kbkbbbbbk..', '..k.kkkkk...'],
    burst: ['k....k....k.', '.k..kyk..k..', '..kkyyykk...', '.kyyoooyyk..', 'kyyooroooyyk', '.kyorrroyk..',
        'kyyooroooyyk', '.kyyoooyyk..', '..kkyyykk...', '.k..kyk..k..', 'k....k....k.', '............'],
    party: ['.r....y...b.', '...y.....r..', '.b....kk....', '.....kyyk.g.', '..y.kyyrk...', '...kyyrrk.r.',
        '..kyyrrbk...', '.kyyrrbbk..y', '.kyrrbbk....', 'kyyrbbk..b..', 'kkkkkk...r..', '............'],
    brain: ['..kkkkkkkk..', '.kppppkpppk.', 'kppkpppkpppk', 'kpppppppkppk', 'kpkppkppppkk', 'kppppkpppppk',
        'kppkppppkppk', '.kpppppkpppk', '..kkppppppk.', '....kkpppk..', '......kppk..', '.......kk...'],
    orb: ['............', '...kkkkkk...', '..kxxxxxxk..', '.kxwwxxxxXk.', '.kxwxxxxxXk.', '.kxxxxxxxXk.',
        '.kxxxxxxxXk.', '.kxxxxxxXXk.', '..kXXXXXXk..', '...kkkkkk...', '............', '............'],
    yinyang: ['...kkkkkk...', '..kwwwwkkk..', '.kwwwwkkkkk.', 'kwwkkwkkkkkk', 'kwwkkwkkkkkk', 'kwwwwkkkkkkk',
        'kwwwwwwkkkkk', 'kwwwwwwkwwkk', 'kwwwwwwkwwkk', '.kwwwwwkkkk.', '..kkwwwkkk..', '...kkkkkk...'],
    hat: ['......kk....', '.....kvVk...', '....kvvVk...', '....kvyVk...', '...kvvvvVk..', '...kvvvvVk..',
        '..kvvvyvvVk.', '..kvvvvvvVk.', 'kkkkkkkkkkkk', 'kVVVVVVVVVVk', 'kkkkkkkkkkkk', '............'],
    ninja: ['...kkkkkk...', '..kSSSSSSk..', '.kSSSSSSSSk.', '.kkkkkkkkkk.', '.kmmkmmkmmk.', '.kmwkmmkwmk.',
        '.kkkkkkkkkk.', '.kSSSSSSSSkr', '.kSSSSSSSSkr', '..kSSSSSSk.r', '...kkkkkk...', '............'],
    person: ['....kkkk....', '...kNNNNk...', '..kmmmmmmk..', '..kmkmmkmk..', '..kmmmmmmk..', '...kmmmmk...',
        '..kkkkkkkk..', '.kbbbbbbbbk.', 'kbbbbbbbbbbk', 'kbkbbbbbbkbk', 'kmkbbbbbbkmk', '.k.kkkkkk.k.'],
    rock: ['............', '............', '....kkkk....', '..kksssskk..', '.kssllsssSk.', '.ksllssssSk.',
        'kssssssssSSk', 'ksssssssSSSk', 'kSsssssSSSSk', '.kSSSSSSSSk.', '..kkkkkkkk..', '............'],
    mountain: ['.....kk.....', '....kwwk....', '...kwwwsk...', '...kwsssk...', '..kssssSSk..', '..kssssSSk..',
        '.kssssSSSSk.', '.ksssSSSSSk.', 'kssssSSSSSSk', 'ksssSSSSSSSk', 'kkkkkkkkkkkk', '............'],
    volcano: ['...r..o..r..', '....rook....', '.....kok....', '....koyok...', '...kNNoNNk..', '...kNNNNNk..',
        '..kNNNNNNNk.', '..kNNNNNNNk.', '.kNNNNNNNNNk', '.kNNNNNNNNNk', 'kkkkkkkkkkkk', '............'],
    tree: ['...kkkkkk...', '..kggggggk..', '.kggwgggggk.', 'kgggggggGggk', 'kgggggGgggGk', 'kggGgggggGGk',
        '.kgggggGGGk.', '..kkGGGGkk..', '....knnk....', '....knnk....', '...knnnnk...', '...kkkkkk...'],
    bamboo: ['.kk....kk...', '.kgk..kgk...', '.kgkkkgGk.k.', '.kkk.kkkkkgk', '.kgk..kgk.kg', '.kgk..kgk.kg',
        '.kkkk.kkk.kk', '.kgkgkkgk.kg', '.kgk.kkgk.kg', '.kgk..kgk.kg', '.kkk..kkk.kk', '............'],
    rice: ['...y...y....', '..yYk.yYk.y.', '..kYk.kYkyYk', '...kk..kkkYk', '...kG..kG.kk', '....kG.kG.kG',
        '....kG.kGkG.', '.....kGkGkG.', '.....kGGGG..', '......kGGk..', '......kGGk..', '......kkkk..'],
    cactus: ['.....kk.....', '....kggk....', '.k..kggk....', 'kgk.kggk.k..', 'kgk.kggkkgk.', 'kgkkkggkkgk.',
        '.kggggggggk.', '..kkkggkkk..', '....kggk....', '....kGGk....', '...kTTTTk...', '...kkkkkk...'],
    wave: ['............', '....kkkk....', '...kbbbbk...', '..kbcwwbbk..', '.kbbkkkcbk..', '.kbk...kbk..',
        'kbbk..kbbbk.', 'kbbbkkbbbbbk', 'kBbbbbbbbbBk', 'kBBbbbbbBBBk', 'kkkkkkkkkkkk', '............'],
    cloud: ['............', '............', '....kkkk....', '...kwwwwk...', '.kkwwwwwwkk.', 'kwwwwwwwwwwk',
        'kwwwwwwwwwlk', 'kwwwwwwwwllk', '.kllllllllk.', '..kkkkkkkk..', '............', '............'],
    mushroom: ['...kkkkkk...', '..krrwrrrk..', '.krrwwrrrrk.', 'krrrrrrwrrrk', 'krwwrrrwwrRk', 'kRRRRRRRRRRk',
        '.kkkkkkkkkk.', '....kwwk....', '....kwwk....', '....kwlk....', '...kwwllk...', '...kkkkkk...'],
    jar: ['...kkkkkk...', '...knnnnk...', '....kNNk....', '..kknnnnkk..', '.knnyyyyyNk.', 'knnnnnnnnnNk',
        'knnyyyyyyyNk', 'knnnnnnnnnNk', 'knnnnnnnnNNk', '.knnnnnnnNk.', '..kNNNNNNk..', '...kkkkkk...'],
    tea: ['............', '....k..k....', '.....k..k...', '....k..k....', '.kkkkkkkkkk.', '.kgwwwwwgkk.',
        '.kggggggkgk.', '.kggggggkgk.', '..kgggggkk..', '...kGGGk....', '.kkkkkkkkk..', '............'],
    drum: ['..kkkkkkkk..', '.kwwwwwwwwk.', 'kwwwwwwwwwwk', 'kkwwwwwwwwkk', 'krkkkkkkkkrk', 'krrykrrkyrrk',
        'krrrkrrkrrrk', 'krrykrrkyrrk', 'kRrrkrrkrrRk', '.kRRRRRRRRk.', '..kkkkkkkk..', '............'],
    banner: ['kk..........', 'kNkkkkkkkk..', 'kNkrrrrrrrk.', 'kNkrryyrrrrk', 'kNkrryyrrrk.', 'kNkrrrrrrk..',
        'kNkrrrrrrrk.', 'kNkkkkkkkkk.', 'kNk.........', 'kNk.........', 'kNk.........', 'kkk.........'],
    gear: ['....kkkk....', '.kk.kssk.kk.', '.kskkssskksk', '..ksssssssk.', 'kkssskksssk.', 'ksssk..ksssk',
        'ksssk..ksssk', 'kkssskksssk.', '..ksssssssk.', '.kskkssskksk', '.kk.kssk.kk.', '....kkkk....'],
    chain: ['.kkk........', 'kssk........', 'ksksk.......', 'kskkskk.....', '.kksssk.....', '...ksksk....',
        '...kskkskk..', '....kksssk..', '......ksksk.', '......kskksk', '.......kksk.', '.........kk.'],
    bell: ['.....kk.....', '....kyyk....', '...kyyyyk...', '..kywyyyyk..', '..kywyyyyk..', '..kyyyyyyk..',
        '.kyyyyyyyyk.', '.kyyyyyyyYk.', 'kyyyyyyyyyYk', 'kkkkkkkkkkkk', '.....kk.....', '.....kk.....'],
    bed: ['............', 'kk..........', 'kNk.........', 'kNkwwkkkkkkk', 'kNkwwkrrrrrk', 'kNkkkkrrrrrk',
        'kNNNNNNNNNNk', 'kNkkkkkkkkNk', 'kNk......kNk', 'kkk......kkk', '............', '............'],
    chair: ['..kkkkk.....', '..knnnk.....', '..knNnk.....', '..knNnk.....', '..knnnk.....', '..knnnkkkkk.',
        '..knnnnnnnk.', '..kkkkkkkkk.', '..knk...knk.', '..knk...knk.', '..knk...knk.', '..kkk...kkk.'],
    dragon: ['.kk.....kk..', 'kgGk...kGgk.', '.kggkkkggk..', '..kggggggk..', '.kgwkggkwgk.', '.kgkkggkkgk.',
        '.kggggggggk.', '..kgryyrgk..', '...kgrrgk...', '....kggk....', '...kgGGgk...', '...kkkkkk...'],
    ghost: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwwwwwwk.',
        '.kwwwkkwwwk.', '.kwwwwwwwlk.', '.kwwwwwwwlk.', '.kwlwwlwwlk.', '.kkwkkwkkwk.', '..k..k..k...'],
    paw: ['............', '..kk....kk..', '.knnk..knnk.', '.knnk..knnk.', 'kk.kk..kk.kk', 'knnk....knnk',
        'knnkkkkkknnk', '.kk.knnnk.kk', '...knnnnnk..', '..knnnnnnnk.', '..knnnnnnnk.', '...kkkkkkk..'],
    fish: ['............', '............', '.......kkk..', 'k....kbbbbk.', 'kbk.kbbbbwbk', 'kbbkbbbbbkbk',
        'kbbbbbbbbbbk', 'kbbkbbbbbbbk', 'kbk.kbbbbbk.', 'k....kkkkk..', '............', '............'],
    bird: ['............', '.....kkk....', '....kSSSk...', '...kSwkSkyy.', '...kSSSSkk..', 'kk.kSSSSk...',
        'kSkkSSSSSk..', '.kSSSSSSSk..', '..kSSSSSSk..', '...kkkyk....', '.....kyk....', '............'],
    flower: ['....kkkk....', '...kppppk...', '.kkkpppkkkk.', 'kpppkyykpppk', 'kpppkyykpppk', '.kkkpppkkkk.',
        '...kppppk...', '....kkkk.k..', '.....kG.kgk.', '..k..kGkgk..', '.kgk.kGkk...', '..kkkkGk....'],
    leaf: ['.........kkk', '.......kkggk', '.....kkgggGk', '....kggggGGk', '...kggwgGGk.', '..kggwgGGGk.',
        '..kgwgGGGk..', '.kgwgGGkk...', '.kwGGkk.....', 'kwkkk.......', 'kk..........', '............'],
    wind: ['............', '......kkk...', '.....k...k..', '.........k..', 'kkkkkkkkkk..', '............',
        'kkkkkkkkkkkk', '............', 'kkkkkkkkk...', '.........k..', '.....k..k...', '......kk....'],
    trash: ['....kkkk....', '.kkkkkkkkkk.', '.kssssssssk.', '..kkkkkkkk..', '..kslslslk..', '..kslslslk..',
        '..kslslslk..', '..kslslslk..', '..kslslslk..', '..kslslslk..', '..kSSSSSSk..', '...kkkkkk...'],
    cart: ['k...........', 'kkk.........', '..kkkkkkkkkk', '..kyyyyyyyyk', '..kyykyykyyk', '..kyyyyyyyyk',
        '...kyykyyyk.', '...kkkkkkkk.', '..........k.', '...kkkkkkkk.', '..kk....kk..', '..kk....kk..'],
    question: ['...kkkkkk...', '..kyyyyyyk..', '.kyykkkkyyk.', '.kyk....kyk.', '.kk....kyyk.', '......kyyk..',
        '.....kyyk...', '.....kyk....', '.....kkk....', '.....kyk....', '.....kkk....', '............'],
    exclaim: ['....kkkk....', '....kyyk....', '....kyyk....', '....kyyk....', '....kyyk....', '....kyyk....',
        '....kyyk....', '....kkkk....', '............', '....kkkk....', '....kyyk....', '....kkkk....'],
    play: ['.kk.........', '.kgkk.......', '.kgggkk.....', '.kgggggkk...', '.kgggggggkk.', '.kggggggggk.',
        '.kgggggggkk.', '.kgggggkk...', '.kgggkk.....', '.kgkk.......', '.kk.........', '............'],
    pause: ['............', '.kkkk..kkkk.', '.kssk..kssk.', '.kssk..kssk.', '.kssk..kssk.', '.kssk..kssk.',
        '.kssk..kssk.', '.kssk..kssk.', '.kssk..kssk.', '.kkkk..kkkk.', '............', '............'],
    mask: ['............', '.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwkkwwwwkkwk', 'kwkkwwwwkkwk', 'kwwwwwwwwwwk',
        'kwwwrwwrwwwk', '.kwwwrrwwwk.', '..kwwwwwwk..', '...kkkkkk...', '............', '............'],
    dice: ['.kkkkkkkkkk.', 'kwwwwwwwwwlk', 'kwkkwwwwkkwk', 'kwkkwwwwkkwk', 'kwwwwkkwwwlk', 'kwwwwkkwwwlk',
        'kwkkwwwwkkwk', 'kwkkwwwwkkwk', 'kwwwwwwwwwlk', 'kllllllllllk', '.kkkkkkkkkk.', '............'],
    controller: ['............', '............', '.kkkkkkkkkk.', 'ksssssssssSk', 'kskksssskrsk', 'kkkkkssskssk',
        'kskksssbkrSk', 'ksssssssssSk', 'kSSkkkkkkSSk', '.kk......kk.', '............', '............']
};

// Variantes de couleur (pièces de mana, médailles).
const VARIANTS = {
    orb_red: ['orb', { x: '#e0262b', X: '#8b1a1a' }], orb_blue: ['orb', { x: '#38bdf8', X: '#1d4ed8' }],
    orb_green: ['orb', { x: '#4ade80', X: '#15803d' }], orb_purple: ['orb', { x: '#a855f7', X: '#6b21a8' }], orb_white: ['orb', { x: '#f3f4f6', X: '#9ca3af' }],
    orb_black: ['orb', { x: '#4b5563', X: '#1f2937' }], orb_brown: ['orb', { x: '#a16207', X: '#5a3e1b' }],
    medal_silver: ['medal', { x: '#e5e7eb', X: '#9ca3af' }],
    medal_bronze: ['medal', { x: '#d08a4a', X: '#8a4e1a' }], heart_green: ['heart', { r: '#4ade80', R: '#15803d' }],
    gem_red: ['gem', { c: '#fca5a5', b: '#e0262b', B: '#8b1a1a' }], gem_purple: ['gem', { c: '#e9d5ff', b: '#a855f7', B: '#6b21a8' }],
    potion_red: ['potion', { v: '#e0262b', V: '#8b1a1a' }], potion_green: ['potion', { v: '#4ade80', V: '#15803d' }],
    snake: ['dragon', { g: '#84cc16', G: '#3f6212' }]
};

export const ICON_NAMES = [...Object.keys(ICONS), ...Object.keys(VARIANTS)];

// Emoji (sans sélecteur de variante U+FE0F) → icône pixel. Ceux qui manquent sont retirés de l'affichage.
const GROUPS = {
    coin: '💰🪙', star: '⭐🌟★', sparkle: '✨💫', heart: '❤♥', heart_green: '💚', skull: '💀☠', arrow: '🏹➶',
    swords: '⚔🤺', sword: '🗡🔪', shield: '🛡', axe: '🪓', pick: '⛏⚒🔨🪚', lock: '🔒🔐', unlock: '🔓', chest: '🧰🧳📦📭',
    gift: '🎁', scroll: '📜📄📃🪪🏷', book: '📖📚📒🖋🎓', map: '🗺', bag: '🎒👜🧺', trophy: '🏆🏅', medal: '🥇',
    medal_silver: '🥈', medal_bronze: '🥉', crown: '👑🤴👸', door: '🚪', arena: '🏟🛕', target: '🎯', check: '✅✔☑',
    cross: '❌✖🚫⛔', warning: '⚠❗‼', hourglass: '⏱⏳⌛⏰', swirl: '🌀💫', fire: '🔥', bolt: '⚡🌩⛈', snow: '❄🧊',
    moon: '🌕🌝🥮', crescent: '🌙🌒🌑🌘', sun: '☀🌞🌅', potion: '🧪⚗', potion_red: '💊💉🩹', potion_green: '🍶🍾',
    gem: '💎💠🔷', gem_purple: '🔮🪄', key: '🗝🔑', lantern: '🏮🪔🕯🔦', house: '🏠🏘🛖🏚🏡🏯', pin: '📍🧭📌',
    speech: '💬🗨', mirror: '🪞', trap: '🪤🕸', drop: '🩸💧', fist: '💪👊', chart: '📊📈📉', note: '🎵🎶🎤🪕🪈🎻',
    sound: '🔊🔉🔔', mute: '🔇🔕', refresh: '🔄🔁', burst: '💥', party: '🎉🎊', brain: '🧠🤖💡', orb_red: '🔴',
    orb_blue: '🔵', orb_green: '🟢', orb: '🟡', orb_purple: '🟣', orb_white: '⚪', orb_black: '⚫⬛',
    orb_brown: '🟤', yinyang: '☯', hat: '🧙🧞🪄', ninja: '🥷', person: '🧒👧🧓👵👦👩👨🧔🧘🧕👴👶🧑👷💂🧗🏃👥👳🧖🧜🧟🧛🎭',
    rock: '🪨🗿🪵🧱', mountain: '⛰🏔🏜', volcano: '🌋', tree: '🌳🌲🌴🎄', bamboo: '🎋', rice: '🌾🌽', cactus: '🌵',
    wave: '🌊🫧🛶⛵🌧', cloud: '☁🌫', mushroom: '🍄', jar: '🏺⚱🫙🪣🛢🍯', tea: '🍵🫖🍲🍜🥡🧂', drum: '🥁', bell: '🔔',
    banner: '🎌🏳🏴🏁🚩', gear: '⚙🔩', chain: '⛓🪢🧶🧵', bed: '🛏🛁', chair: '🪑', dragon: '🐉🐲', snake: '🐍🦎',
    ghost: '👻👹👺😈', paw: '🐺🐯🐅🦁🐗🐕🐂🐃🐎🐴🐒🐵🐼🐇🐰🐑🐐🐫🦊🦦🐢🦀🐸🐝🦗🦂🦋🐙🪼🐚🦪',
    fish: '🐟🐋🐠🎣', bird: '🐦🦆🦅🕊🦢🪿🐥🪶🪹🐓', flower: '🌸🌺💐🍑🌶', leaf: '🍃🌿☘🍀', wind: '💨', trash: '🗑',
    cart: '🛒⚖', question: '❓❔', exclaim: '❕', play: '▶⏩⏭', pause: '⏸', mask: '😠😡😵🫥🥸', dice: '🎲',
    controller: '🎮🕹'
};

export const EMOJI_ICON = {};
for (const [icon, chars] of Object.entries(GROUPS)) for (const ch of chars) EMOJI_ICON[ch] = icon;
// Composés (ZWJ) : on se rabat sur leur premier caractère.
const baseOf = emoji => [...emoji.replace(/️/g, '')][0] || '';

// Reconnaissance des emojis (pictogrammes) : on laisse les flèches et symboles typographiques (→ ▶ ✦ ★…) du texte,
// sauf ceux du tableau qui ont une icône (▶ devient le bouton « jouer » quand il est suivi de U+FE0F).
export const EMOJI_RE = /(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)️?/gu;
const TYPOGRAPHIC = new Set(['▶', '◀', '▲', '▼', '→', '←', '↑', '↓', '✦', '★', '©', '®', '™', '↔', '↩', '↪', '➜', '➶', '☐', '☑', '✔', '✖', '‼']);

// Un emoji (avec ou sans U+FE0F) est-il un pictogramme à remplacer ? (pas les symboles typographiques nus)
export function isPictogram(match) {
    if (match.includes('️') || match.includes('‍')) return true;
    return !TYPOGRAPHIC.has(match);
}

export const iconForEmoji = emoji => EMOJI_ICON[baseOf(emoji)] || null;

// Texte sans aucun emoji (pour un canvas, un title, une boîte confirm…) ; espaces superflus nettoyés.
export function stripEmoji(text) {
    return String(text ?? '').replace(EMOJI_RE, m => (isPictogram(m) ? '' : m)).replace(/️/g, '')
        .replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+/gm, '').replace(/[ \t]+$/gm, '');
}

// Découpe un texte en morceaux { text } et { icon } (emoji sans icône : retiré).
export function splitEmoji(text) {
    const parts = [];
    let last = 0;
    String(text).replace(EMOJI_RE, (m, offset) => {
        if (!isPictogram(m)) return m;
        if (offset > last) parts.push({ text: text.slice(last, offset) });
        const icon = iconForEmoji(m);
        if (icon) parts.push({ icon });
        last = offset + m.length;
        return m;
    });
    if (last < text.length) parts.push({ text: text.slice(last) });
    // espace double laissé par un emoji retiré
    return parts.map((p, i) => (p.text && parts[i - 1] && !parts[i - 1].icon && p.text.startsWith(' ') ? { text: p.text.slice(1) } : p))
        .filter(p => p.icon || p.text);
}

export const hasEmoji = text => {
    EMOJI_RE.lastIndex = 0;
    let found = false;
    String(text ?? '').replace(EMOJI_RE, m => { if (isPictogram(m)) found = true; return m; });
    return found;
};

// ── SVG ────────────────────────────────────────────────────────────────────
function gridOf(name) {
    if (ICONS[name]) return { rows: ICONS[name], pal: PAL };
    const v = VARIANTS[name];
    if (v) return { rows: ICONS[v[0]], pal: { ...PAL, ...v[1] } };
    return null;
}

const svgCache = new Map();
// SVG d'une icône : rectangles fusionnés par ligne, rendu net (crispEdges).
export function iconSvg(name) {
    if (svgCache.has(name)) return svgCache.get(name);
    const g = gridOf(name);
    if (!g) return null;
    let rects = '';
    g.rows.forEach((row, y) => {
        let x = 0;
        while (x < row.length) {
            const ch = row[x];
            if (ch === '.') { x++; continue; }
            let w = 1;
            while (row[x + w] === ch) w++;
            const color = g.pal[ch];
            if (color) rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${color}"/>`;
            x += w;
        }
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges">${rects}</svg>`;
    svgCache.set(name, svg);
    return svg;
}

export const iconUri = name => {
    const svg = iconSvg(name);
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
};

// Grilles brutes (tests).
export const iconGrid = name => gridOf(name);
