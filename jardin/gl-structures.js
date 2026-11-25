// Structures de la vue 3D : maison, abri, murs, clôtures, haies, portails, mobilier (three.js passé en paramètre).
import { pointInPolygon, signedArea } from './geometry.js';
import { fenceTexture, leafTexture, roofTexture, brickTexture, stoneWallTexture } from './gl-textures.js';

/** Hauteur par défaut (m) du mobilier sans `height` dans le catalogue. */
const HAUTEUR_ITEM = {
  bench: 0.85, table: 0.76, table_round: 0.76, chair: 0.85, lounge: 0.8, sunbed: 0.5, parasol: 2.5, hammock: 1.6, bbq: 1.0, firepit: 0.35,
  composter: 0.9, rain_tank: 1.5, planter: 0.55, raised_bed: 0.45, woodpile: 1.0, clothesline: 1.8, mailbox: 1.3, light: 2.2, fountain: 1.0,
  swing: 2.2, trampoline: 0.9, sandbox: 0.3, playhouse: 1.8, shed_item: 2.3, greenhouse: 2, pergola: 2.4, gazebo: 2.5,
};
const HAUTEUR_OUVERTURE = { gate: 1.6, wicket: 1.3, door: 2.1, garage: 2.1, double_gate: 1.7 };

/** Polygone du plan (x, y) → géométrie plate (ou extrudée de `depth`) dans le repère 3D (x, y haut, z = y du plan). */
export function polyGeometry(THREE, poly, depth = 0, holes = []) {
  const toShape = (pts) => pts.map((p) => new THREE.Vector2(p.x, -p.y));
  const shape = new THREE.Shape(toShape(poly));
  for (const h of holes) shape.holes.push(new THREE.Path(toShape(h)));
  const geo = depth > 0 ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }) : new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Toit à deux pans : faîtage le long de x (longueur w), égouts à z = ±d/2, hauteur h. */
export function gableGeometries(THREE, w, d, h) {
  const hw = w / 2; const hd = d / 2;
  const slopeLen = Math.hypot(hd, h);
  const slopes = new THREE.BufferGeometry();
  const P = [-hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0];
  const uv = [0, 0, w, 0, w, slopeLen, 0, 0, w, slopeLen, 0, slopeLen, 0, 0, w, 0, w, slopeLen, 0, 0, w, slopeLen, 0, slopeLen];
  slopes.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  slopes.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  slopes.computeVertexNormals();
  const gables = new THREE.BufferGeometry();
  gables.setAttribute('position', new THREE.Float32BufferAttribute([hw, 0, hd, hw, 0, -hd, hw, h, 0, -hw, 0, -hd, -hw, 0, hd, -hw, h, 0], 3));
  gables.computeVertexNormals();
  return { slopes, gables };
}

/**
 * Contexte attendu : { THREE, mat(color, opts), track(obj), tex(name, factory) }.
 * Chaque constructeur renvoie un THREE.Group (ombres activées).
 */
function shadowed(o) { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; }

function boxMesh(ctx, w, h, d, x, y, z, color, opts) {
  const { THREE } = ctx;
  const m = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), ctx.mat(color, opts));
  m.position.set(x, y + h / 2, z);
  return m;
}
function cylMesh(ctx, rt, rb, h, x, y, z, color, opts, seg = 20) {
  const { THREE } = ctx;
  const m = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(rt, rb, h, seg)), ctx.mat(color, opts));
  m.position.set(x, y + h / 2, z);
  return m;
}

/** Bâtiment (maison ou abri) d'un obstacle polygonal. */
export function buildBuilding(ctx, ob, openings = []) {
  const { THREE } = ctx;
  const g = new THREE.Group();
  const pts = ob.points;
  const isHouse = ob.kind === 'house';
  const H = Number(ob.height) > 0 ? Number(ob.height) : (isHouse ? 6 : 2.5);
  const roofH = isHouse ? Math.min(2.4, H * 0.3) : 0;
  const wallH = H - roofH - (isHouse ? 0 : 0.12);
  const walls = new THREE.Mesh(ctx.track(polyGeometry(THREE, pts, wallH)), ctx.mat(isHouse ? '#ece4d4' : '#9a7b5a', { roughness: 0.92 }));
  g.add(walls);
  // fenêtres
  const orient = Math.sign(signedArea(pts)) || 1;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i]; const b = pts[(i + 1) % n];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 2.2) continue;
    const ux = (b.x - a.x) / L; const uy = (b.y - a.y) / L;
    let nx = uy * orient; let ny = -ux * orient;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pointInPolygon({ x: mid.x + nx * 0.05, y: mid.y + ny * 0.05 }, pts)) { nx = -nx; ny = -ny; }
    const count = Math.max(1, Math.floor((L - 1) / 2.4));
    const floors = isHouse ? (wallH > 4 ? [1.0, 3.3] : [1.0]) : [1.1];
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      for (const fy of floors) {
        const wdw = boxMesh(ctx, 1.0, 1.1, 0.06, a.x + ux * L * t + nx * 0.03, fy, a.y + uy * L * t + ny * 0.03, '#34495e', { roughness: 0.25, metalness: 0.3 });
        wdw.rotation.y = -Math.atan2(uy, ux);
        g.add(wdw);
        const frame = boxMesh(ctx, 1.12, 0.06, 0.09, a.x + ux * L * t + nx * 0.03, fy + 1.1, a.y + uy * L * t + ny * 0.03, '#f3efe6');
        frame.rotation.y = wdw.rotation.y; g.add(frame);
      }
    }
  }
  // toit
  const c = pts.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n }), { x: 0, y: 0 });
  let best = { L: 0, ux: 1, uy: 0 };
  for (let i = 0; i < n; i++) {
    const a = pts[i]; const b = pts[(i + 1) % n]; const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L > best.L) best = { L, ux: (b.x - a.x) / L, uy: (b.y - a.y) / L };
  }
  const { ux, uy } = best; const vx = -uy; const vy = ux;
  let u0 = Infinity; let u1 = -Infinity; let v0 = Infinity; let v1 = -Infinity;
  for (const p of pts) {
    const pu = (p.x - c.x) * ux + (p.y - c.y) * uy; const pv = (p.x - c.x) * vx + (p.y - c.y) * vy;
    u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv);
  }
  const fill = Math.abs(signedArea(pts)) / Math.max(1e-6, (u1 - u0) * (v1 - v0));
  if (isHouse && fill > 0.72) {
    const over = 0.4;
    let w = u1 - u0 + over * 2; let d = v1 - v0 + over * 2;
    const alongU = w >= d; // faîtage le long de la plus grande dimension
    const rw = alongU ? w : d; const rd = alongU ? d : w;
    const { slopes, gables } = gableGeometries(THREE, rw, rd, roofH + 0.1);
    const rg = new THREE.Group();
    const cu = (u0 + u1) / 2; const cv = (v0 + v1) / 2;
    rg.position.set(c.x + ux * cu + vx * cv, wallH, c.y + uy * cu + vy * cv);
    rg.rotation.y = -Math.atan2(alongU ? uy : vy, alongU ? ux : vx);
    const rm = new THREE.Mesh(ctx.track(slopes), ctx.mat('#ffffff', { roughness: 0.85, map: ctx.tex('roof', roofTexture), side: THREE.DoubleSide }));
    rm.userData.snow = true;
    rg.add(rm);
    rg.add(new THREE.Mesh(ctx.track(gables), ctx.mat('#ece4d4', { roughness: 0.92, side: THREE.DoubleSide })));
    g.add(rg);
    // cheminée
    const ch = boxMesh(ctx, 0.5, 1.3, 0.5, c.x + ux * cu * 0.6, wallH + roofH * 0.6, c.y + uy * cu * 0.6, '#9b6a55');
    g.add(ch);
  } else {
    const slab = new THREE.Mesh(ctx.track(polyGeometry(THREE, pts, 0.14)), ctx.mat('#5b5b5b', { roughness: 0.8 }));
    slab.position.y = wallH; slab.userData.snow = true;
    g.add(slab);
  }
  return shadowed(g);
}

/** Tronçons [t0, t1] (0..1) d'un côté de longueur L, privés des passages `gaps` ([{t, w}] en mètres). */
export function segmentsWithGaps(L, gaps) {
  if (!gaps.length) return [[0, 1]];
  const cuts = gaps.map((g) => [Math.max(0, g.t - g.w / 2 / L), Math.min(1, g.t + g.w / 2 / L)]).sort((a, b) => a[0] - b[0]);
  const out = []; let cur = 0;
  for (const [a, b] of cuts) { if (a > cur + 1e-4) out.push([cur, a]); cur = Math.max(cur, b); }
  if (cur < 1 - 1e-4) out.push([cur, 1]);
  return out;
}

/** Matériau effectif d'un mur (pierre|béton|brique, défaut béton) ou d'une clôture (bois|métal|béton|grillage, défaut bois). */
export function linearMaterial(kind, material) {
  if (kind === 'wall') return ['stone', 'concrete', 'brick'].includes(material) ? material : 'concrete';
  if (kind === 'fence') return ['wood', 'metal', 'concrete', 'mesh'].includes(material) ? material : 'wood';
  return null;
}

/** Mur / clôture / haie linéaire entre a et b (plan), hauteur h, épaisseur th ; `o.material`, `o.ghost` (estompé). */
export function buildLinear(ctx, kind, a, b, h, th, t0 = 0, t1 = 1, o = {}) {
  const { THREE } = ctx;
  const L = Math.hypot(b.x - a.x, b.y - a.y) * (t1 - t0);
  if (L < 0.02) return null;
  const mx = a.x + (b.x - a.x) * (t0 + t1) / 2; const my = a.y + (b.y - a.y) * (t0 + t1) / 2;
  const material = linearMaterial(kind, o.material);
  const gh = o.ghost ? { transparent: true, opacity: 0.38, depthWrite: false } : {};
  const mt = (c, x = {}) => ctx.mat(c, { ...x, ...gh });
  const grp = new THREE.Group();
  const box = (w, hh, d, x, y, z, color, opts) => { const m = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, hh, d)), mt(color, opts)); m.position.set(x, y + hh / 2, z); grp.add(m); return m; };
  const posts = (w, color, cap, capColor) => {
    const n = Math.max(2, Math.ceil(L / 2.2) + 1);
    for (let i = 0; i < n; i++) { const x = -L / 2 + (L * i) / (n - 1); box(w, h + 0.05, w, x, 0, 0, color, { roughness: 0.8 }); if (cap) box(w + 0.05, 0.04, w + 0.05, x, h + 0.05, 0, capColor || color, { roughness: 0.8 }); }
  };
  const bars = (count, bw, bh, color, horizontal) => { // barreaux / fils fins instanciés
    const im = new THREE.InstancedMesh(ctx.track(new THREE.BoxGeometry(1, 1, 1)), mt(color, { roughness: 0.5, metalness: 0.4 }), count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      if (horizontal) { m4.makeScale(L, bw, bw); m4.setPosition(0, 0.08 + ((h - 0.12) * i) / Math.max(1, count - 1), 0); }
      else { m4.makeScale(bw, bh, bw); m4.setPosition(-L / 2 + 0.05 + ((L - 0.1) * i) / Math.max(1, count - 1), 0.04 + bh / 2, 0); }
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true; grp.add(im); return im;
  };
  if (kind === 'hedge') {
    box(L, h, th, 0, 0, 0, '#ffffff', { roughness: 1, map: ctx.tex('leaf', leafTexture, L, h) });
  } else if (kind === 'fence') {
    if (material === 'wood') {
      box(L, h * 0.94, th, 0, h * 0.02, 0, '#ffffff', { roughness: 0.85, map: ctx.tex('fence', fenceTexture, L, h) });
      posts(0.09, '#6d4c36', true, '#55392a');
    } else if (material === 'metal') {
      bars(Math.max(2, Math.floor(L / 0.11)), 0.018, h * 0.9, '#2f3a40', false);
      bars(2, 0.04, 0, '#2b343a', true).userData.rail = true;
      posts(0.06, '#2b343a', true);
    } else if (material === 'concrete') {
      box(L, h, th * 1.4, 0, 0, 0, '#c4c4bf', { roughness: 0.95 });
      for (let x = -L / 2 + 2; x < L / 2 - 0.1; x += 2) box(0.025, h, th * 1.4 + 0.012, x, 0, 0, '#85857f', { roughness: 1 });
      box(L, 0.05, th * 1.4 + 0.06, 0, h, 0, '#b0b0aa', { roughness: 0.9 });
      posts(0.12, '#b5b5b0', false);
    } else { // grillage : maille fine sur poteaux
      bars(Math.max(2, Math.floor(L / 0.12)), 0.006, h * 0.92, '#9aa6ab', false);
      bars(Math.max(2, Math.floor(h / 0.12)), 0.006, 0, '#9aa6ab', true);
      box(L, 0.03, 0.03, 0, h, 0, '#7b868b', { roughness: 0.6, metalness: 0.4 });
      posts(0.05, '#7b868b', false);
    }
  } else if (kind === 'wall') {
    if (material === 'brick') box(L, h, th, 0, 0, 0, '#ffffff', { roughness: 0.9, map: ctx.tex('brick', brickTexture, L, h) });
    else if (material === 'stone') box(L, h, th, 0, 0, 0, '#ffffff', { roughness: 1, map: ctx.tex('stonewall', stoneWallTexture, L, h) });
    else {
      box(L, h, th, 0, 0, 0, '#cfcfca', { roughness: 0.95 });
      for (let x = -L / 2 + 2.5; x < L / 2 - 0.1; x += 2.5) box(0.02, h, th + 0.012, x, 0, 0, '#8d8d88', { roughness: 1 });
    }
    box(L + 0.04, 0.08, th + 0.08, 0, h, 0, '#b9b2a4', { roughness: 0.9 });
  } else {
    box(L, h, th, 0, 0, 0, '#d8d1c3', { roughness: 0.95 });
  }
  grp.userData = { kind, material };
  grp.name = `linear-${kind}${material ? `-${material}` : ''}`;
  grp.position.set(mx, 0, my);
  grp.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  return shadowed(grp);
}

/** Portail / porte posés sur un passage (géométrie issue de `openingGeometry`). */
export function buildOpening(ctx, opening, kind, geo) {
  const { THREE } = ctx;
  const h = HAUTEUR_OUVERTURE[opening.kind] || 1.6;
  const grp = new THREE.Group();
  const color = (kind && kind.color) || '#6d4c41';
  const wood = ctx.mat('#ffffff', { roughness: 0.8, map: ctx.tex('fence', (T) => fenceTexture(T, color), geo.width, h) });
  const leaf = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(geo.width, h, 0.07)), wood);
  leaf.position.y = h / 2;
  grp.add(leaf);
  if (opening.kind === 'gate' || opening.kind === 'double_gate' || opening.kind === 'wicket') {
    for (const s of [-1, 1]) grp.add(boxMesh(ctx, 0.14, h + 0.25, 0.14, s * (geo.width / 2), 0, 0, '#5d5750'));
  }
  grp.position.set(geo.center.x + geo.normal.x * 0.03, 0, geo.center.y + geo.normal.y * 0.03);
  grp.rotation.y = -Math.atan2(geo.u.y, geo.u.x);
  return shadowed(grp);
}

/** Élément d'aménagement (mobilier / équipement / structure), centré en (item.x, item.y) et orienté selon `rotation`. */
export function buildItem(ctx, item, kind) {
  const { THREE } = ctx;
  const g = new THREE.Group();
  const id = item.kind;
  const radius = Number.isFinite(item.radius) && item.radius > 0 ? item.radius : null;
  const w = radius ? radius * 2 : (item.width || (kind && kind.w) || 0.6);
  const d = radius ? radius * 2 : (item.depth || (kind && kind.d) || 0.6);
  const H = item.height != null ? item.height : ((kind && kind.height) || HAUTEUR_ITEM[id] || 0.5);
  const col = (kind && kind.color) || '#a1887f';
  const wood = '#8d6e63'; const metal = '#4a4f55';
  const legs = (top, th = 0.05, inset = 0.06, color = wood) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(boxMesh(ctx, th, top, th, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), color));
  };
  switch (id) {
    case 'bench':
      g.add(boxMesh(ctx, w, 0.06, d, 0, 0.42, 0, col)); g.add(boxMesh(ctx, w, 0.4, 0.05, 0, 0.5, -d / 2 + 0.03, col)); legs(0.42, 0.06, 0.08); break;
    case 'table': g.add(boxMesh(ctx, w, 0.06, d, 0, H - 0.06, 0, col)); legs(H - 0.06, 0.07, 0.08); break;
    case 'table_round': g.add(cylMesh(ctx, w / 2, w / 2, 0.05, 0, H - 0.05, 0, col)); g.add(cylMesh(ctx, 0.05, 0.08, H - 0.05, 0, 0, 0, metal)); break;
    case 'chair': g.add(boxMesh(ctx, w, 0.05, d, 0, 0.45, 0, col)); g.add(boxMesh(ctx, w, 0.4, 0.04, 0, 0.45, -d / 2 + 0.03, col)); legs(0.45, 0.04, 0.04); break;
    case 'lounge':
      g.add(boxMesh(ctx, w, 0.4, d * 0.3, 0, 0, -d / 2 + d * 0.15, col)); g.add(boxMesh(ctx, w, 0.38, 0.12, 0, 0.4, -d / 2 + 0.06, col));
      g.add(boxMesh(ctx, w * 0.3, 0.4, d * 0.5, -w / 2 + w * 0.15, 0, d * 0.2, col)); g.add(boxMesh(ctx, w * 0.45, 0.4, d * 0.3, w * 0.15, 0, d * 0.18, '#cfd8dc')); break;
    case 'sunbed': {
      g.add(boxMesh(ctx, w, 0.16, d * 0.62, 0, 0.18, d * 0.19, col));
      const back = boxMesh(ctx, w, 0.1, d * 0.38, 0, 0, 0, col); back.position.set(0, 0.42, -d * 0.31); back.rotation.x = 0.5; g.add(back); break;
    }
    case 'parasol': g.add(cylMesh(ctx, 0.03, 0.03, H, 0, 0, 0, '#e0e0e0')); g.add(cylMesh(ctx, 0.04, w / 2, 0.55, 0, H - 0.5, 0, col, { side: THREE.DoubleSide }, 16)); break;
    case 'hammock':
      for (const s of [-1, 1]) g.add(boxMesh(ctx, 0.08, H, 0.08, s * (w / 2 - 0.1), 0, 0, wood));
      g.add(boxMesh(ctx, w - 0.4, 0.06, 0.55, 0, 0.7, 0, col)); break;
    case 'bbq': g.add(boxMesh(ctx, w, 0.6, d, 0, 0.3, 0, '#3a3a3a')); g.add(boxMesh(ctx, w, 0.2, d, 0, 0.9, 0, '#222')); legs(0.3, 0.04, 0.05, metal); break;
    case 'firepit': g.add(cylMesh(ctx, w / 2, w / 2 * 0.8, H, 0, 0, 0, '#5a4a40', {}, 16)); g.add(cylMesh(ctx, w / 2 - 0.06, w / 2 - 0.06, 0.02, 0, H - 0.02, 0, '#ff7a1a', { emissive: '#ff5a00', emissiveIntensity: 0.6 }, 16)); break;
    case 'composter': g.add(boxMesh(ctx, w, H, d, 0, 0, 0, '#4e342e')); g.add(boxMesh(ctx, w + 0.06, 0.06, d + 0.06, 0, H, 0, '#2e2a27')); break;
    case 'rain_tank': g.add(cylMesh(ctx, w / 2, w / 2, H, 0, 0, 0, col, { roughness: 0.4 }, 20)); g.add(cylMesh(ctx, w / 2 + 0.02, w / 2 + 0.02, 0.05, 0, H, 0, '#37474f', {}, 20)); break;
    case 'planter': g.add(boxMesh(ctx, w, H, d, 0, 0, 0, '#8a6b52')); g.add(boxMesh(ctx, w - 0.08, 0.05, d - 0.08, 0, H, 0, '#4b3426')); {
      const bush = new THREE.Mesh(ctx.track(new THREE.IcosahedronGeometry(Math.min(w, d) * 0.4, 1)), ctx.mat('#5fa046', { roughness: 0.9, flatShading: true })); bush.position.set(0, H + 0.12, 0); bush.scale.set(w / (2 * Math.min(w, d) * 0.4) * 0.9, 0.7, 1); g.add(bush);
    } break;
    case 'raised_bed': g.add(boxMesh(ctx, w, H, d, 0, 0, 0, '#a78660')); g.add(boxMesh(ctx, w - 0.1, 0.04, d - 0.1, 0, H - 0.02, 0, '#4b3426')); break;
    case 'woodpile': g.add(boxMesh(ctx, w, H * 0.85, d, 0, 0, 0, '#9a7a56')); g.add(boxMesh(ctx, w + 0.1, 0.06, d + 0.15, 0, H * 0.85, 0, '#4a4036')); break;
    case 'clothesline':
      for (const s of [-1, 1]) g.add(cylMesh(ctx, 0.03, 0.03, H, s * (w / 2), 0, 0, '#9e9e9e', {}, 8));
      g.add(boxMesh(ctx, w, 0.015, 0.015, 0, H - 0.1, 0, '#cfcfcf')); break;
    case 'mailbox': g.add(boxMesh(ctx, 0.07, H - 0.3, 0.07, 0, 0, 0, '#6d6d6d')); g.add(boxMesh(ctx, w, 0.3, d, 0, H - 0.3, 0, col)); break;
    case 'light': g.add(cylMesh(ctx, 0.025, 0.04, H, 0, 0, 0, '#37474f', {}, 8)); {
      const lamp = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(0.13, 12, 8)), ctx.mat('#fff4b0', { emissive: '#ffe58a', emissiveIntensity: 0.9 })); lamp.position.y = H + 0.05; g.add(lamp);
    } break;
    case 'fountain': g.add(cylMesh(ctx, w / 2, w / 2, 0.45, 0, 0, 0, '#b0aaa0', {}, 20)); g.add(cylMesh(ctx, w / 2 - 0.07, w / 2 - 0.07, 0.02, 0, 0.42, 0, '#58a6d1', { roughness: 0.1 }, 20)); g.add(cylMesh(ctx, 0.07, 0.1, H, 0, 0, 0, '#b0aaa0', {}, 10)); break;
    case 'swing':
      for (const s of [-1, 1]) { const leg1 = boxMesh(ctx, 0.08, H + 0.1, 0.08, s * (w / 2 - 0.1), 0, -d * 0.3, '#8d6e63'); leg1.rotation.x = 0.25; g.add(leg1); const leg2 = boxMesh(ctx, 0.08, H + 0.1, 0.08, s * (w / 2 - 0.1), 0, d * 0.3, '#8d6e63'); leg2.rotation.x = -0.25; g.add(leg2); }
      g.add(boxMesh(ctx, w, 0.1, 0.1, 0, H, 0, '#6d4c41')); g.add(boxMesh(ctx, 0.5, 0.05, 0.2, 0, 0.45, 0, col));
      for (const s of [-1, 1]) g.add(boxMesh(ctx, 0.015, H - 0.5, 0.015, s * 0.22, 0.5, 0, '#222')); break;
    case 'trampoline': g.add(cylMesh(ctx, w / 2, w / 2, 0.04, 0, H - 0.04, 0, '#1c1f2a', {}, 28)); g.add(cylMesh(ctx, w / 2 + 0.03, w / 2 + 0.03, 0.08, 0, H - 0.06, 0, col, {}, 28));
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.add(boxMesh(ctx, 0.05, H - 0.05, 0.05, Math.cos(a) * w / 2 * 0.95, 0, Math.sin(a) * w / 2 * 0.95, '#555')); } break;
    case 'sandbox': g.add(boxMesh(ctx, w, H, d, 0, 0, 0, '#a1887f')); g.add(boxMesh(ctx, w - 0.12, 0.03, d - 0.12, 0, H - 0.02, 0, '#f0d58c')); break;
    case 'playhouse': case 'shed_item': {
      const roofH = id === 'playhouse' ? 0.5 : 0.25;
      g.add(boxMesh(ctx, w, H - roofH, d, 0, 0, 0, id === 'playhouse' ? '#c9a57a' : col));
      const { slopes, gables } = gableGeometries(THREE, w + 0.2, d + 0.2, roofH);
      const roof = new THREE.Group(); roof.position.y = H - roofH;
      roof.add(new THREE.Mesh(ctx.track(slopes), ctx.mat(id === 'playhouse' ? '#b5523b' : '#4e4e4e', { roughness: 0.85, side: THREE.DoubleSide })));
      roof.add(new THREE.Mesh(ctx.track(gables), ctx.mat(col, { side: THREE.DoubleSide }))); g.add(roof);
      g.add(boxMesh(ctx, 0.55, Math.min(1.7, H * 0.7), 0.05, 0, 0, d / 2 + 0.02, '#5d4037')); break;
    }
    case 'greenhouse': {
      const glass = { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1, depthWrite: false };
      g.add(boxMesh(ctx, w, H * 0.65, d, 0, 0, 0, '#cfeee8', glass));
      const { slopes, gables } = gableGeometries(THREE, w, d, H * 0.35);
      const roof = new THREE.Group(); roof.position.y = H * 0.65;
      roof.add(new THREE.Mesh(ctx.track(slopes), ctx.mat('#cfeee8', { ...glass, side: THREE.DoubleSide })));
      roof.add(new THREE.Mesh(ctx.track(gables), ctx.mat('#cfeee8', { ...glass, side: THREE.DoubleSide }))); g.add(roof);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(boxMesh(ctx, 0.05, H * 0.65, 0.05, sx * w / 2, 0, sz * d / 2, '#e6e6e6'));
      g.add(boxMesh(ctx, w, 0.04, d, 0, 0, 0, '#6a5646')); break;
    }
    case 'pergola':
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(boxMesh(ctx, 0.14, H, 0.14, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), '#7d6652'));
      for (const sz of [-1, 1]) g.add(boxMesh(ctx, w, 0.15, 0.12, 0, H, sz * (d / 2 - 0.1), '#7d6652'));
      for (let k = 0; k <= 7; k++) g.add(boxMesh(ctx, 0.07, 0.08, d + 0.3, -w / 2 + (w * k) / 7, H + 0.15, 0, '#8d7660')); break;
    case 'gazebo':
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(boxMesh(ctx, 0.1, H - 0.4, 0.1, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), '#c9c9c9'));
      { const roof = new THREE.Mesh(ctx.track(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 0.98, 0.7, 4)), ctx.mat('#e8e2d4', { roughness: 0.8 })); roof.position.y = H - 0.4 + 0.35; roof.rotation.y = Math.PI / 4; g.add(roof); } break;
    default:
      if (radius) g.add(cylMesh(ctx, radius, radius, H, 0, 0, 0, col)); else g.add(boxMesh(ctx, w, H, d, 0, 0, 0, col));
  }
  g.position.set(item.x, 0, item.y);
  g.rotation.y = -(((item.rotation || 0) * Math.PI) / 180);
  return shadowed(g);
}

/**
 * Échelle d'accès d'une piscine hors sol : marches extérieures et intérieures, posées au point (x, z) du bord,
 * `ux, uz` = direction du centre de la piscine vers l'extérieur, `h` = hauteur de la paroi.
 */
export function buildPoolLadder(ctx, x, z, ux, uz, h) {
  const { THREE } = ctx;
  const grp = new THREE.Group(); grp.name = 'echelle-piscine';
  const metal = ctx.mat('#b0bec5', { roughness: 0.35, metalness: 0.7 });
  const top = h + 0.35;
  const rail = (x0, y0, x1, y1, zc) => {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const m = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.025, 0.025, L, 8)), metal);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, zc);
    m.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
    grp.add(m);
  };
  for (const zc of [-0.22, 0.22]) {
    rail(0.55, 0, 0.12, top, zc); // montants extérieurs
    rail(0.12, top, -0.4, h - 0.55, zc); // montants intérieurs (vers l'eau)
  }
  for (const t of [0.25, 0.5, 0.75]) {
    const rung = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8)), metal);
    rung.rotation.x = Math.PI / 2; rung.position.set(0.55 - 0.43 * t, top * t, 0);
    grp.add(rung);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = -Math.atan2(uz, ux);
  return shadowed(grp);
}
