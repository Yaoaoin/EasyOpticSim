import { expect, it } from "vitest";
import file from "../examples/24-70mm-zoom.oos.json";
import { projectFromJson } from "./project";
import { interpolate, synchronizeMotion, validMotion } from "./motion";
import { addVersion, restoreVersion } from "./versions";
const load = () => projectFromJson(JSON.stringify(file));
it("round trips all configurations and version motion snapshots", () => {
  const p = load();
  const v = addVersion(p, p, "Zoom reference");
  const saved = projectFromJson(JSON.stringify(p));
  expect(saved).toEqual(p);
  const restored = restoreVersion(
    saved,
    v.prescription,
    v.analysis_preset,
    v.groups,
    v.motion,
  );
  expect(restored.workspace?.motion).toEqual(p.workspace?.motion);
  expect(
    restoreVersion(saved, v.prescription).workspace?.motion,
  ).toBeUndefined();
});
it("rejects malformed and recursive motion data", () => {
  const p = load(),
    m = p.workspace!.motion!;
  expect(validMotion(m)).toBe(true);
  m.configurations[0].positions_mm = [0];
  expect(() => projectFromJson(JSON.stringify(p))).toThrow();
  const q = load();
  (q.workspace!.motion!.reference as typeof q).workspace = q.workspace;
  expect(validMotion(q.workspace!.motion!)).toBe(false);
});
it("interpolates positions but rejects incomparable object distances", () => {
  const [a, b] = load().workspace!.motion!.configurations;
  const c = interpolate(a, b, 0.5);
  expect(c.positions_mm[0]).toBeCloseTo(
    (a.positions_mm[0] + b.positions_mm[0]) / 2,
    12,
  );
  expect(() => interpolate(a, { ...b, object_distance: 1000 }, 0.5)).toThrow();
});
it("shares curvature edits, rebases gap deltas and invalidates topology", () => {
  const p = load(),
    q = structuredClone(p);
  q.surfaces[0].curvature += 0.001;
  q.surfaces[2].thickness += 1;
  synchronizeMotion(p, q);
  expect(q.workspace!.motion!.reference.surfaces[0].curvature).toBe(
    q.surfaces[0].curvature,
  );
  expect(q.workspace!.motion!.reference.surfaces[2].thickness).toBeCloseTo(
    p.surfaces[2].thickness + 1,
    12,
  );
  expect(q.workspace!.motion!.configurations).toEqual(
    p.workspace!.motion!.configurations,
  );
  q.surfaces.pop();
  synchronizeMotion(p, q);
  // A separately changed motion workspace is owned by its explicit edit path.
  const removed = structuredClone(p);
  removed.surfaces.pop();
  synchronizeMotion(p, removed);
  expect(removed.workspace!.motion).toBeUndefined();
});

it("does not rebase finite-field coordinates twice after a shared edit", () => {
  const p = load();
  delete p.field_spec;
  p.fields = [0, 0.01, 0.02];
  p.object_distance = 1072;
  p.workspace!.motion!.reference.fields = [0, 0.01072, 0.02144];
  const q = structuredClone(p);
  q.surfaces[0].curvature += 0.0001;
  synchronizeMotion(p, q);
  expect(q.workspace!.motion!.reference.fields).toEqual(
    p.workspace!.motion!.reference.fields,
  );
});
