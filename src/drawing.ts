import type {
  Analysis,
  FieldPlan,
  Geometry,
  Project,
  Wave,
  WaveOptions,
} from "./types";
import { outerRadius, profile, profileHeights } from "./project";
import { lenses } from "./lenses";
export interface DrawingSnapshot {
  project: Project;
  createdAt: string;
  analysis: Analysis | null;
  geometry: Geometry | null;
  fields: FieldPlan | null;
  waves: { index: number; result: Wave | null; error: string | null }[];
  errors: string[];
  sampling: number;
  waveMethod: WaveOptions["method"];
  sourceHash: string;
}
export function vertices(p: Project) {
  let z = 0;
  return p.surfaces.map((s) => {
    const at = z;
    z += s.thickness;
    return at;
  });
}
export function drawingGeometry(
  p: Project,
  start = 0,
  end = p.surfaces.length - 1,
) {
  const zs = vertices(p),
    paths: { index: number; points: [number, number][] }[] = [],
    invalid: number[] = [];
  for (let i = start; i <= end; i++) {
    const s = p.surfaces[i];
    if (!s) continue;
    const points = profileHeights(s).map(
      (r) => [zs[i] + profile(s, Math.abs(r)), r] as [number, number],
    );
    if (points.some((a) => !a.every(Number.isFinite))) invalid.push(i);
    else paths.push({ index: i, points });
  }
  const imageZ = p.surfaces.reduce((a, s) => a + s.thickness, 0);
  const xx = paths.flatMap((a) => a.points.map((t) => t[0]));
  const radius = Math.max(
    1,
    ...p.surfaces.slice(start, end + 1).map(outerRadius),
  );
  const minZ = Math.min(zs[start] ?? 0, ...xx),
    maxZ = Math.max(
      zs[end] ?? 1,
      ...xx,
      start === 0 && end === p.surfaces.length - 1 ? imageZ : -Infinity,
    );
  return { paths, invalid, minZ, maxZ, radius, imageZ, vertices: zs };
}
export function drawingLensGroups(p: Project) {
  return lenses(p);
}
export function drawingStatus(s: DrawingSnapshot) {
  if (!s.project.surfaces.length) return "空白处方";
  if (
    s.errors.length ||
    !s.geometry ||
    s.geometry?.diagnostics.length ||
    s.geometry.spans.some((v) => !v.certified) ||
    !s.analysis ||
    s.analysis.spots.some((a) => a.failed)
  )
    return "设计草稿 · 存在诊断或未完成检查";
  return "设计记录 · 声明几何采样完成";
}
export const fixed = (v: number | null | undefined, digits = 6): string =>
  v == null || !Number.isFinite(v)
    ? "未定义"
    : Math.abs(v) < 1e-4 && v !== 0
      ? v.toExponential(10)
      : Number(v.toPrecision(14)).toFixed(digits);
export async function sha256(text: string) {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
