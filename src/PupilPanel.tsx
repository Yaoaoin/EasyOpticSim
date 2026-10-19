import { useEffect, useRef, useState } from "react";
import { fieldLabel } from "./fields";
import type { Project, Ray, StopMap } from "./types";
import { compute } from "./engine";
import { opticalKey } from "./design";
import { explainError, rayFailureText } from "./errors";
export default function PupilPanel({
  project,
  onRay,
  onSurface,
}: {
  project: Project;
  onRay: (r: Ray | null) => void;
  onSurface: (i: number) => void;
}) {
  const [field, setField] = useState(0),
    [nm, setNm] = useState(project.wavelengths[0]?.nm ?? 587.5618),
    [sampling, setSampling] = useState(13),
    [map, setMap] = useState<StopMap | null>(null),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    key = opticalKey(project);
  useEffect(() => {
    controller.current?.abort();
    setMap(null);
    setBusy(false);
    setError("");
    onRay(null);
    return () => controller.current?.abort();
  }, [key, field, nm, sampling]);
  const select = (i: number, m = map) => {
    setSelected(i);
    const r = m?.samples[i]?.ray;
    onRay(r ?? null);
    if (r?.surface != null) onSurface(r.surface);
  };
  async function run() {
    const c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    setBusy(true);
    setError("");
    try {
      const m = await compute<StopMap>(
        crypto.randomUUID(),
        "stop_map",
        project,
        c.signal,
        {
          sampling,
          wave_options: {
            field_index: Math.min(field, project.fields.length - 1),
            wavelength_nm: nm,
            max_pupil_samples: 128,
          },
        },
      );
      if (c.signal.aborted) return;
      setMap(m);
      select(Math.floor(m.samples.length / 2), m);
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const ray = map?.samples[selected]?.ray,
    counts = { complete: 0, aiming: 0, blocked: 0, other: 0 };
  map?.samples.forEach((s) => {
    counts[
      s.ray.stage === "aiming"
        ? "aiming"
        : s.ray.status === "complete"
          ? "complete"
          : s.ray.status === "blocked"
            ? "blocked"
            : "other"
    ]++;
  });
  const color = (r: Ray) =>
    r.stage === "aiming"
      ? "#e6bd68"
      : r.status === "complete"
        ? "#b6dc91"
        : "#ed8e89";
  return (
    <div className="workflow-panel">
      <h2>可交互瞳面图</h2>
      <p>
        图中坐标为实体光阑平面。点击或用方向键选择一个采样点，上方剖面以白线显示其真实路径；瞄准未解没有物理路径。此图不是照度或衍射波前图。
      </p>
      <div className="workflow-actions">
        <label>
          视场
          <select
            aria-label="瞳面视场"
            value={Math.min(field, project.fields.length - 1)}
            onChange={(e) => setField(Number(e.target.value))}
          >
            {project.fields.map((f, i) => (
              <option key={i} value={i}>
                {fieldLabel(project, i)}
              </option>
            ))}
          </select>
        </label>
        <label>
          波长
          <select
            aria-label="瞳面波长"
            value={nm}
            onChange={(e) => setNm(Number(e.target.value))}
          >
            {project.wavelengths.map((w) => (
              <option key={w.nm} value={w.nm}>
                {w.nm.toFixed(2)} nm
              </option>
            ))}
          </select>
        </label>
        <label>
          采样
          <select
            aria-label="瞳面采样"
            value={sampling}
            onChange={(e) => setSampling(Number(e.target.value))}
          >
            {[9, 13, 17, 25, 33].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || !project.surfaces.length}
          onClick={() => void run()}
        >
          {busy ? "瞄准并追迹…" : "生成瞳面图"}
        </button>
        {busy && (
          <button
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
            }}
          >
            取消瞳面计算
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {map && (
        <>
          <p role="status">
            通过 {counts.complete} · 物理遮挡 {counts.blocked} · 其他物理失败{" "}
            {counts.other} · 瞄准未解 {counts.aiming}（共 {map.samples.length}）
          </p>
          <div className="pupil-grid">
            <svg
              viewBox="0 0 400 400"
              className="pupil-map"
              role="group"
              tabIndex={0}
              aria-label="实体光阑采样点"
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  select(
                    (selected +
                      (e.key === "ArrowLeft" || e.key === "ArrowDown"
                        ? -1
                        : 1) +
                      map.samples.length) %
                      map.samples.length,
                  );
                }
              }}
            >
              <circle
                cx="200"
                cy="200"
                r="174"
                fill="#111a20"
                stroke="#55717c"
              />
              <path d="M20 200H380M200 20V380" stroke="#293c46" />
              {map.samples.map((s, i) => (
                <circle
                  key={i}
                  role="button"
                  tabIndex={i === selected ? 0 : -1}
                  aria-label={`瞳采样 ${i + 1} ${s.ray.stage === "aiming" ? "瞄准未解" : s.ray.status === "complete" ? "通过" : "物理失败"}`}
                  cx={200 + (174 * s.target_mm[0]) / map.radius_mm}
                  cy={200 - (174 * s.target_mm[1]) / map.radius_mm}
                  r={selected === i ? 7 : 4}
                  fill={color(s.ray)}
                  stroke={selected === i ? "white" : "none"}
                  strokeWidth="2"
                  onClick={() => select(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(i);
                    }
                  }}
                />
              ))}
              <text x="15" y="390" fill="#94adbb">
                实体光阑半径 {map.radius_mm.toFixed(4)} mm · X→ / Y↑
              </text>
            </svg>
            <div aria-live="polite">
              <h3>采样 {selected + 1}</h3>
              <p>
                目标 X/Y：
                {map.samples[selected]?.target_mm
                  .map((v) => v.toFixed(6))
                  .join(" / ")}{" "}
                mm
              </p>
              <p>
                {ray?.status === "complete"
                  ? "真实追迹到达像面"
                  : rayFailureText(
                      ray?.status ?? "",
                      ray?.aiming?.failure ?? undefined,
                    )}
              </p>
              <p>
                阶段：
                {ray?.stage === "aiming"
                  ? "光阑瞄准（未绘制试算）"
                  : "物理追迹"}
              </p>
              {ray?.surface != null && (
                <button onClick={() => onSurface(ray.surface!)}>
                  定位 {ray.stage === "aiming" ? "目标光阑" : "实际终止面"} S
                  {ray.surface + 1}
                </button>
              )}
              <p>
                瞄准残差：
                {ray?.aiming?.residual_mm?.toExponential(3) ?? "未确定"} mm ·
                迭代 {ray?.aiming?.iterations ?? 0}
              </p>
              <p className="hint">
                绿色通过，红色物理失败，黄色瞄准未解。二维剖面绘制 Y/Z 投影，X
                高度在此图查看。不能由通过比例直接推导相对照度。
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
