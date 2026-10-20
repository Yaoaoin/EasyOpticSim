import doublet from "../examples/doublet.oos.json";
import wide from "../examples/35mm-coverage.oos.json";
import tele from "../examples/400mm-coverage-0.9.oos.json";
import type { Project } from "./types";
import { projectFromJson } from "./project";
import { defaultConstraints, ensureWorkspace } from "./versions";
import { setFieldSpec } from "./fields";

// Stable identifiers bind to explicit files, never library order or name matching.
export const starters = {
  portrait: {
    title: "人像与主体",
    subtitle: "学习主体成像与对焦",
    file: "doublet.oos.json",
    source: doublet,
    focal: 66,
    aperture: 6.6,
    distance: 2000,
    limitation: "双胶合教学模型，合成材料；未保证人像画质或全画幅覆盖。",
    difficulty: "入门探索",
  },
  landscape: {
    title: "风景与视野",
    subtitle: "观察画面中心到角落",
    file: "35mm-coverage.oos.json",
    source: wide,
    focal: 35,
    aperture: 35,
    distance: null,
    limitation: "35 mm F/35 单色教学模型，未校正摄影像差；小光圈不代表高画质。",
    difficulty: "覆盖实验",
  },
  telephoto: {
    title: "远处的细节",
    subtitle: "探索长焦镜头",
    file: "400mm-coverage-0.9.oos.json",
    source: tele,
    focal: 400,
    aperture: 16,
    distance: null,
    limitation: "400 mm F/16 示例；改变拍摄距离、画幅或目标后必须重新验证。",
    difficulty: "进阶探索",
  },
  closeup: {
    title: "近物观察",
    subtitle: "探索近距离对焦",
    file: "doublet.oos.json",
    source: doublet,
    focal: 66,
    aperture: 6.6,
    distance: 300,
    limitation: "双胶合近物实验，不保证微距倍率；需要重新寻找像面。",
    difficulty: "对焦实验",
  },
} satisfies Record<
  string,
  {
    title: string;
    subtitle: string;
    file: string;
    source: unknown;
    focal: number;
    aperture: number;
    distance: number | null;
    limitation: string;
    difficulty: string;
  }
>;
export type StarterId = keyof typeof starters;
export const sensorPresets = [
  { name: "全画幅", size: [36, 24] },
  { name: "APS-C（23.6 × 15.7）", size: [23.6, 15.7] },
  { name: "Micro 4/3", size: [17.3, 13] },
] as const;
export interface NewDesign {
  starter: StarterId;
  name: string;
  sensor: number;
  distance: number | null;
  focal: number;
  aperture: number;
}
export function createDesign(value: NewDesign): Project {
  if (
    !value.name.trim() ||
    !sensorPresets[value.sensor] ||
    !Number.isFinite(value.focal) ||
    value.focal < 1 ||
    value.focal > 2000 ||
    !Number.isFinite(value.aperture) ||
    value.aperture < 0.5 ||
    value.aperture > 128 ||
    (value.distance !== null &&
      (!Number.isFinite(value.distance) || value.distance < 10))
  )
    throw Error("请填写有效的名称、焦距、光圈和拍摄距离。");
  const template = starters[value.starter];
  const p = projectFromJson(JSON.stringify(template.source));
  const templateConstraints = p.workspace?.constraints;
  delete p.workspace;
  p.schema_version = 3;
  p.name = value.name.trim().slice(0, 120);
  p.description = `EOS 引导设计 · ${template.title} · 起点 ${template.file}。${template.limitation}`;
  p.sensor = [...sensorPresets[value.sensor].size];
  p.object_distance = value.distance;
  setFieldSpec(p, { mode: "sensor" }, template.focal);
  const constraints = templateConstraints
    ? { ...structuredClone(templateConstraints), target_efl_mm: value.focal }
    : defaultConstraints(p, value.focal);
  constraints.efl_tolerance_mm = Math.max(0.5, value.focal * 0.02);
  constraints.design = {
    f_number: value.aperture,
    f_tolerance: Math.max(0.1, value.aperture * 0.05),
    min_bfl_mm: 1,
    max_front_diameter_mm: Math.max(
      ...p.surfaces.map((s) => s.semi_aperture * 2),
    ),
  };
  ensureWorkspace(p).constraints = constraints;
  return p;
}
