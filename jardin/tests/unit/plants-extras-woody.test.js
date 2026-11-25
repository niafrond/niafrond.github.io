import woody from "../../data/plants/woody.js";
import extras from "../../data/plants/extras-woody.js";

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("extras des essences ligneuses", () => {
  test("couvre exactement les ids de woody.js", () => {
    expect(Object.keys(extras).sort()).toEqual(woody.map((p) => p.id).sort());
  });

  test.each(woody.map((p) => p.id))("%s : champs valides", (id) => {
    const x = extras[id];
    expect(typeof x.priceEur).toBe("number");
    expect(x.priceEur).toBeGreaterThan(0);
    expect(x.priceEur).toBeLessThan(500);
    expect((x.priceEur * 2) % 1).toBe(0);
    expect(x.priceUnit).toBe("plant");
    expect(typeof x.priceNote).toBe("string");
    expect(x.priceNote.length).toBeGreaterThan(0);
    expect(x.flowerColor === null || HEX.test(x.flowerColor)).toBe(true);
    expect(HEX.test(x.foliageColor)).toBe(true);
    expect(x.wiki === null || (typeof x.wiki === "string" && x.wiki.length > 0)).toBe(true);
  });
});
