import woody from "../../data/plants/woody.js";

const CATEGORIES = ["tree", "shrub", "hedge", "fruit", "climber"];
const ZONES = ["pond", "pool", "terrace", "path", "lawn", "lowplants", "midplants", "tallplants", "hedge", "trees", "vegetable", "orchard", "other"];
const SUNS = ["full", "partial", "shade"];
const WATERS = ["low", "medium", "high"];
const FOLIAGES = ["deciduous", "evergreen", "semi", "none"];
const MAINT = ["low", "medium", "high"];
const SOILS = ["clay", "limestone", "sandy", "loam", "humus"];
const isMonths = (a) => Array.isArray(a) && a.every((m) => Number.isInteger(m) && m >= 1 && m <= 12);

describe("catalogue des essences ligneuses", () => {
  test("au moins 70 entrées", () => {
    expect(Array.isArray(woody)).toBe(true);
    expect(woody.length).toBeGreaterThanOrEqual(70);
  });

  test("ids uniques, en slug, sans préfixe w-", () => {
    const ids = woody.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(id.startsWith("w-")).toBe(false);
    }
  });

  test.each(woody.map((p) => [p.id, p]))("%s est valide", (id, p) => {
    expect(typeof p.commonName).toBe("string");
    expect(p.commonName.length).toBeGreaterThan(1);
    expect(typeof p.latinName).toBe("string");
    expect(p.latinName.length).toBeGreaterThan(1);
    expect(CATEGORIES).toContain(p.category);
    expect(typeof p.heightAdult).toBe("number");
    expect(typeof p.widthAdult).toBe("number");
    expect(p.heightAdult).toBeGreaterThan(0);
    expect(p.heightAdult).toBeLessThanOrEqual(30);
    expect(p.widthAdult).toBeGreaterThan(0);
    expect(p.widthAdult).toBeLessThanOrEqual(20);
    expect(p.sun.length).toBeGreaterThan(0);
    for (const s of p.sun) expect(SUNS).toContain(s);
    expect(typeof p.hardiness).toBe("number");
    expect(p.hardiness).toBeLessThan(0);
    expect(p.hardiness).toBeGreaterThanOrEqual(-40);
    expect(WATERS).toContain(p.water);
    expect(Array.isArray(p.soil)).toBe(true);
    for (const s of p.soil) expect(SOILS).toContain(s);
    expect(FOLIAGES).toContain(p.foliage);
    expect(isMonths(p.bloom)).toBe(true);
    if (p.harvest !== undefined) expect(isMonths(p.harvest)).toBe(true);
    expect(Array.isArray(p.zones)).toBe(true);
    expect(p.zones.length).toBeGreaterThan(0);
    for (const z of p.zones) expect(ZONES).toContain(z);
    for (const k of ["invasive", "toxic", "melliferous", "edible", "windTolerant"]) {
      if (p[k] !== undefined) expect(typeof p[k]).toBe("boolean");
    }
    expect(MAINT).toContain(p.maintenance);
    expect(p.kc).toBeGreaterThanOrEqual(0.3);
    expect(p.kc).toBeLessThanOrEqual(1.1);
    expect(typeof p.spacing).toBe("number");
    expect(p.spacing).toBeGreaterThan(0);
    expect(p.care).toBeTruthy();
    for (const k of ["plantMonths", "pruneMonths", "fertMonths"]) expect(isMonths(p.care[k])).toBe(true);
    expect(p.care.plantMonths.length).toBeGreaterThan(0);
    for (const k of ["planting", "pruning", "fertilizer", "watering", "notes"]) {
      expect(typeof p.care[k]).toBe("string");
      expect(p.care[k].length).toBeGreaterThan(5);
    }
  });

  test("les fruitiers comestibles ont une période de récolte", () => {
    for (const p of woody.filter((x) => x.category === "fruit" && x.edible)) {
      expect(Array.isArray(p.harvest) && p.harvest.length > 0).toBe(true);
    }
  });

  test("toutes les catégories sont représentées", () => {
    for (const c of CATEGORIES) expect(woody.some((p) => p.category === c)).toBe(true);
  });
});
