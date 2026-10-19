import { describe, it, expect } from "vitest";
import file from "../examples/400mm-repaired.oos.json";
import workflow from "../examples/400mm-workflow-0.8.oos.json";
import { projectFromJson, toCsv, fromCsv, copy } from "./project";
import { addVersion, restoreVersion, prescription } from "./versions";
import {
  defaultAperture,
  opticalKey,
  candidateKey,
  scanProject,
  validAperture,
  validGroups,
  validScan,
} from "./design";
import { defaultSetting, optimizationError } from "./optimization";
import type { ApertureScan, Project } from "./types";
const lens = () => projectFromJson(JSON.stringify(file));
function saved(): Project {
  const p = lens();
  p.workspace!.groups = [{ id: "middle", name: "中组", start: 2, end: 5 }];
  p.workspace!.constraints!.design = {
    f_number: 16,
    f_tolerance: 0.1,
    min_bfl_mm: 1,
    max_front_diameter_mm: 70,
  };
  p.workspace!.aperture = { ...defaultAperture, f_numbers: [16] };
  p.workspace!.aperture_scan = {
    source: prescription(p),
    options: copy(p.workspace!.aperture),
    best_index: 0,
    points: [
      {
        requested_f_number: 16,
        actual_f_number: 16,
        stop_radius_mm: p.surfaces[p.stop].semi_aperture,
        image_distance_mm: p.surfaces.at(-1)!.thickness,
        fields_rms_um: [9, 8, 14],
        score_um: 11,
        failed: 0,
        sampled: 441,
        aiming_failed: 0,
        blocked: 0,
        mtf: [],
        diagnostic: null,
      },
    ],
  };
  return p;
}
describe("0.8 persisted design workflows", () => {
  it("binds candidates to names, targets and bounds while allowing unrelated report metadata", () => {
    const p = saved(),
      initial = candidateKey(p),
      q = copy(p);
    q.workspace!.groups = [];
    q.workspace!.aperture = { ...defaultAperture };
    expect(candidateKey(q)).toBe(initial);
    q.workspace!.constraints!.design!.f_number = 2.8;
    expect(candidateKey(q)).not.toBe(initial);
    const r = copy(p);
    r.workspace!.optimization!.variables[0].locked = true;
    expect(candidateKey(r)).not.toBe(initial);
    const renamed = copy(p);
    renamed.name = "新的项目名称";
    expect(candidateKey(renamed)).not.toBe(initial);
  });
  it("opens the engine-produced 400 mm sweep, including clipped and converged MTF points", () => {
    const p = projectFromJson(JSON.stringify(workflow));
    expect(fromCsv(toCsv(p))).toEqual(p);
    expect(p.workspace?.aperture_scan?.points).toHaveLength(5);
    expect(p.workspace?.aperture_scan?.points[0].score_um).toBeNull();
    expect(
      p.workspace?.aperture_scan?.points[3].mtf[2].quality?.converged,
    ).toBe(true);
    expect(opticalKey(p)).toBe(opticalKey(p.workspace!.aperture_scan!.source));
  });
  it("round trips scans, goals, groups and original version in JSON and CSV", () => {
    const p = saved();
    expect(projectFromJson(JSON.stringify(p))).toEqual(p);
    expect(fromCsv(toCsv(p))).toEqual(p);
    expect(p.workspace!.versions).toHaveLength(2);
  });
  it("workspace edits never change optical identity, but physical edits invalidate scans", () => {
    const p = lens(),
      q = saved();
    expect(opticalKey(p)).toBe(opticalKey(q));
    q.surfaces[2].curvature += 0.001;
    expect(opticalKey(q)).not.toBe(
      opticalKey(q.workspace!.aperture_scan!.source),
    );
  });
  it("rejects broken aperture ranges, sampled result counts and nested workspaces", () => {
    expect(validAperture({ ...defaultAperture, f_numbers: [0] })).toBe(false);
    expect(validAperture({ ...defaultAperture, sampling: 8 })).toBe(false);
    const p = saved();
    p.workspace!.aperture_scan!.points[0].failed = 9999;
    expect(() => projectFromJson(JSON.stringify(p))).toThrow();
    const q = saved();
    (q.workspace!.aperture_scan!.source as Project).workspace = copy(
      q.workspace,
    );
    expect(() => projectFromJson(JSON.stringify(q))).toThrow();
  });
  it("rejects groups that split glass bodies, overlap or exceed the prescription", () => {
    const p = saved(),
      g = p.workspace!.groups!;
    expect(validGroups(p, g)).toBe(true);
    expect(validGroups(p, [{ ...g[0], start: 3 }])).toBe(false);
    expect(validGroups(p, [...g, { ...g[0], id: "duplicate" }])).toBe(false);
    expect(validGroups(p, [{ ...g[0], end: 99 }])).toBe(false);
  });
  it("saves group definitions in named versions and restores them without changing optics", () => {
    const p = saved(),
      v = addVersion(p, p, "编组");
    expect(v.groups).toEqual(p.workspace!.groups);
    p.workspace!.groups = [];
    const q = restoreVersion(p, v.prescription, v.analysis_preset, v.groups);
    expect(q.workspace!.groups).toEqual(v.groups);
    expect(opticalKey(p)).toEqual(opticalKey(q));
  });
  it("only reconstructs a candidate from a scored point and retains independent source data", () => {
    const p = saved(),
      scan = p.workspace!.aperture_scan!;
    expect(validScan(scan)).toBe(true);
    const q = scanProject(scan, 0);
    expect(q.surfaces[p.stop].semi_aperture).toBe(
      scan.points[0].stop_radius_mm,
    );
    q.surfaces[0].curvature = 0;
    expect(scan.source.surfaces[0].curvature).not.toBe(0);
    const bad: ApertureScan = copy(scan);
    bad.points[0].score_um = null;
    expect(() => scanProject(bad, 0)).toThrow();
  });
  it("exposes a bounded aperture variable only on the declared stop surface", () => {
    const p = lens(),
      setting = defaultSetting(p, { kind: "aperture", surface: p.stop });
    expect(setting.min).toBeGreaterThan(0);
    const o = {
      variables: [setting],
      preset: "balanced" as const,
      max_iterations: 25,
    };
    expect(optimizationError(p, o)).toBe("");
    o.variables[0].variable.surface = 0;
    expect(optimizationError(p, o)).not.toBe("");
  });
});
