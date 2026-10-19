import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  blankProject,
  insertLens,
  lenses,
  lensAt,
  removeLens,
  duplicateLens,
  templates,
  type LensKind,
} from "./lenses";
import {
  copy,
  projectFromJson,
  toCsv,
  fromCsv,
  profile,
  profileHeights,
} from "./project";
import { readdirSync } from "node:fs";
const original = projectFromJson(
  readFileSync(
    `examples/${readdirSync("examples").find((n) => n.endsWith(".json"))}`,
    "utf8",
  ),
);
describe("0.3 lens document lifecycle", () => {
  it("saves/reopens a genuinely empty project with settings and material snapshots", () => {
    const p = blankProject(original, "空白设计");
    expect(p.surfaces).toEqual([]);
    expect(p.stop).toBe(0);
    expect(projectFromJson(JSON.stringify(p))).toEqual(p);
    expect(fromCsv(toCsv(p))).toEqual(p);
    expect(original.surfaces.length).toBeGreaterThan(0);
  });
  for (const kind of Object.keys(templates) as LensKind[])
    it(`creates ${kind}, edits and roundtrips all mechanical faces`, () => {
      const p = blankProject(original, "新镜头");
      const start = insertLens(p, kind);
      expect(start).toBe(1);
      expect(lenses(p)).toHaveLength(1);
      const l = lenses(p)[0];
      expect(l.end - l.start).toBe(kind === "doublet" ? 2 : 1);
      for (let i = l.start; i <= l.end; i++) {
        p.surfaces[i].mechanical = {
          semi_diameter: 13,
          shape: i === l.start ? "curved" : "flat",
        };
      }
      p.surfaces[l.start].thickness = 6.75;
      p.surfaces[l.end].semi_aperture = 6.1;
      expect(projectFromJson(JSON.stringify(p))).toEqual(p);
      expect(fromCsv(toCsv(p))).toEqual(p);
      expect(lensAt(p, l.end)).toEqual(l);
    });
  it("duplicates/removes a whole doublet without splitting its shared cemented face", () => {
    const p = blankProject(original, "组合");
    insertLens(p, "doublet");
    const snapshot = copy(p),
      l = lenses(p)[0];
    const start = duplicateLens(p, l);
    expect(start).toBe(l.end + 1);
    expect(lenses(p)).toHaveLength(2);
    expect(p.surfaces.slice(start).map((s) => s.material)).toEqual(
      snapshot.surfaces.slice(l.start).map((s) => s.material),
    );
    p.stop = start;
    removeLens(p, l);
    expect(p.stop).toBe(1);
    expect(lenses(p)).toHaveLength(1);
    expect(snapshot.surfaces).toHaveLength(4);
  });
  it("preserves the exact flat-annulus corner and leaves clear aperture unchanged", () => {
    const p = blankProject(original, "边缘");
    insertLens(p, "meniscus");
    const s = p.surfaces[2];
    s.semi_aperture = 6.13;
    expect(profile(s, 6.13)).toBe(profile(s, 10));
    expect(profileHeights(s)).toContain(6.13);
    expect(profileHeights(s)).toContain(-6.13);
    expect(s.semi_aperture).toBe(6.13);
  });
  it("rejects malformed nested data before any editor or renderer sees it", () => {
    for (const bad of [
      null,
      { ...original, surfaces: [{}] },
      { ...original, materials: [{}] },
      { ...original, stop: -1 },
      { ...original, fields: [] },
      { ...original, sensor: [36] },
    ])
      expect(() => projectFromJson(JSON.stringify(bad))).toThrow();
  });
  it("keeps geometric mistakes editable and persistable", () => {
    const p = blankProject(original, "待修正");
    insertLens(p, "biconvex");
    p.surfaces[1].mechanical!.semi_diameter = 1;
    expect(projectFromJson(JSON.stringify(p))).toEqual(p);
  });
});
