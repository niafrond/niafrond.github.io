"""horse-art.py — Cheval chibi pixel art (style Pokémon GBA / FF6) dessiné pixel par pixel, sans cavalier, pour tools/gen-mounted-heroes.py.

Vue de profil (vers la droite ; miroir pour la gauche), de face et de dos, avec jambes interchangeables pour le cycle de marche. Robe brune à
contour noir, encolure arquée et crinière sombre, tête allongée avec oreille et liste blanche, chaussettes blanches, selle bombée à siège brun.
Les formes sont tracées sans lissage sur une grille de 40×28 puis ombrées (lumière en haut, ombre en bas) et cernées d'un contour d'un pixel.
Légende de la selle : K contour, g selle (verte, recolorée par classe), s siège brun, ' ' transparent.
"""
from PIL import Image, ImageDraw

PAL = {'K': (28, 22, 30, 255), 'g': (30, 100, 50, 255), 's': (120, 74, 66, 255)}

COAT = (168, 106, 62, 255)
COAT_LIGHT = (204, 142, 86, 255)
COAT_SHADE = (126, 78, 48, 255)
MANE = (46, 34, 38, 255)
SOCK = (238, 228, 210, 255)
MUZZLE = (222, 184, 148, 255)
HOOF = (60, 46, 48, 255)
OUT = (30, 20, 24, 255)
EYE = (20, 14, 18, 255)

SADDLE = [
    "  KKKKKKK  ",
    " KsssssssK ",
    "KggsssssggK",
    "KgggggggggK",
    "KgggggggggK",
    "KgggggggggK",
    " KKKKKKKKK ",
]


def to_image(grid):
    im = Image.new('RGBA', (len(grid[0]), len(grid)), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch in PAL:
                im.putpixel((x, y), PAL[ch])
    return im


def _shade(im):
    """Lumière sur le haut des formes, ombre sur le bas (uniquement la couleur de robe)."""
    src = im.copy().load()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y] == COAT:
                if y == 0 or not src[x, y - 1][3]:
                    px[x, y] = COAT_LIGHT
                elif y + 1 >= im.height or not src[x, y + 1][3]:
                    px[x, y] = COAT_SHADE
    return im


def _outline(im):
    src = im.copy().load()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < im.width and 0 <= ny < im.height and src[nx, ny][3]:
                    px[x, y] = OUT
                    break
    return im


def _poly(d, pts, fill):
    d.polygon(pts, fill=fill)


def _leg(d, x, y0, y1, dx=0, lift=0, far=False, sock=True):
    """Jambe de 3 px : robe, chaussette blanche, sabot sombre ; décalée de dx au sabot, levée de `lift`."""
    col = COAT_SHADE if far else COAT
    yh = y1 - lift
    mid = y0 + (yh - y0) // 2
    d.rectangle([x, y0, x + 2, mid], fill=col)
    d.rectangle([x + dx, mid + 1, x + dx + 2, yh - 3], fill=col)
    d.rectangle([x + dx, yh - 3, x + dx + 2, yh - 2], fill=SOCK if sock and not far else col)
    d.rectangle([x + dx, yh - 1, x + dx + 2, yh], fill=HOOF)


def side(phase=0, w=40, h=28):
    """Profil vers la droite. phase 0..3 : jambes diagonales qui alternent, le cheval monte d'un pixel sur deux."""
    bob = [0, -1, 0, -1][phase]
    sw = [(2, -2, -2, 2), (0, 0, 0, 0), (-2, 2, 2, -2), (0, 0, 0, 0)][phase]    # avant loin, avant près, arrière loin, arrière près
    lf = [(0, 0, 0, 2), (0, 0, 0, 0), (2, 0, 0, 0), (0, 0, 0, 0)][phase]
    far = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    _leg(ImageDraw.Draw(far), 21, 17 + bob, 27, sw[0], lf[0], far=True)
    _leg(ImageDraw.Draw(far), 14, 17 + bob, 27, sw[2], lf[2], far=True)
    far = _outline(far)
    near = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(near)
    b = bob
    _poly(d, [(8, 10 + b), (5, 12 + b), (3, 17 + b), (3, 22 + b), (5, 24 + b), (6, 19 + b), (8, 15 + b)], MANE)              # queue
    d.ellipse([6, 9 + b, 28, 20 + b], fill=COAT)                                                                                 # corps
    _poly(d, [(20, 11 + b), (23, 4 + b), (29, 3 + b), (31, 6 + b), (29, 12 + b), (24, 15 + b)], COAT)                           # encolure arquée
    _poly(d, [(27, 4 + b), (30, 2 + b), (34, 3 + b), (37, 7 + b), (37, 10 + b), (34, 11 + b), (31, 10 + b), (28, 8 + b)], COAT)  # tête allongée
    _poly(d, [(28, 3 + b), (29, 0 + b), (31, 3 + b)], COAT_SHADE)                                                                # oreille
    _poly(d, [(35, 8 + b), (37, 7 + b), (37, 10 + b), (34, 11 + b)], MUZZLE)                                                     # museau clair
    _poly(d, [(19, 10 + b), (21, 3 + b), (27, 1 + b), (28, 3 + b), (24, 5 + b), (22, 11 + b)], MANE)                            # crinière
    d.line([(32, 3 + b), (33, 7 + b)], fill=SOCK)                                                                                # liste blanche
    d.point((31, 5 + b), fill=EYE)                                                                                               # œil
    d.point((36, 9 + b), fill=MANE)                                                                                              # naseau
    _leg(d, 25, 17 + b, 27, sw[1], lf[1])
    _leg(d, 9, 17 + b, 27, sw[3], lf[3])
    near = _outline(_shade(near))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(far)
    out.alpha_composite(near)
    out.alpha_composite(to_image([list(r.ljust(11)) for r in SADDLE]), (9, 3 + bob))
    return out


def front(phase=0, w=40, h=28, back=False, head=True, body=True):
    """Vue de face (ou de dos) : poitrail et tête allongée (ou croupe et queue), deux jambes."""
    bob = [0, -1, 0, -1][phase]
    lf = [(2, 0), (0, 0), (0, 2), (0, 0)][phase]
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    if body:
        L = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(L)
        _leg(d, 13, 17 + bob, 27, 0, lf[0], sock=not back)
        _leg(d, 24, 17 + bob, 27, 0, lf[1], sock=not back)
        d.ellipse([11, 10 + bob, 28, 23 + bob], fill=COAT)
        if back:
            _poly(d, [(18, 12 + bob), (22, 12 + bob), (23, 22 + bob), (20, 26 + bob), (17, 22 + bob)], MANE)                  # queue
            d.rectangle([13, 10 + bob, 26, 13 + bob], fill=PAL['g'])                                                          # couverture sur la croupe
        out.alpha_composite(_outline(_shade(L)))
    if head and not back:
        H = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(H)
        _poly(d, [(17, 12 + bob), (22, 12 + bob), (24, 22 + bob), (15, 22 + bob)], COAT)                                      # encolure étroite jusqu'au poitrail
        _poly(d, [(15, 4 + bob), (24, 4 + bob), (23, 14 + bob), (19, 18 + bob), (16, 14 + bob)], COAT)                      # tête vue de face, museau en bas
        _poly(d, [(14, 4 + bob), (13, 0 + bob), (17, 3 + bob)], COAT_SHADE)                                                  # oreilles
        _poly(d, [(25, 4 + bob), (26, 0 + bob), (22, 3 + bob)], COAT_SHADE)
        d.rectangle([16, 2 + bob, 23, 5 + bob], fill=MANE)                                                                   # toupet
        d.line([(19, 6 + bob), (19, 13 + bob)], fill=SOCK, width=2)                                                          # liste blanche
        d.rectangle([16, 14 + bob, 22, 17 + bob], fill=MUZZLE)                                                               # museau clair
        d.point((17, 8 + bob), fill=EYE)
        d.point((22, 8 + bob), fill=EYE)                                                                                     # yeux
        d.point((18, 16 + bob), fill=MANE)
        d.point((21, 16 + bob), fill=MANE)                                                                                   # naseaux
        out.alpha_composite(_outline(_shade(H)))
    return out
