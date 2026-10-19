import type { Project, Coverage } from "./types";
export const MAX_FIELD_RAD = 0.7;
export function validCoverage(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object") return false;
  const c = value as Coverage;
  return (
    Array.isArray(c.sensor_mm) &&
    c.sensor_mm.length === 2 &&
    c.sensor_mm.every((v) => Number.isFinite(v) && v > 0) &&
    Number.isFinite(c.half_diagonal_mm) &&
    Math.abs(c.half_diagonal_mm - Math.hypot(...c.sensor_mm) / 2) < 1e-6 &&
    (c.max_tested_height_mm === null ||
      Number.isFinite(c.max_tested_height_mm)) &&
    Number.isFinite(c.reference_wavelength_nm) &&
    Number.isFinite(c.image_z_mm) &&
    Number.isInteger(c.sampling) &&
    c.sampling >= 3 &&
    c.sampling <= 65 &&
    typeof c.focus_condition === "string" &&
    Array.isArray(c.fields) &&
    c.fields.length <= 15 &&
    c.fields.every(
      (f) =>
        f &&
        Number.isFinite(f.angle_rad) &&
        (f.chief_height_mm === null || Number.isFinite(f.chief_height_mm)) &&
        [f.sampled, f.blocked, f.unresolved, f.other_failed].every(
          (v) => Number.isInteger(v) && v >= 0,
        ) &&
        f.blocked + f.unresolved + f.other_failed <= f.sampled &&
        Number.isFinite(f.geometric_fraction) &&
        f.geometric_fraction >= 0 &&
        f.geometric_fraction <= 1 &&
        [f.fast_mtf, f.wide_mtf].every((s) =>
          ["outside_model", "not_calculated", "failed", "converged"].includes(
            s,
          ),
        ),
    ) &&
    Array.isArray(c.checkpoints) &&
    c.checkpoints.length === 3 &&
    c.checkpoints.every(
      (p) =>
        p &&
        typeof p.label === "string" &&
        Number.isFinite(p.height_mm) &&
        ["untested", "unresolved", "clipped", "sampled_clear"].includes(
          p.status,
        ) &&
        (p.tested_field_index === null ||
          (Number.isInteger(p.tested_field_index) &&
            p.tested_field_index >= 0 &&
            p.tested_field_index < c.fields.length)),
    ) &&
    Array.isArray(c.warnings) &&
    c.warnings.every((v) => typeof v === "string")
  );
}
export const sensorHeights = (p: Project) => [
  Math.min(...p.sensor) / 2,
  Math.max(...p.sensor) / 2,
  Math.hypot(...p.sensor) / 2,
];
export function fieldTargets(p: Project): number[] | null {
  return p.field_spec?.mode === "sensor"
    ? [0, ...sensorHeights(p)]
    : p.field_spec?.mode === "image_heights"
      ? p.field_spec.heights_mm
      : null;
}
export function fieldLabel(p: Project, i: number) {
  const targets = fieldTargets(p);
  return targets
    ? `像高 ${targets[i]?.toFixed(2) ?? "—"} mm`
    : `${(((p.fields[i] ?? 0) * 180) / Math.PI).toFixed(2)}°`;
}
export function validFieldSpec(value: Project["field_spec"]) {
  return (
    value === undefined ||
    (!!value &&
      (value.mode === "sensor" ||
        (value.mode === "image_heights" &&
          Array.isArray(value.heights_mm) &&
          value.heights_mm.length > 0 &&
          value.heights_mm.length <= 15 &&
          value.heights_mm.every(
            (h) => Number.isFinite(h) && Math.abs(h) <= 10000,
          ))))
  );
}
export function setFieldSpec(
  p: Project,
  spec: Project["field_spec"],
  efl = 50,
) {
  p.field_spec = spec;
  if (spec) p.schema_version = 3;
  const targets = fieldTargets(p);
  if (targets)
    p.fields = targets.map((h) =>
      Math.max(
        -MAX_FIELD_RAD,
        Math.min(MAX_FIELD_RAD, Math.atan(h / Math.abs(efl))),
      ),
    );
}
