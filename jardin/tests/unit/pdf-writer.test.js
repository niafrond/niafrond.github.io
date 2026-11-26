import { PdfDocument, A4, A4_LANDSCAPE, winAnsiBytes, textWidth, wrapText, jpegInfo, escapePdfString } from '../../pdf-writer.js';

const latin = (u8) => Buffer.from(u8).toString('latin1');
async function exemple() {
  const d = new PdfDocument({ title: 'Jardin é', author: 'Test', subject: 'Sujet', keywords: 'a, b' });
  const p1 = d.addPage(A4); const p2 = d.addPage(A4_LANDSCAPE);
  const L1 = d.addLayer('Terrain'); const L2 = d.addLayer('Zones', { on: false });
  const im = d.addImage({ type: 'rgb', width: 2, height: 2, data: new Uint8Array(12).fill(120) });
  const rgba = new Uint8Array(16); rgba[3] = 100; rgba[7] = 255;
  const im2 = d.addImage({ type: 'rgba', width: 2, height: 2, data: rgba });
  p1.text('Été à la ferme : œuf « ok » ✔ → 😀', 40, 60);
  p1.rect(40, 80, 50, 20, { fill: '#cde', stroke: '#036', radius: 4 });
  p1.image(im, 100, 80, 40, 40, { layer: L1 });
  p1.layer(L2, () => p1.image(im2, 150, 80, 40, 40));
  p1.link(40, 80, 50, 20, { page: p2 });
  p1.link(40, 120, 50, 20, { url: 'https://example.org' });
  p2.text('Page 2', 40, 60, { font: 'bold' });
  d.addOutline('Un', p1); d.addOutline('Deux', p2); d.addOutline('Sous-section', p2, 1);
  return d.save();
}

describe('pdf-writer', () => {
  test('en-tête, fin de fichier, xref aux offsets exacts', async () => {
    const bytes = await exemple(); const s = latin(bytes);
    expect(s.startsWith('%PDF-1.5')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(s)[1]);
    expect(s.slice(startxref, startxref + 4)).toBe('xref');
    const lines = s.slice(startxref).split('\n');
    const [, size] = lines[1].split(' ').map(Number);
    for (let i = 1; i < size; i++) {
      const off = Number(lines[2 + i].slice(0, 10));
      expect(s.slice(off, off + String(i).length + 6)).toBe(`${i} 0 obj`);
    }
    expect(lines[2]).toBe('0000000000 65535 f ');
  });
  test('pages, polices, images, calques, liens, signets, métadonnées', async () => {
    const s = latin(await exemple());
    expect(s).toMatch(/\/Type \/Pages \/Kids \[[^\]]+\] \/Count 2/);
    expect(s).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(s).toContain('/BaseFont /Helvetica-Bold');
    expect((s.match(/\/Subtype \/Image/g) || []).length).toBeGreaterThanOrEqual(3); // 2 images + masque
    expect(s).toContain('/SMask');
    expect(s).toContain('/OCProperties');
    expect((s.match(/\/Type \/OCG/g) || []).length).toBe(2);
    expect(s).toMatch(/\/OFF \[\d+ 0 R\]/);
    expect(s).toContain('/Subtype /Link');
    expect(s).toContain('/URI (https://example.org)');
    expect(s).toContain('/Type /Outlines');
    expect(s).toContain('/Count 3');
    expect(s).toContain('/Title <FEFF004A00610072'); // « Jar… » en UTF-16BE
    expect(s).toContain('/Lang (fr-FR)');
    expect(s).toMatch(/\/CreationDate \(D:\d{14}Z\)/);
  });
  test('contenu des pages : texte accentué présent et marqueurs de calques', async () => {
    const bytes = await exemple(); const s = latin(bytes);
    // le contenu est compressé si CompressionStream existe : on le relit via les flux ou en clair
    const hasZ = s.includes('/FlateDecode');
    if (!hasZ) { expect(s).toContain('\\311t\\351'); expect(s).toContain('/OC /L1 BDC'); }
    else {
      const { inflateSync } = await import('node:zlib');
      let all = '';
      for (const m of s.matchAll(/stream\n/g)) {
        const start = m.index + 7; const end = s.indexOf('\nendstream', start);
        try { all += latin(inflateSync(Buffer.from(bytes.subarray(start, end)))) + '\n'; } catch { /* image ou autre */ }
      }
      expect(all).toContain('\\311t\\351 \\340 la ferme'); // « Été à la ferme » en octal WinAnsi
      expect(all).toContain('\\234uf'); // œ = 0x9C
      expect(all).toContain('/OC /L1 BDC'); expect(all).toContain('EMC');
      expect(all).not.toMatch(/\\360/); // l'emoji est retiré
    }
  });
  test('WinAnsi : accents conservés, symboles remplacés', () => {
    expect(winAnsiBytes('é€œ')).toEqual([0xe9, 0x80, 0x9c]);
    expect(String.fromCharCode(...winAnsiBytes('a → b ✔'))).toBe('a -> b v');
    expect(winAnsiBytes('😀')).toEqual([]);
    expect(escapePdfString([0x28, 0x5c, 0xe9])).toBe('(\\(\\\\\\351)');
  });
  test('mesure et retour à la ligne', () => {
    expect(textWidth('Hello', 10)).toBeCloseTo(22.78, 1);
    expect(textWidth('Hello', 10, 'bold')).toBeGreaterThan(textWidth('Hello', 10));
    const l = wrapText('un deux trois quatre cinq six sept', 50, 10);
    expect(l.length).toBeGreaterThan(1);
    for (const x of l) expect(textWidth(x, 10)).toBeLessThanOrEqual(50.01);
    expect(wrapText('supercalifragilisticexpialidocious', 40, 10).length).toBeGreaterThan(1);
  });
  test('jpegInfo lit les dimensions', () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 20, 0, 30, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
    expect(jpegInfo(jpg)).toEqual({ bits: 8, height: 20, width: 30, components: 3 });
    expect(jpegInfo(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
