import { describe, it, expect } from "vitest";
import fixture from "../examples/35mm-coverage.oos.json";
import { projectFromJson, toCsv, fromCsv, copy } from "./project";
import {
  fieldLabel,
  fieldTargets,
  setFieldSpec,
  sensorHeights,
} from "./fields";
import {
  addVersion,
  restoreVersion,
  alignedPair,
  commonSensorPlane,
  configurationMatches,
} from "./versions";
import { opticalKey, candidateKey } from "./design";
import { insertLens, blankProject } from "./lenses";
import { defaultOptimization, optimizationError } from "./optimization";
const lens = () => projectFromJson(JSON.stringify(fixture));
describe("0.9 sensor coverage contracts", () => {
  it("matches the full-frame ideal starting angles without presenting them as actual traced angles", () => {
    const p = lens(),
      heights = sensorHeights(p);
    expect(heights[2]).toBeCloseTo(21.63330765, 7);
    expect(heights.map((h) => (Math.atan(h / 35) * 180) / Math.PI)).toEqual(
      expect.arrayContaining([
        expect.closeTo(18.9246, 3),
        expect.closeTo(27.2161, 3),
        expect.closeTo(31.71998, 3),
      ]),
    );
    expect(fieldTargets(p)).toEqual([0, ...heights]);
    expect(fieldLabel(p, 3)).toBe("像高 21.63 mm");
  });
  it("persists linked sensor fields, custom image heights and quality floors through JSON, CSV and named versions", () => {
    const p = lens();
    p.workspace = {
      schema_version: 1,
      versions: [],
      optimization: {
        ...defaultOptimization(p),
        staged: true,
        refocus_each_stage: true,
      },
    };
    addVersion(p, p, "sensor baseline");
    setFieldSpec(
      p,
      { mode: "image_heights", heights_mm: [0, 12, 18, 21.633] },
      35,
    );
    addVersion(p, p, "height targets");
    for (const q of [projectFromJson(JSON.stringify(p)), fromCsv(toCsv(p))])
      expect(q).toEqual(p);
    const restored = restoreVersion(p, p.workspace.versions[0].prescription);
    expect(restored.field_spec?.mode).toBe("sensor");
    expect(restored.schema_version).toBe(3);
  });
  it("lens insertion and mechanical edits do not downgrade the new field schema", () => {
    const p = blankProject(lens(), "new");
    insertLens(p, "biconvex");
    expect(p.schema_version).toBe(3);
    expect(projectFromJson(JSON.stringify(p))).toEqual(p);
  });
  it("height mode and sensor changes invalidate computations and optimization scope", () => {
    const p = lens(),
      q = copy(p);
    setFieldSpec(q, undefined);
    expect(opticalKey(p)).not.toBe(opticalKey(q));
    expect(configurationMatches(p, q)).toBe(false);
    q.sensor[0] = 24;
    expect(candidateKey(p)).not.toBe(candidateKey(q));
    const pair = alignedPair(q, p);
    expect(pair[1].field_spec).toBeUndefined();
  });
  it("compares at one absolute sensor plane and rejects an impossible shared plane", () => {
    const p = lens(),
      q = copy(p);
    q.surfaces[0].thickness += 3;
    const pair = commonSensorPlane([p, q]);
    const sum = (p: typeof q) =>
      p.surfaces.reduce((v, s) => v + s.thickness, 0);
    expect(sum(pair[0])).toBeCloseTo(sum(pair[1]), 12);
    expect(q.surfaces[0].thickness).toBe(p.surfaces[0].thickness + 3);
    q.surfaces[0].thickness = 100;
    expect(() => commonSensorPlane([p, q])).toThrow("共同像面");
  });
  it("rejects malformed or incompatible height fields and per-field guards before editing", () => {
    const p = lens();
    expect(() =>
      projectFromJson(JSON.stringify({ ...p, schema_version: 2 })),
    ).toThrow("v3");
    expect(() =>
      projectFromJson(
        JSON.stringify({
          ...p,
          field_spec: { mode: "image_heights", heights_mm: ["corner"] },
        }),
      ),
    ).toThrow("视场");
    const o = defaultOptimization(p);
    o.quality!.max_rms_um = [10];
    expect(optimizationError(p, o)).toContain("逐视场");
    o.quality!.max_rms_um = [];
    o.quality!.min_geometric_fraction = 2;
    expect(optimizationError(p, o)).toContain("逐视场");
  });
});
