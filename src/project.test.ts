import { describe, it, expect } from "vitest";
import { fromCsv, projectFromJson, toCsv } from "./project";
import type { Project } from "./types";
const p: Project = {
  schema_version: 1,
  name: "测试",
  description: "元数据",
  materials: [
    {
      name: "Air",
      n: 1,
      sellmeier: null,
      range_nm: [380, 780],
      source: "ideal",
    },
  ],
  surfaces: [
    {
      name: '面, "A"\n下一行',
      curvature: 0.02,
      conic: -1,
      asphere: [1e-5, 0, 0, 0],
      thickness: 3,
      semi_aperture: 5,
      material: 0,
    },
  ],
  stop: 0,
  object_distance: null,
  sensor: [36, 24],
  fields: [0, 0.07, 0.1],
  wavelengths: [{ nm: 587.56, weight: 1 }],
};
describe("portable project format", () => {
  it("preserves materials, settings and quoted multiline names in CSV", () => {
    expect(fromCsv(toCsv(p))).toEqual(p);
  });
  it("rejects incompatible schema", () => {
    expect(() =>
      projectFromJson(JSON.stringify({ ...p, schema_version: 99 })),
    ).toThrow();
  });
  it("rejects missing metadata", () => {
    expect(() => fromCsv("name,radius\nA,5")).toThrow();
  });
  it("rejects nonfinite CSV values", () => {
    expect(() => fromCsv(toCsv(p).replace(",0.02,", ",Infinity,"))).toThrow();
  });
});
