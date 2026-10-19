import { useEffect, useMemo, useRef, useState } from "react";
import { fieldLabel } from "./fields";
import Coverage from "./Coverage";
import { compute, exportReport } from "./engine";
import { copy } from "./project";
import { ensureWorkspace, prescription } from "./versions";
import { explainError } from "./errors";
import { Num } from "./Num";
import WavePanel from "./WavePanel";
import type {
  Analysis,
  Candidate,
  FocusOptions,
  FocusScan,
  Project,
} from "./types";

const colors = ["#b6dc91", "#9ebdfb", "#dfb985", "#df9bc8"];
export default function FocusPanel({
  project,
  edit,
  onCandidate,
}: {
  project: Project;
  edit: (f: (p: Project) => void) => void;
  onCandidate: (c: Candidate) => void;
}) {
  const distance = project.surfaces.at(-1)?.thickness ?? 50;
  const [options, setOptions] = useState<FocusOptions>(
    project.workspace?.focus ?? {
      min_mm: Math.max(0.01, distance * 0.8),
      max_mm: Math.max(1, distance * 1.2),
      steps: 31,
      sampling: 17,
      criterion: "balanced",
    },
  );
  const [scan, setScan] = useState<FocusScan | null>(null),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const key = JSON.stringify(prescription(project)),
    optionKey = JSON.stringify(options);
  useEffect(() => {
    controller.current?.abort();
    setScan(null);
    setBusy("");
    setError("");
    return () => controller.current?.abort();
  }, [key, optionKey]);
  const point = scan?.points[selected];
  const selectedProject = useMemo(() => {
    const p = JSON.parse(key) as Project;
    if (point && p.surfaces.length)
      p.surfaces[p.surfaces.length - 1].thickness = point.image_distance_mm;
    return p;
  }, [key, point]);
  async function run() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy("扫描像面距离…");
    setError("");
    setScan(null);
    try {
      const s = await compute<FocusScan>(
        crypto.randomUUID(),
        "focus_scan",
        project,
        c.signal,
        { focus_options: options },
      );
      if (c.signal.aborted) return;
      edit((p) => {
        ensureWorkspace(p).focus = copy(options);
      });
      setScan(s);
      setSelected(s.best_index ?? 0);
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy("");
    }
  }
  async function candidate() {
    if (!point || point.score_um === null) return;
    const c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    setBusy("用 33×33 采样复核候选…");
    setError("");
    try {
      const a = await compute<Analysis>(
        crypto.randomUUID(),
        "analyze",
        project,
        c.signal,
        { sampling: 33 },
      );
      const b = await compute<Analysis>(
        crypto.randomUUID(),
        "analyze",
        selectedProject,
        c.signal,
        { sampling: 33 },
      );
      if (c.signal.aborted) return;
      if (
        [...a.spots, ...b.spots].some((s) => s.failed > 0) ||
        [...a.fields, ...b.fields].some((f) => f.polychromatic_rms_um === null)
      )
        throw Error("精细采样存在遮挡或失败光线，无法采纳此对焦点。");
      const score = (a: Analysis) =>
        Math.sqrt(
          a.fields.reduce((sum, f) => sum + f.polychromatic_rms_um! ** 2, 0) /
            a.fields.length,
        );
      onCandidate({
        project: selectedProject,
        before_rms_um: score(a),
        after_rms_um: score(b),
        iterations: scan!.points.length,
        accepted: true,
        checks: [],
        sampling: 33,
        note: `对焦扫描候选：像距 ${point.image_distance_mm.toFixed(6)} mm。${options.criterion === "center" ? "按中心视场选择；下方 RMS 为全视场指标。" : "按全视场均方折中选择。"} 已复核全部视场通光。`,
      });
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy("");
    }
  }
  const max = Math.max(
    1,
    ...(scan?.points.flatMap((p) =>
      p.fields_rms_um.filter((v): v is number => v !== null),
    ) ?? []),
  );
  return (
    <div className="workflow-panel">
      <h2>对焦扫描</h2>
      <p>
        移动平面传感器，查看各视场的多色
        RMS。曲线最低点是离散扫描结果；可以缩小区间继续扫描。
      </p>
      <div className="form-grid">
        <Num
          label="起始像距"
          value={options.min_mm}
          unit="mm"
          min={0.01}
          onChange={(v) => setOptions({ ...options, min_mm: v })}
        />
        <Num
          label="结束像距"
          value={options.max_mm}
          unit="mm"
          min={0.01}
          onChange={(v) => setOptions({ ...options, max_mm: v })}
        />
        <Num
          label="扫描点数"
          value={options.steps}
          min={3}
          max={101}
          step={2}
          onChange={(v) => setOptions({ ...options, steps: v })}
        />
        <label>
          选择准则
          <select
            aria-label="对焦选择准则"
            value={options.criterion}
            onChange={(e) =>
              setOptions({
                ...options,
                criterion: e.target.value as FocusOptions["criterion"],
              })
            }
          >
            <option value="balanced">全视场均方折中</option>
            <option value="center">中心视场优先（0°）</option>
          </select>
        </label>
        <label>
          瞳采样
          <select
            aria-label="扫描瞳采样"
            value={options.sampling}
            onChange={(e) =>
              setOptions({ ...options, sampling: Number(e.target.value) })
            }
          >
            {[9, 17, 25, 33].map((n) => (
              <option key={n} value={n}>
                {n} × {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="workflow-actions">
        <button
          className="primary"
          disabled={!!busy || !project.surfaces.length}
          onClick={() => void run()}
        >
          开始扫描
        </button>
        {busy && (
          <button
            onClick={() => {
              controller.current?.abort();
              setBusy("");
              setError("已取消扫描，原设计未改变。");
            }}
          >
            取消
          </button>
        )}
        <span role="status">{busy}</span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {scan && (
        <>
          <p className="quality-bar">
            {scan.best_index === null
              ? "没有完整通光的有效焦点，请检查口径与扫描范围。"
              : `推荐像距 ${scan.points[scan.best_index].image_distance_mm.toFixed(6)} mm · 指标 ${scan.points[scan.best_index].score_um!.toFixed(3)} µm`}
            {scan.boundary_best && " · 最低值位于边界，请扩大区间。"}
          </p>
          <svg
            className="focus-chart"
            viewBox="0 0 650 250"
            role="img"
            aria-label="各视场 RMS 随像面距离变化曲线"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <path d={`M55 ${210 - t * 180}H625`} stroke="#ffffff18" />
                <text x={48} y={214 - t * 180} textAnchor="end">
                  {(max * t).toFixed(1)}
                </text>
                <text x={55 + t * 570} y={232} textAnchor="middle">
                  {(
                    options.min_mm +
                    t * (options.max_mm - options.min_mm)
                  ).toFixed(2)}
                </text>
              </g>
            ))}
            <text x={55} y={15}>
              RMS · µm
            </text>
            <text x={625} y={249} textAnchor="end">
              像距 · mm
            </text>
            {scan.fields_rad.map((f, j) => {
              let d = "",
                prev = false;
              scan.points.forEach((p, i) => {
                const v = p.fields_rms_um[j];
                if (v === null || p.diagnostic) {
                  prev = false;
                  return;
                }
                d += `${prev ? "L" : "M"}${55 + (i / (scan.points.length - 1)) * 570},${210 - (v / max) * 180} `;
                prev = true;
              });
              return (
                <path
                  key={j}
                  d={d}
                  fill="none"
                  stroke={colors[j % colors.length]}
                  strokeWidth={2}
                >
                  <title>{((f * 180) / Math.PI).toFixed(2)}°</title>
                </path>
              );
            })}
            <path
              d={`M${55 + (selected / (scan.points.length - 1)) * 570} 25V210`}
              stroke="#fff"
              strokeDasharray="4 4"
            />
          </svg>
          <div className="workflow-actions">
            {scan.fields_rad.map((f, i) => (
              <span key={i} style={{ color: colors[i % colors.length] }}>
                — {fieldLabel(project, i)}
              </span>
            ))}
          </div>
          <label className="scan-select">
            查看扫描位置
            <input
              aria-label="扫描位置"
              type="range"
              min={0}
              max={scan.points.length - 1}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            />
            {point?.image_distance_mm.toFixed(6)} mm
          </label>
          <Coverage value={point?.coverage} compact />
          <p>
            {point?.diagnostic
              ? `此位置不参与推荐：${point.failed}/${point.sampled} 条光线遮挡或失败。${point.sampled === 0 ? point.diagnostic : ""}`
              : `当前指标 ${point?.score_um?.toFixed(3)} µm；${point?.sampled} 条光线完成。`}
          </p>
          <div className="workflow-actions">
            <button
              disabled={!!busy || point?.score_um == null}
              onClick={() => void candidate()}
            >
              复核并生成对焦候选
            </button>
            <button
              onClick={() =>
                void exportReport("focus-scan.json", {
                  project: prescription(project),
                  scan,
                }).catch((e) => setError(explainError(e)))
              }
            >
              导出扫描报告
            </button>
          </div>
          <details>
            <summary>扫描数据与通光情况</summary>
            <div className="scroll-table">
              <table>
                <thead>
                  <tr>
                    <th>像距 mm</th>
                    {scan.fields_rad.map((f, i) => (
                      <th key={i}>{fieldLabel(project, i)} µm</th>
                    ))}
                    <th>失败 / 采样</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.points.map((p, i) => (
                    <tr
                      key={i}
                      className={i === selected ? "highlight" : ""}
                      onClick={() => setSelected(i)}
                    >
                      <td>{p.image_distance_mm.toFixed(6)}</td>
                      {p.fields_rms_um.map((v, j) => (
                        <td key={j}>{v?.toFixed(3) ?? "—"}</td>
                      ))}
                      <td>
                        {p.diagnostic ? "⚠ " : ""}
                        {p.failed} / {p.sampled}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {point?.score_um != null && (
            <details>
              <summary>计算此像面位置的 PSF / MTF</summary>
              <p>
                采用所选像距，遵循现有衍射适用性与收敛检查。当前设计不会自动改变。
              </p>
              <WavePanel project={selectedProject} disabled={!!busy} />
            </details>
          )}
        </>
      )}
    </div>
  );
}
