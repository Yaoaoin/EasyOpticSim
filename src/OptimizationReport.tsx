import type { Candidate, OptimizationProgress } from "./types";
import { presetLabels } from "./optimization";
import Coverage from "./Coverage";
import { fieldLabel } from "./fields";
const n = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(4));
export function ProgressView({
  history,
  live = false,
}: {
  history: OptimizationProgress[];
  live?: boolean;
}) {
  if (!history.length) return null;
  const last = history.at(-1)!,
    max = Math.max(1e-12, ...history.map((h) => h.merit)),
    min = Math.min(...history.map((h) => h.merit));
  return (
    <section className="optimization-progress" aria-label="优化进度">
      <p role="status">
        {live ? "优化中" : "优化轨迹"} · {last.iteration} /{" "}
        {last.max_iterations} 次 · 加权 RMS {n(last.weighted_rms_um)} µm ·
        目标值 {n(last.merit)} · EFL {n(last.efl_mm)} mm
      </p>
      {live && (
        <progress
          aria-label="优化迭代进度"
          max={last.max_iterations}
          value={last.iteration}
        />
      )}
      <svg viewBox="0 0 600 100" role="img" aria-label="优化目标值随迭代变化">
        <path d="M20 5V85H590" stroke="#ffffff33" fill="none" />
        <polyline
          fill="none"
          stroke="#b6dc91"
          strokeWidth="2"
          points={history
            .map(
              (h) =>
                `${20 + (h.iteration / last.max_iterations) * 570},${80 - (70 * (h.merit - min)) / Math.max(1e-12, max - min)}`,
            )
            .join(" ")}
        />
        <text x="22" y="99">
          迭代 0
        </text>
        <text x="530" y="99">
          {last.max_iterations}
        </text>
      </svg>
      <p className="hint">
        目标值 = 加权多色 RMS 残差 + 归一化焦距与几何罚项的平方和（7×7
        优化采样）。平段表示试步未被接受；最终指标使用 33×33 复核。
      </p>
    </section>
  );
}
export default function OptimizationReportView({
  candidate,
}: {
  candidate: Candidate;
}) {
  const r = candidate.report;
  if (!r) return null;
  return (
    <details className="optimization-report" open>
      <summary>优化说明与视场取舍 · {presetLabels[r.preset]}</summary>
      <p>
        对焦条件：
        {r.focus_condition?.includes("independently refocused")
          ? "每阶段原设计与候选分别重新对焦，各视场仍共用平面像面"
          : "每个设计各视场共用平面像面；仅选定的变量可以改变像距，阶段间不自动重新对焦"}
        。
      </p>
      {r.stages && r.stages.length > 0 && (
        <table aria-label="视场扩展阶段">
          <thead>
            <tr>
              <th>视场比例</th>
              <th>原设计 RMS µm</th>
              <th>候选 RMS µm</th>
              <th>最终复核</th>
            </tr>
          </thead>
          <tbody>
            {r.stages.map((s, i) => (
              <tr key={i}>
                <td>{s.field_scale * 100}%</td>
                <td>{s.original_fields_rms_um.map(n).join(" / ")}</td>
                <td>{s.candidate_fields_rms_um.map(n).join(" / ")}</td>
                <td>{s.accepted ? "通过" : "未通过，停止扩大"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        停止原因：{r.stop_reason}。加权 RMS {n(r.before_weighted_rms_um)} →{" "}
        {n(r.after_weighted_rms_um)}{" "}
        µm。局部搜索不保证全局最优；达到迭代上限不代表约束通过。
      </p>
      <div className="scroll-table">
        <table>
          <thead>
            <tr>
              <th>视场</th>
              <th>权重</th>
              <th>原始 RMS</th>
              <th>候选 RMS</th>
              <th>变化</th>
            </tr>
          </thead>
          <tbody>
            {candidate.project.fields.map((f, i) => (
              <tr key={i}>
                <td>{fieldLabel(candidate.project, i)}</td>
                <td>{(100 * r.field_weights[i]).toFixed(2)}%</td>
                <td>{n(r.before_fields_rms_um[i])}</td>
                <td>{n(r.after_fields_rms_um[i])}</td>
                <td>
                  {r.before_fields_rms_um[i] !== null &&
                  r.after_fields_rms_um[i] !== null
                    ? n(r.after_fields_rms_um[i]! - r.before_fields_rms_um[i]!)
                    : "—"}{" "}
                  µm
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Coverage value={r.after_coverage} compact />
      <ProgressView history={r.history} />
    </details>
  );
}
