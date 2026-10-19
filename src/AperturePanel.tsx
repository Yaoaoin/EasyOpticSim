import { useEffect, useRef, useState } from "react";
import { fieldLabel } from "./fields";
import Coverage from "./Coverage";
import type {
  Analysis,
  ApertureScan,
  Candidate,
  Project,
  ConstraintCheck,
} from "./types";
import { compute, exportReport } from "./engine";
import {
  defaultAperture,
  opticalKey,
  scanProject,
  validAperture,
} from "./design";
import { copy } from "./project";
import { ensureWorkspace } from "./versions";
import { explainError } from "./errors";
const colors = ["#b6dc91", "#9ebdfb", "#dfb985"];
export default function AperturePanel({
  project,
  edit,
  onCandidate,
}: {
  project: Project;
  edit: (f: (p: Project) => void) => void;
  onCandidate: (c: Candidate) => void;
}) {
  const options = project.workspace?.aperture ?? defaultAperture,
    scan = project.workspace?.aperture_scan;
  const [text, setText] = useState(options.f_numbers.join(", ")),
    [selected, setSelected] = useState(scan?.best_index ?? 0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const ctrl = useRef<AbortController | null>(null),
    key = opticalKey(project),
    candidateInputsKey = JSON.stringify([
      project.name,
      project.description,
      project.workspace?.constraints,
    ]),
    optionKey = JSON.stringify(options);
  const stale = !!scan && opticalKey(scan.source) !== key,
    point = scan?.points[selected];
  useEffect(() => {
    ctrl.current?.abort();
    setBusy("");
    setError("");
    return () => ctrl.current?.abort();
  }, [key, optionKey, candidateInputsKey]);
  useEffect(() => setText(options.f_numbers.join(", ")), [optionKey]);
  const set = (o: typeof options) =>
    edit((p) => {
      ensureWorkspace(p).aperture = copy(o);
    });
  async function run() {
    const parsed = {
      ...options,
      f_numbers: text
        .split(/[,，\s]+/)
        .filter(Boolean)
        .map(Number),
    };
    if (!validAperture(parsed)) {
      setError("输入 1–12 档 F 数（0.5–128），以逗号或空格分隔");
      return;
    }
    const c = new AbortController();
    ctrl.current?.abort();
    ctrl.current = c;
    setBusy("逐档追迹" + (options.mtf ? "与多色 MTF 验证" : "") + "…");
    setError("");
    try {
      const s = await compute<ApertureScan>(
        crypto.randomUUID(),
        "aperture_scan",
        project,
        c.signal,
        { aperture_options: parsed },
      );
      if (c.signal.aborted) return;
      edit((p) => {
        ensureWorkspace(p).aperture = copy(parsed);
        ensureWorkspace(p).aperture_scan = s;
      });
      setSelected(s.best_index ?? 0);
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy("");
    }
  }
  async function candidate() {
    if (!scan || !point || stale || point.score_um === null) return;
    const c = new AbortController();
    ctrl.current = c;
    setBusy("33×33 复核所选光圈…");
    setError("");
    try {
      const q = {
          ...scanProject(scan, selected),
          name: project.name,
          description: project.description,
        },
        a = await compute<Analysis>(
          crypto.randomUUID(),
          "analyze",
          q,
          c.signal,
          { sampling: 33 },
        );
      if (c.signal.aborted) return;
      if (
        a.spots.some((s) => s.failed > 0) ||
        a.fields.some((f) => f.polychromatic_rms_um === null)
      )
        throw Error("33×33 复核存在失败光线，不能采纳此档");
      const rms = (a: Analysis) =>
        Math.sqrt(
          a.fields.reduce((s, f) => s + f.polychromatic_rms_um! ** 2, 0) /
            a.fields.length,
        );
      const b = await compute<Analysis>(
        crypto.randomUUID(),
        "analyze",
        project,
        c.signal,
        { sampling: 33 },
      );
      if (c.signal.aborted) return;
      const checks: ConstraintCheck[] = project.workspace?.constraints
        ? await compute<ConstraintCheck[]>(
            crypto.randomUUID(),
            "checks",
            q,
            c.signal,
            { constraints: project.workspace.constraints },
          )
        : [];
      if (c.signal.aborted) return;
      checks.push({
        name: "failed_rays",
        surface: null,
        actual: 0,
        limit: 0,
        relation: "max",
        passed: true,
        reason: "所选光圈全部配置视场和波长，33×33 复核无失败",
      });
      onCandidate({
        project: q,
        before_rms_um:
          b.spots.some((s) => s.failed > 0) ||
          b.fields.some((f) => f.polychromatic_rms_um === null)
            ? null
            : rms(b),
        after_rms_um: rms(a),
        iterations: scan.points.length,
        accepted: checks.every((v) => v.passed),
        checks,
        sampling: 33,
        note: `光圈扫描候选：f/${point.actual_f_number?.toFixed(3)}，像距 ${point.image_distance_mm.toFixed(6)} mm。已复核全部配置视场与波长，33×33 无失败；${project.workspace?.constraints ? "按项目保存的设计与尺寸约束检查，全部通过后才可采纳。" : "项目未启用设计约束，仅确认声明采样的通光。"}`,
      });
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy("");
    }
  }
  const max = Math.max(
    1,
    ...(scan?.points
      .filter((p) => p.score_um !== null)
      .flatMap((p) => p.fields_rms_um.filter((v): v is number => v !== null)) ??
      []),
  );
  return (
    <div className="workflow-panel">
      <h2>光圈扫描</h2>
      <p>
        每档按 d
        线近轴入瞳换算实体光阑，再进行实际追迹。失败点保留诊断，不参与最佳几何
        RMS 选择；采样比例不是相对照度。
      </p>
      <div className="workflow-actions">
        <label>
          扫描 F 数
          <input
            aria-label="扫描 F 数"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              const o = {
                ...options,
                f_numbers: text
                  .split(/[,，\s]+/)
                  .filter(Boolean)
                  .map(Number),
              };
              if (validAperture(o) && JSON.stringify(o) !== optionKey) set(o);
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.refocus}
            onChange={(e) => set({ ...options, refocus: e.target.checked })}
          />
          每档重新对焦（全视场 RMS）
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.mtf}
            onChange={(e) => set({ ...options, mtf: e.target.checked })}
          />
          逐视场多色 MTF（较慢）
        </label>
        {options.mtf && (
          <label>
            扫描衍射模型
            <select
              aria-label="扫描衍射模型"
              value={options.wave_method ?? "fast"}
              onChange={(e) =>
                set({
                  ...options,
                  wave_method: e.target.value as "fast" | "sphere_kirchhoff",
                })
              }
            >
              <option value="fast">快速 · 全档相同模型</option>
              <option value="sphere_kirchhoff">
                直接 Kirchhoff · 全档相同模型
              </option>
            </select>
          </label>
        )}
        <label>
          瞳采样
          <select
            aria-label="光圈扫描采样"
            value={options.sampling}
            onChange={(e) =>
              set({ ...options, sampling: Number(e.target.value) })
            }
          >
            {[9, 17, 25, 33].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          disabled={!!busy || !project.surfaces.length}
          onClick={() => void run()}
        >
          {busy || "开始光圈扫描"}
        </button>
        {busy && (
          <button
            onClick={() => {
              ctrl.current?.abort();
              setBusy("");
              setError("已取消；保留上一次完整扫描，不保存部分结果");
            }}
          >
            取消光圈扫描
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {scan && (
        <>
          {stale && (
            <p className="error">
              处方已修改：以下为历史扫描，不能直接生成候选，请重新扫描。
            </p>
          )}
          <p>
            {scan.options.refocus ? "每档独立重新对焦" : "固定源处方像面"} ·{" "}
            {scan.options.sampling}×{scan.options.sampling} ·{" "}
            {scan.source.fields.length} 视场 / {scan.source.wavelengths.length}{" "}
            波长 · 最佳几何 RMS 档：
            {scan.best_index !== null
              ? `f/${scan.points[scan.best_index].actual_f_number?.toFixed(2)}`
              : "无合格点"}
            。该选择未使用 MTF 作为优化目标。
          </p>
          <svg
            className="sweep-chart"
            viewBox="0 0 800 270"
            role="img"
            aria-label="光圈与各视场 RMS 曲线"
          >
            <path d="M50 15V200H780" fill="none" stroke="#5c727d" />
            <text x="0" y="18" fill="#94adbb">
              {max.toFixed(1)} µm
            </text>
            <text x="20" y="200" fill="#94adbb">
              0
            </text>
            {scan.points.map((p, i) => (
              <g key={i}>
                <text
                  x={70 + (i * 690) / Math.max(1, scan.points.length - 1)}
                  y="220"
                  textAnchor="middle"
                  fill="#94adbb"
                >
                  f/{p.requested_f_number}
                </text>
                {p.score_um === null && (
                  <text
                    x={70 + (i * 690) / Math.max(1, scan.points.length - 1)}
                    y="190"
                    textAnchor="middle"
                    fill="#ed8e89"
                  >
                    ×
                  </text>
                )}
              </g>
            ))}
            {scan.source.fields.map((f, j) => (
              <g key={j}>
                <text x={60 + j * 190} y={255} fill={colors[j % 3]}>
                  {fieldLabel(scan.source, j)}
                </text>
                <path
                  d={scan.points
                    .map((p, i) =>
                      p.score_um === null || p.fields_rms_um[j] === null
                        ? ""
                        : `${i > 0 && scan.points[i - 1].score_um !== null ? "L" : "M"}${70 + (i * 690) / Math.max(1, scan.points.length - 1)} ${195 - (p.fields_rms_um[j]! / max) * 170}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={colors[j % 3]}
                />
                {scan.points.map((p, i) => {
                  const v = p.fields_rms_um[j];
                  return v === null || p.score_um === null ? null : (
                    <circle
                      key={i}
                      role="button"
                      tabIndex={0}
                      aria-label={`选择扫描档 ${i + 1}`}
                      cx={70 + (i * 690) / Math.max(1, scan.points.length - 1)}
                      cy={195 - (v / max) * 170}
                      r={selected === i ? 6 : 4}
                      fill={colors[j % 3]}
                      opacity={p.score_um === null ? 0.35 : 1}
                      onClick={() => setSelected(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(i);
                        }
                      }}
                    />
                  );
                })}
              </g>
            ))}
          </svg>
          <p className="hint">
            档位按输入顺序等距排列；× 为无有效几何评分。失败档表中的 RMS
            仅统计有效光线，不能据此判断画质更好。
          </p>
          <div className="scroll-table">
            <table aria-label="光圈扫描结果">
              <thead>
                <tr>
                  <th>选择</th>
                  <th>目标/近轴 F 数</th>
                  <th>光阑半径 / 像距 mm</th>
                  <th>各视场 RMS µm</th>
                  <th>失败/采样</th>
                </tr>
              </thead>
              <tbody>
                {scan.points.map((p, i) => (
                  <tr key={i} className={selected === i ? "highlight" : ""}>
                    <td>
                      <input
                        type="radio"
                        aria-label={`扫描档 ${i + 1}`}
                        checked={selected === i}
                        onChange={() => setSelected(i)}
                      />
                    </td>
                    <td>
                      {p.requested_f_number} /{" "}
                      {p.actual_f_number?.toFixed(3) ?? "—"}
                    </td>
                    <td>
                      {p.stop_radius_mm?.toFixed(4) ?? "—"} /{" "}
                      {p.image_distance_mm.toFixed(4)}
                    </td>
                    <td>
                      {p.fields_rms_um
                        .map((v) => v?.toFixed(2) ?? "—")
                        .join(" / ")}
                      {p.score_um === null && <small>无有效评分</small>}
                    </td>
                    <td>
                      {p.failed} / {p.sampled}
                      <small>
                        瞄准 {p.aiming_failed}，遮挡 {p.blocked}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {point?.diagnostic && (
            <p className="error">{explainError(point.diagnostic)}</p>
          )}
          <Coverage value={point?.coverage} compact />
          {point?.mtf.map((m, i) => (
            <p key={i}>
              {((m.field * 180) / Math.PI).toFixed(2)}° MTF S/T @10、30 lp/mm：
              {m.values
                ? m.values.map((v) => v?.toFixed(4) ?? "频率超界").join(" / ")
                : explainError(m.error ?? "未计算")}{" "}
              {m.quality &&
                `（收敛 ${m.quality.previous_sampling}→${m.quality.pupil_sampling}）`}
            </p>
          ))}
          <div className="workflow-actions">
            <button
              disabled={!!busy || stale || point?.score_um == null}
              onClick={() => void candidate()}
            >
              复核并生成所选光圈候选
            </button>
            <button
              onClick={() =>
                void exportReport("aperture-scan.oos.json", scan).catch((e) =>
                  setError(explainError(e)),
                )
              }
            >
              导出完整扫描报告
            </button>
          </div>
        </>
      )}
    </div>
  );
}
