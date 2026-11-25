import { encodeGarden, decodeGarden, buildShareLink, buildAppLink, codeFromUrl, routeFromIncomingUrl, describeGarden, sizeInfo } from '../../transfer.js';
import { createGarden, createZone } from '../../model.js';

function riche() {
  const g = createGarden('Jardin é à ñ 🌳');
  g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  g.context.region = 'Bretagne';
  g.obstacles.push({ id: 'o1', kind: 'tree', center: { x: 2, y: 2 }, radius: 2, height: 6 });
  const z = createZone('lawn', { kind: 'polygon', points: g.boundary });
  z.plantings.push({ plantId: 'p1', count: 3 }, { plantId: 'p2', count: 2 });
  g.zones.push(z);
  g.plan.svg = '<svg>' + 'x'.repeat(5000) + '</svg>';
  return g;
}

describe('aller-retour', () => {
  test('jardin riche conservé, plan.svg retiré', async () => {
    const g = riche();
    const code = await encodeGarden(g);
    expect(code).toMatch(/^v2u?\.[0-9a-z]+\.[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(JSON.stringify(g).length);
    const r = await decodeGarden(code);
    expect(r.name).toBe(g.name);
    expect(r.boundary).toEqual(g.boundary);
    expect(r.zones[0].plantings).toEqual(g.zones[0].plantings);
    expect(r.obstacles).toEqual(g.obstacles);
    expect(r.plan.svg).toBeNull();
    expect(r.sun).toBeTruthy();
  });
  test('repli non compressé (v1u.)', async () => {
    const CS = globalThis.CompressionStream;
    globalThis.CompressionStream = undefined;
    try {
      const code = await encodeGarden(riche());
      expect(code.startsWith('v2u.')).toBe(true);
      expect((await decodeGarden(code)).name).toBe(riche().name);
    } finally { globalThis.CompressionStream = CS; }
  });
  test('valeurs par défaut complétées', async () => {
    const code = await encodeGarden({ name: 'Mini', boundary: [], zones: [] });
    const r = await decodeGarden(code);
    expect(r.context).toBeTruthy();
    expect(r.tasksDone).toEqual({});
  });
});

describe('erreurs', () => {
  test.each(['', 'abc', 'v1.', 'v1.@@@', 'v1.AAAA', 'v1u.AAAA'])('code illisible %p', async (c) => {
    await expect(decodeGarden(c)).rejects.toThrow(/illisible|reconnu|invalide/i);
  });
  test('version inconnue', async () => {
    await expect(decodeGarden('v9.AAAA')).rejects.toThrow(/version plus récente/);
  });
  test('code corrompu au milieu', async () => {
    const code = await encodeGarden(riche());
    await expect(decodeGarden(code.slice(0, 20) + 'zzzz' + code.slice(30))).rejects.toThrow();
  });
  test('JSON valide mais pas un jardin', async () => {
    const code = 'v1u.' + Buffer.from('{"a":1}').toString('base64url');
    await expect(decodeGarden(code)).rejects.toThrow(/reconnu/);
  });
});

describe('liens', () => {
  const code = 'v1.AbC-_123';
  test('construction', () => {
    expect(buildShareLink(code, 'https://niafrond.github.io/jardin/')).toBe('https://niafrond.github.io/jardin/#/import/v1.AbC-_123');
    expect(buildAppLink(code)).toBe('jardin://import/v1.AbC-_123');
  });
  test('codeFromUrl', () => {
    expect(codeFromUrl('https://niafrond.github.io/jardin/#/import/' + code)).toBe(code);
    expect(codeFromUrl('jardin://import/' + code)).toBe(code);
    expect(codeFromUrl('intent://import/' + code + '#Intent;scheme=jardin;end')).toBe(code);
    expect(codeFromUrl('  v1.AbC\n-_123 \n')).toBe(code);
    expect(codeFromUrl('bonjour')).toBeNull();
    expect(codeFromUrl('')).toBeNull();
    expect(codeFromUrl(null)).toBeNull();
  });
  test('routeFromIncomingUrl', () => {
    expect(routeFromIncomingUrl('jardin://import/' + code)).toBe('#/import/' + code);
    expect(routeFromIncomingUrl('https://niafrond.github.io/jardin/#/import/' + code)).toBe('#/import/' + code);
    expect(routeFromIncomingUrl('https://niafrond.github.io/jardin/')).toBeNull();
    expect(routeFromIncomingUrl(code)).toBeNull();
    expect(routeFromIncomingUrl(undefined)).toBeNull();
  });
});

test('describeGarden', () => {
  expect(describeGarden(riche())).toEqual({ name: 'Jardin é à ñ 🌳', areaM2: 80, zones: 1, plants: 5, items: 1 });
  expect(describeGarden({}).areaM2).toBe(0);
});
test('sizeInfo', () => {
  expect(sizeInfo('v1.abc')).toEqual({ length: 6, fitsQr: true });
  expect(sizeInfo('v1.' + 'a'.repeat(3000)).fitsQr).toBe(false);
});

describe('transfert : liens légers et détection des liens coupés', () => {
  const riche = () => {
    const g = createGarden('Gros');
    g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.status = 'validated';
    // vues isométriques SVG du plan validé : plusieurs centaines de Ko, régénérables
    g.plan = { svg: '<svg>' + 'x'.repeat(200000) + '</svg>', validatedAt: '2026-01-01', views: { 'iso-ne': '<svg>' + 'y'.repeat(300000) + '</svg>', 'iso-se': '<svg>' + 'z'.repeat(300000) + '</svg>' } };
    g.context.gpsSurveyDraft = { points: Array.from({ length: 50 }, (_, i) => ({ x: i, y: i })) };
    return g;
  };

  test('les vues du plan et le brouillon GPS ne sont jamais dans le code (lien court)', async () => {
    const code = await encodeGarden(riche());
    expect(code.length).toBeLessThan(4000);
    const g = await decodeGarden(code);
    expect(g.plan.views == null || Object.keys(g.plan.views).length === 0).toBe(true);
    expect(g.name).toBe('Gros');
  });

  test('format v2 : longueur de contrôle, aller-retour', async () => {
    const code = await encodeGarden(riche());
    expect(code).toMatch(/^v2u?\.[0-9a-z]+\./);
    expect((await decodeGarden(code)).boundary).toHaveLength(4);
  });

  test('un lien coupé est reconnu comme tel, avec un message clair', async () => {
    const code = await encodeGarden(riche());
    await expect(decodeGarden(code.slice(0, code.length - 30))).rejects.toThrow(/Lien coupé : \d+ caractères reçus sur \d+/);
  });

  test('code avec retours à la ligne ou encodage % : toujours lu', async () => {
    const code = await encodeGarden(riche());
    const coupe = code.replace(/(.{40})/g, '$1\n');
    expect((await decodeGarden(coupe)).name).toBe('Gros');
    expect(codeFromUrl(`https://niafrond.github.io/jardin/#/import/${code}`)).toBe(code);
  });

  test('les anciens codes v1 restent lisibles', async () => {
    const json = JSON.stringify({ format: 'jardin-v1', garden: { name: 'Ancien', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }], zones: [] } });
    const g = await decodeGarden('v1u.' + Buffer.from(json).toString('base64url'));
    expect(g.name).toBe('Ancien');
  });
});
