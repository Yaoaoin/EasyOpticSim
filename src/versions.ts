import { copy } from "./project";
import type {
  Analysis,
  AnalysisPreset,
  Constraints,
  DesignVersion,
  Prescription,
  Project,
  Wave,
  OpticalGroup,
  MotionWorkspace,
} from "./types";
import { defaultOptimization } from "./optimization";
import { validGroups } from "./design";

// Only the optical prescription crosses the engine boundary or enters a version.
export function prescription(p: Project): Prescription {
  const { workspace: _workspace, ...model } = p;
  return copy(model);
}
export function ensureWorkspace(p: Project) {
  return (p.workspace ??= { schema_version: 1, versions: [] });
}
export function addVersion(
  p: Project,
  source: Project,
  name: string,
  note = "",
): DesignVersion {
  const w = ensureWorkspace(p);
  if (w.versions.length >= 20)
    throw Error("最多保存 20 个版本，请删除不需要的版本后再添加。");
  const v = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 120) || `版本 ${w.versions.length + 1}`,
    created_at: new Date().toISOString(),
    note: note.slice(0, 1000),
    prescription: prescription(source),
    ...(source.workspace?.motion
      ? { motion: copy(source.workspace.motion) }
      : {}),
    analysis_preset:
      source.workspace?.optimization?.preset ??
      p.workspace?.optimization?.preset ??
      "balanced",
    ...((source.workspace?.groups ?? p.workspace?.groups) &&
    validGroups(source, source.workspace?.groups ?? p.workspace!.groups!)
      ? { groups: copy(source.workspace?.groups ?? p.workspace!.groups!) }
      : {}),
  };
  w.versions.push(v);
  if (new TextEncoder().encode(JSON.stringify(p, null, 2)).length > 4_000_000) {
    w.versions.pop();
    throw Error("新增版本会超过 4 MB 项目限制，请先减少版本或材料记录。");
  }
  return v;
}
export function restoreVersion(
  current: Project,
  version: Prescription,
  preset?: AnalysisPreset,
  groups?: OpticalGroup[],
  motion?: MotionWorkspace,
): Project {
  const restored: Project = {
    ...copy(version),
    ...(current.workspace ? { workspace: copy(current.workspace) } : {}),
  };
  if (motion) ensureWorkspace(restored).motion = copy(motion);
  else if (restored.workspace) delete restored.workspace.motion;
  if (
    restored.surfaces.length !== current.surfaces.length &&
    restored.workspace?.optimization
  )
    restored.workspace.optimization.variables = [];
  if (preset)
    ensureWorkspace(restored).optimization = {
      ...(restored.workspace?.optimization ?? defaultOptimization(restored)),
      preset,
    };
  if (groups !== undefined || restored.workspace?.groups)
    ensureWorkspace(restored).groups = copy(
      groups ??
        (restored.surfaces.length === current.surfaces.length
          ? (current.workspace?.groups ?? [])
          : []),
    );
  if (restored.workspace?.optimization?.quality) {
    const g = restored.workspace.optimization.quality;
    if (g.max_rms_um.length && g.max_rms_um.length !== restored.fields.length)
      g.max_rms_um = [];
  }
  return restored;
}
export function defaultConstraints(p: Project, efl = 50): Constraints {
  return {
    target_efl_mm: efl,
    efl_tolerance_mm: 0.5,
    max_length_mm: Math.max(
      1,
      p.surfaces.reduce((sum, s) => sum + s.thickness, 0) * 1.1,
    ),
    min_center_mm: 1,
    min_edge_mm: 0.5,
    min_air_mm: 0,
  };
}
export function comparisonConfiguration(p: Project) {
  return {
    fields: p.fields,
    field_spec: p.field_spec,
    wavelengths: p.wavelengths,
    object_distance: p.object_distance,
    sensor: p.sensor,
  };
}
export function configurationMatches(a: Project, b: Project) {
  return (
    JSON.stringify(comparisonConfiguration(a)) ===
    JSON.stringify(comparisonConfiguration(b))
  );
}
export function alignedPair(a: Project, b: Project): [Project, Project] {
  return [
    prescription(a),
    {
      ...prescription(b),
      ...copy(comparisonConfiguration(a)),
      schema_version: a.field_spec
        ? Math.max(3, b.schema_version)
        : b.schema_version,
    },
  ];
}
export function commonSensorPlane(
  pair: [Project, Project],
): [Project, Project] {
  const [a, b] = copy(pair),
    z = a.surfaces.reduce((v, s) => v + s.thickness, 0),
    back = b.surfaces.slice(0, -1).reduce((v, s) => v + s.thickness, 0);
  if (!b.surfaces.length || z <= back)
    throw Error(
      "B 的最后一面位于 A 的共同像面后方；请选择分别重新对焦或调整处方。",
    );
  b.surfaces.at(-1)!.thickness = z - back;
  return [a, b];
}
export function spotExtent(results: Analysis[]) {
  return (
    results.reduce(
      (max, a) =>
        a.spots.reduce((max, s) => {
          const c = a.fields.find((f) => f.field === s.field)?.centroid;
          return c
            ? s.points.reduce(
                (max, p) => Math.max(max, Math.hypot(p[0] - c[0], p[1] - c[1])),
                max,
              )
            : max;
        }, max),
      0.005,
    ) * 1.15
  );
}
// Density (not pixel mass) makes shared PSF brightness meaningful at different pitches.
export function psfDensity(w: Wave, xUm: number, yUm: number) {
  const x = xUm / w.pixel_um + w.size / 2,
    y = yUm / w.pixel_um + w.size / 2;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix + 1 >= w.size || iy + 1 >= w.size) return 0;
  const dx = x - ix,
    dy = y - iy,
    at = (i: number, j: number) => w.psf[j * w.size + i];
  return (
    ((1 - dx) * (1 - dy) * at(ix, iy) +
      dx * (1 - dy) * at(ix + 1, iy) +
      (1 - dx) * dy * at(ix, iy + 1) +
      dx * dy * at(ix + 1, iy + 1)) /
    (w.pixel_um * w.pixel_um)
  );
}
