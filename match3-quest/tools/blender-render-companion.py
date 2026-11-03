"""blender-render-companion.py — Rendu SANS ombre ni lumière d'un maillage colorié (tools/export-companion-ply.py), en caméra orthographique exacte.

À lancer avec Blender en ligne de commande (sans interface) :
    blender -b -P tools/blender-render-companion.py -- <maillage.ply> <dossier_sortie> <taille_px> <pixels_par_unité> <centre_x_monde> <y_min_monde> [front,left,right]

Moteur Workbench, éclairage « FLAT » (aucune ombre, aucun dégradé), couleur = couleurs de sommets, pas d'anticrénelage, fond transparent. Le cadrage reprend
celui de tools/render-companion-3d.py : une unité du monde = <pixels_par_unité> pixels, le point (centre_x, y_min) tombe en bas au centre, à SS pixels du bord.
Vues (repère du maillage : Y haut, avant du personnage vers +Z) : front = caméra en +Z ; left = caméra en +X (le personnage regarde à gauche de l'image) ;
right = caméra en -X. Écrit <dossier_sortie>/<vue>.png (RGBA, taille_px × taille_px).
"""
import sys
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
ply, outdir, size, ppu, cx, ymin = argv[0], argv[1], int(argv[2]), float(argv[3]), float(argv[4]), float(argv[5])
views = argv[6].split(",") if len(argv) > 6 else ["front", "left", "right"]
SS = size // 64 if size % 64 == 0 else 6   # marge de pieds : une case du sprite

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.ply_import(filepath=ply)
obj = bpy.context.selected_objects[0]
if not obj.data.color_attributes: raise SystemExit("le PLY n'a pas de couleurs de sommets")
obj.data.color_attributes.active_color = obj.data.color_attributes[0]

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.display.render_aa = "OFF"
scene.view_settings.view_transform = "Standard"      # pas de tone mapping : les couleurs sortent telles quelles
sh = scene.display.shading
sh.light = "FLAT"; sh.color_type = "VERTEX"; sh.show_shadows = False; sh.show_cavity = False; sh.show_object_outline = False; sh.show_specular_highlight = False

cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"; cam_data.ortho_scale = size / ppu; cam_data.clip_start, cam_data.clip_end = 0.01, 100
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam

# Colonnes = axes locaux de la caméra (droite, haut, vers l'arrière) exprimés dans le repère du maillage.
ORIENT = {"front": ((1, 0, 0), (0, 1, 0), (0, 0, 1)), "left": ((0, 0, -1), (0, 1, 0), (1, 0, 0)), "right": ((0, 0, 1), (0, 1, 0), (-1, 0, 0))}
yc = ymin + (size / 2 - 1 - SS) / ppu     # ordonnée du monde au centre de l'image
for name in views:
    r, u, b = (Vector(a) for a in ORIENT[name])
    # le centre horizontal est cx pour la face, et le centre en z pour les profils (passé tel quel par l'appelant : cx = centre dans l'axe « droite » de la vue)
    centre = Vector((0, yc, 0)) + r * cx
    cam.matrix_world = Matrix.Translation(centre + b * 10) @ Matrix((r, u, b)).transposed().to_4x4()
    scene.render.filepath = f"{outdir}/{name}.png"
    bpy.ops.render.render(write_still=True)
