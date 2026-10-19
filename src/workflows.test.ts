import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { copy, projectFromJson, fromCsv, toCsv } from "./project";
import {
  addVersion,
  alignedPair,
  configurationMatches,
  defaultConstraints,
  ensureWorkspace,
  prescription,
  psfDensity,
  restoreVersion,
  spotExtent,
} from "./versions";
import { zoomAt } from "./viewport";
import type { Analysis, Wave } from "./types";
const fixture = () =>
  projectFromJson(
    fs.readFileSync("examples/mechanical-annulus.oos.json", "utf8"),
  );
describe("0.4 versioned workflow", () => {
  it("persists named versions, constraints, focus and mechanics through JSON and CSV", () => {
    const p = fixture();
    addVersion(p, p, "基准");
    p.surfaces[1].thickness += 1;
    addVersion(p, p, "厚度方案");
    const w = ensureWorkspace(p);
    w.constraints = defaultConstraints(p);
    w.focus = {
      min_mm: 30,
      max_mm: 60,
      steps: 31,
      sampling: 17,
      criterion: "balanced",
    };
    for (const reopened of [
      projectFromJson(JSON.stringify(p)),
      fromCsv(toCsv(p)),
    ]) {
      expect(reopened).toEqual(p);
      expect(
        reopened.workspace!.versions[0].prescription.surfaces[1].thickness,
      ).not.toEqual(p.surfaces[1].thickness);
      expect(reopened.workspace!.versions[0].prescription).not.toHaveProperty(
        "workspace",
      );
    }
  });
  it("restores a detached prescription without losing any versions", () => {
    const p = fixture(),
      v = addVersion(p, p, "原始");
    p.surfaces[1].curvature = 0.01;
    addVersion(p, p, "修改");
    const q = restoreVersion(p, v.prescription);
    expect(q.workspace).toEqual(p.workspace);
    expect(q.surfaces).toEqual(v.prescription.surfaces);
    q.surfaces[1].thickness = 200;
    expect(v.prescription.surfaces[1].thickness).not.toBe(200);
    expect(prescription(q)).not.toHaveProperty("workspace");
  });
  it("rejects recursive, duplicate, malformed and excessive version records", () => {
    const p = fixture();
    addVersion(p, p, "记录");
    for (const mutate of [
      (q: typeof p) => {
        (q.workspace!.versions[0].prescription as typeof p).workspace = {
          schema_version: 1,
          versions: [],
        };
      },
      (q: typeof p) => {
        q.workspace!.versions.push(copy(q.workspace!.versions[0]));
      },
      (q: typeof p) => {
        q.workspace!.versions[0].prescription.surfaces[0].asphere = [] as never;
      },
      (q: typeof p) => {
        q.workspace!.versions[0].created_at = "bad";
      },
      (q: typeof p) => {
        q.workspace!.constraints = {
          ...defaultConstraints(p),
          max_length_mm: 0,
        };
      },
      (q: typeof p) => {
        q.workspace!.focus = {
          min_mm: 50,
          max_mm: 40,
          sampling: 17,
          steps: 31,
          criterion: "balanced",
        };
      },
    ]) {
      const q = copy(p);
      mutate(q);
      expect(() => projectFromJson(JSON.stringify(q))).toThrow();
    }
    for (let i = 1; i < 20; i++) addVersion(p, p, String(i));
    expect(() => addVersion(p, p, "21")).toThrow();
  });
  it("explicit alignment copies A settings and leaves both designs intact", () => {
    const a = fixture(),
      b = fixture();
    b.fields = [0];
    b.wavelengths = [{ nm: 550, weight: 1 }];
    b.object_distance = 1000;
    b.sensor = [10, 10];
    b.surfaces[1].curvature = 0.02;
    const before = JSON.stringify([a, b]);
    expect(configurationMatches(a, b)).toBe(false);
    const [x, y] = alignedPair(a, b);
    expect(configurationMatches(x, y)).toBe(true);
    expect(y.surfaces).toEqual(b.surfaces);
    expect(JSON.stringify([a, b])).toBe(before);
    y.fields.push(0.2);
    expect(a.fields).not.toContain(0.2);
  });
  it("uses the largest physical spot in either design for both scales", () => {
    const a = {
      fields: [{ field: 0, centroid: [1, 2] }],
      spots: [{ field: 0, points: [[1.01, 2]] }],
    } as Analysis;
    const b = {
      fields: [{ field: 0, centroid: [3, 4] }],
      spots: [{ field: 0, points: [[3.05, 4]] }],
    } as Analysis;
    expect(spotExtent([a, b])).toBeCloseTo(0.05 * 1.15, 12);
    expect(spotExtent([b, a])).toBe(spotExtent([a, b]));
  });
  it("compares PSF density at the same physical coordinates across pixel pitches", () => {
    const w = { size: 4, pixel_um: 1, psf: Array(16).fill(0.1) } as Wave;
    const x = { ...w, pixel_um: 2, psf: Array(16).fill(0.4) };
    expect(psfDensity(w, 0.25, -0.25)).toBeCloseTo(
      psfDensity(x, 0.25, -0.25),
      14,
    );
    expect(psfDensity(w, 10, 0)).toBe(0);
  });
  it("zoom preserves cursor anchor, clamps bounds and leaves project data untouched", () => {
    const view = { zoom: 2, x: 80, y: -40 },
      p = fixture(),
      before = JSON.stringify(p),
      q = zoomAt(view, 1.7, 300, 130);
    expect((300 - q.x) / q.zoom).toBeCloseTo((300 - view.x) / view.zoom, 12);
    expect((130 - q.y) / q.zoom).toBeCloseTo((130 - view.y) / view.zoom, 12);
    expect(zoomAt(view, 100, 0, 0).zoom).toBe(16);
    expect(zoomAt(view, 0.001, 0, 0).zoom).toBe(0.25);
    expect(JSON.stringify(p)).toBe(before);
  });
});
