import { Num } from "./Num";
import { useState } from "react";
import type { Project } from "./types";
import { duplicateLens, removeLens, type Lens } from "./lenses";
import { outerRadius } from "./project";
export default function LensEditor({
  project: p,
  lens: l,
  edit,
  select,
}: {
  project: Project;
  lens: Lens;
  edit: (fn: (p: Project) => void) => void;
  select: (i: number) => void;
}) {
  const [radiusInput, setRadiusInput] = useState(true);
  return (
    <div className="lens-editor">
      <h3>
        {l.end - l.start > 1 ? "胶合镜组" : "整枚镜片"} · S{l.start + 1}–S
        {l.end + 1}
      </h3>
      <p className="hint">
        光学面与专业模式共用同一处方。胶合面由相邻两片共享。
      </p>
      <label className="text-label">
        镜片 / 镜组名称
        <input
          value={l.name}
          onChange={(e) =>
            edit((q) => {
              q.surfaces[l.start].name = e.target.value + " · 前面";
            })
          }
        />
      </label>
      <label className="text-label">
        形状输入
        <select
          value={radiusInput ? "radius" : "curvature"}
          onChange={(e) => setRadiusInput(e.target.value === "radius")}
        >
          <option value="radius">曲率半径 R（0 = 平面）</option>
          <option value="curvature">曲率 c = 1/R</option>
        </select>
      </label>
      <Num
        label="机械外径"
        unit="mm"
        min={0.02}
        value={
          2 * Math.max(...p.surfaces.slice(l.start, l.end + 1).map(outerRadius))
        }
        onChange={(v) =>
          edit((q) => {
            q.schema_version = Math.max(2, q.schema_version);
            for (let i = l.start; i <= l.end; i++)
              q.surfaces[i].mechanical = {
                semi_diameter: v / 2,
                shape: q.surfaces[i].mechanical?.shape ?? "flat",
              };
          })
        }
      />
      {p.surfaces.slice(l.start, l.end).map((s, j) => (
        <div key={j} className="lens-layer">
          <b>{l.end - l.start > 1 ? `第 ${j + 1} 片` : "镜片参数"}</b>
          <Num
            label={`第 ${j + 1} 片中心厚度`}
            unit="mm"
            min={0.01}
            value={s.thickness}
            onChange={(v) =>
              edit((q) => {
                q.surfaces[l.start + j].thickness = v;
              })
            }
          />
          <label className="text-label">
            第 {j + 1} 片材料
            <select
              value={s.material}
              onChange={(e) =>
                edit((q) => {
                  q.surfaces[l.start + j].material = Number(e.target.value);
                })
              }
            >
              {p.materials.map(
                (m, i) =>
                  i > 0 && (
                    <option key={i} value={i}>
                      {m.name}
                    </option>
                  ),
              )}
            </select>
          </label>
        </div>
      ))}
      {p.surfaces.slice(l.start, l.end + 1).map((s, j) => (
        <details key={j} open className="lens-face">
          <summary>
            {j === 0 ? "前表面" : j === l.end - l.start ? "后表面" : "胶合面"} ·
            S{l.start + j + 1}
          </summary>
          <Num
            label={`S${l.start + j + 1} ${radiusInput ? "曲率半径" : "曲率"}`}
            unit={radiusInput ? "mm" : "1/mm"}
            step={radiusInput ? 0.1 : 0.001}
            value={
              radiusInput ? (s.curvature ? 1 / s.curvature : 0) : s.curvature
            }
            onChange={(v) =>
              edit((q) => {
                q.surfaces[l.start + j].curvature = radiusInput
                  ? v
                    ? 1 / v
                    : 0
                  : v;
              })
            }
          />
          <Num
            label={`S${l.start + j + 1} 有效直径`}
            unit="mm"
            min={0.02}
            value={2 * s.semi_aperture}
            onChange={(v) =>
              edit((q) => {
                q.surfaces[l.start + j].semi_aperture = v / 2;
              })
            }
          />
          <label className="text-label">
            S{l.start + j + 1} 边缘形式
            <select
              value={s.mechanical?.shape ?? "auto"}
              onChange={(e) =>
                edit((q) => {
                  q.schema_version = Math.max(2, q.schema_version);
                  const face = q.surfaces[l.start + j];
                  if (e.target.value === "auto") delete face.mechanical;
                  else
                    face.mechanical = {
                      semi_diameter: outerRadius(face),
                      shape: e.target.value as "flat" | "curved",
                    };
                })
              }
            >
              <option value="auto">无延伸（到有效口径）</option>
              <option value="flat">平面环带 / 方边</option>
              <option value="curved">继续曲面</option>
            </select>
          </label>
        </details>
      ))}
      <Num
        label={
          l.end === p.surfaces.length - 1 ? "镜后到像面距离" : "镜后空气间隔"
        }
        unit="mm"
        min={0.01}
        value={p.surfaces[l.end].thickness}
        onChange={(v) =>
          edit((q) => {
            q.surfaces[l.end].thickness = v;
          })
        }
      />
      <div className="inline-actions">
        <button
          disabled={p.surfaces.length + l.end - l.start + 1 > 100}
          onClick={() => edit((q) => select(duplicateLens(q, l)))}
        >
          复制整组
        </button>
        <button
          onClick={() =>
            edit((q) => {
              removeLens(q, l);
              select(Math.max(0, l.start - 1));
            })
          }
        >
          删除整组
        </button>
      </div>
      <p className="hint">
        环带仅作机械外形，超出有效口径的光线按遮挡处理。复制后保留镜后间隔；删除时合并两侧空气间隔。
      </p>
    </div>
  );
}
