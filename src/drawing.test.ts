import { describe, expect, it } from "vitest";
import {
  drawingGeometry,
  drawingStatus,
  fixed,
  vertices,
  type DrawingSnapshot,
} from "./drawing";
import source from "../examples/400mm-coverage-0.9.oos.json";
import { projectFromJson } from "./project";
describe("technical drawing geometry and provenance", () => {
  it("preserves optical geometry, exact annulus corners and surface coordinates", () => {
    const p = projectFromJson(JSON.stringify(source)),
      original = JSON.stringify(p);
    p.surfaces[0].mechanical = { semi_diameter: 40, shape: "flat" };
    p.surfaces[0].semi_aperture = 35;
    const edited = JSON.stringify(p),
      g = drawingGeometry(p),
      first = g.paths.find((a) => a.index === 0)!;
    expect(first.points.some((a) => a[1] === 35)).toBe(true);
    expect(first.points.find((a) => a[1] === 35)?.[0]).toBe(
      first.points.find((a) => a[1] === 40)?.[0],
    );
    expect(g.imageZ).toBe(p.surfaces.reduce((z, s) => z + s.thickness, 0));
    expect(vertices(p)[1]).toBe(p.surfaces[0].thickness);
    expect(JSON.stringify(p)).toBe(edited);
    expect(original).not.toBe(edited);
  });
  it("does not draw invented geometry for surfaces outside the sag domain", () => {
    const p = projectFromJson(JSON.stringify(source));
    p.surfaces[0].curvature = 10;
    const g = drawingGeometry(p);
    expect(g.invalid).toContain(0);
    expect(g.paths.some((a) => a.index === 0)).toBe(false);
  });
  it("marks missing analysis or failed rays as drafts and handles missing values", () => {
    const s = {
      project: projectFromJson(JSON.stringify(source)),
      analysis: null,
      geometry: null,
      errors: [],
    } as unknown as DrawingSnapshot;
    expect(drawingStatus(s)).toContain("设计草稿");
    expect(fixed(null)).toBe("未定义");
    expect(fixed(1e-12)).toContain("e-12");
  });
});
