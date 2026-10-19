import type { Project, Surface } from "./types";
import { copy } from "./project";
export interface Lens {
  start: number;
  end: number;
  name: string;
}
export function lenses(p: Project): Lens[] {
  const result: Lens[] = [];
  for (let i = 0; i < p.surfaces.length - 1; i++) {
    if (p.surfaces[i].material === 0) continue;
    const start = i;
    while (i < p.surfaces.length - 1 && p.surfaces[i].material !== 0) i++;
    result.push({
      start,
      end: i,
      name: p.surfaces[start].name.replace(/ · 前面$/, ""),
    });
  }
  return result;
}
export const lensAt = (p: Project, surface: number) =>
  lenses(p).find((l) => surface >= l.start && surface <= l.end);
export const templates = {
  biconvex: "双凸透镜",
  plano: "平凸透镜",
  biconcave: "双凹透镜",
  meniscus: "弯月透镜",
  doublet: "胶合双片",
};
export type LensKind = keyof typeof templates;
const surface = (
  name: string,
  radius: number,
  thickness: number,
  material: number,
): Surface => ({
  name,
  curvature: radius ? 1 / radius : 0,
  thickness,
  material,
  semi_aperture: 8,
  conic: 0,
  asphere: [0, 0, 0, 0],
  mechanical: { semi_diameter: 10, shape: "flat" },
});
export function insertLens(p: Project, kind: LensKind): number {
  if (p.materials.length < 2)
    p.materials.push({
      name: "定折射率教学玻璃",
      n: 1.52,
      sellmeier: null,
      range_nm: [380, 780],
      source: "OSS synthetic constant-index teaching material",
    });
  if (kind === "doublet" && p.materials.length < 3)
    p.materials.push({
      name: "定折射率教学火石",
      n: 1.62,
      sellmeier: null,
      range_nm: [380, 780],
      source: "OSS synthetic constant-index teaching material",
    });
  const name = templates[kind];
  const radii: Record<LensKind, number[]> = {
    biconvex: [50, -50],
    plano: [0, -50],
    biconcave: [-50, 50],
    meniscus: [35, 60],
    doublet: [40, -30, -100],
  };
  const rs = radii[kind];
  if (p.surfaces.length + rs.length + (p.surfaces.length ? 0 : 1) > 100)
    throw Error("最多支持 100 个表面");
  p.schema_version = Math.max(2, p.schema_version);
  if (!p.surfaces.length) {
    const stop = surface("光阑", 0, 2, 0);
    stop.semi_aperture = 4;
    delete stop.mechanical;
    p.surfaces.push(stop);
    p.stop = 0;
  } else {
    // The former image distance becomes the air gap preceding the new lens.
    // Keep it explicit and unchanged; the new final surface gets its own image gap.
    if (p.surfaces.at(-1)!.material !== 0)
      throw Error("末面仍在玻璃中，请先补齐出射面");
  }
  const start = p.surfaces.length;
  p.surfaces.push(
    ...rs.map((r, i) =>
      surface(
        `${name} · ${i === 0 ? "前面" : i === rs.length - 1 ? "后面" : "胶合面"}`,
        r,
        i === rs.length - 1 ? 50 : i === 0 ? 5 : 3,
        i === rs.length - 1 ? 0 : i + 1,
      ),
    ),
  );
  return start;
}
export function removeLens(p: Project, l: Lens) {
  const count = l.end - l.start + 1;
  if (l.start > 0)
    p.surfaces[l.start - 1].thickness += p.surfaces[l.end].thickness;
  p.surfaces.splice(l.start, count);
  if (p.stop > l.end) p.stop -= count;
  else if (p.stop >= l.start)
    p.stop = Math.max(0, Math.min(l.start - 1, p.surfaces.length - 1));
}
export function duplicateLens(p: Project, l: Lens) {
  const block = copy(p.surfaces.slice(l.start, l.end + 1));
  if (p.surfaces.length + block.length > 100)
    throw Error("最多支持 100 个表面");
  block.forEach((s) => {
    s.name += " 副本";
  });
  p.surfaces.splice(l.end + 1, 0, ...block);
  if (p.stop > l.end) p.stop += block.length;
  return l.end + 1;
}
export function blankProject(source: Project, name: string): Project {
  const p = copy(source);
  delete p.workspace;
  p.schema_version = Math.max(2, p.schema_version);
  p.name = name.trim() || "未命名项目";
  p.description = "用户创建的镜头设计";
  p.surfaces = [];
  p.stop = 0;
  return p;
}
