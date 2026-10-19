import { Num } from "./Num";
import { useState } from "react";
import type { Constraints, ConstraintCheck } from "./types";
export function ConstraintEditor({
  value,
  onChange,
}: {
  value: Constraints;
  onChange: (c: Constraints) => void;
}) {
  return (
    <>
      {(
        [
          ["target_efl_mm", "目标有效焦距"],
          ["efl_tolerance_mm", "焦距允许误差"],
          ["max_length_mm", "最大总长（含像距）"],
          ["min_center_mm", "最小中心厚度"],
          ["min_edge_mm", "最小实体厚度（含边缘）"],
          ["min_air_mm", "最小空气间隔"],
        ] as const
      ).map(([key, label]) => (
        <Num
          key={key}
          label={label}
          value={value[key]}
          unit="mm"
          min={key.startsWith("min") ? 0 : 0.000001}
          onChange={(v) => onChange({ ...value, [key]: v })}
        />
      ))}
      <p className="hint">
        空气间隔检查包括独立光阑两侧。实体厚度覆盖有效口径与机械边缘；最终用连续区间检查确认。
      </p>
    </>
  );
}
const labels: Record<string, string> = {
  numerical_failed_rays: "非遮挡的瞄准 / 物理追迹失败",
  f_number_error: "F 数绝对误差（无量纲）",
  bfl_mm: "近轴后焦距",
  front_diameter_mm: "前组有效直径",
  bound_aperture: "光阑半径变量边界",
  efl_error_mm: "焦距绝对误差",
  total_length_mm: "总长（含像距）",
  center_mm: "中心厚度",
  body_min_mm: "最薄实体（估计值）",
  air_min_mm: "最小空气间隔（估计值）",
  image_gap_mm: "轴向像距",
  failed_rays: "失败光线",
  bound_curvature: "曲率变量边界",
  bound_thickness: "间隔变量边界",
  bound_a4: "A4 变量边界",
  bound_a6: "A6 变量边界",
  bound_a8: "A8 变量边界",
  bound_a10: "A10 变量边界",
};
export function checkLabel(c: ConstraintCheck) {
  return `${c.surface !== null ? `S${c.surface + 1} · ` : ""}${labels[c.name] ?? c.name}`;
}
export function adoptionBlockers(candidate: {
  accepted: boolean;
  checks: ConstraintCheck[];
}) {
  const failed = candidate.checks.filter((c) => !c.passed);
  if (failed.length) return failed.map(checkLabel);
  return candidate.accepted
    ? []
    : ["引擎的采纳状态与检查表不一致，请重新生成候选；本次保持禁止采纳"];
}
function number(v: number | null) {
  return v === null
    ? "未确定"
    : v === 0
      ? "0"
      : Math.abs(v) < 1e-5
        ? v.toExponential(8)
        : Number(v.toPrecision(11)).toString();
}
export function ConstraintTable({
  checks,
  label = "候选约束检查",
}: {
  checks: ConstraintCheck[];
  label?: string;
}) {
  const [all, setAll] = useState(false);
  if (!checks.length) return null;
  const failed = checks.filter((c) => !c.passed),
    rows =
      failed.length && !all
        ? failed
        : [...checks].sort((a, b) => Number(a.passed) - Number(b.passed));
  return (
    <section className="constraint-results" aria-label={label}>
      <div className="workflow-actions">
        <strong>
          {checks.length - failed.length} / {checks.length} 项通过 ·{" "}
          {failed.length} 项阻止采纳
        </strong>
        {failed.length > 0 && (
          <label>
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            显示全部检查项（失败项优先）
          </label>
        )}
      </div>
      <div
        className="scroll-table"
        tabIndex={0}
        aria-label="约束检查表"
        role="region"
      >
        <table>
          <thead>
            <tr>
              <th>检查项</th>
              <th>实际</th>
              <th>要求</th>
              <th>余量 / 原因</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i}>
                <td>{checkLabel(c)}</td>
                <td title={String(c.actual)}>{number(c.actual)}</td>
                <td>
                  {c.relation === "min" ? "≥" : "≤"} {number(c.limit)}
                </td>
                <td>
                  {c.actual !== null
                    ? number(
                        c.relation === "min"
                          ? c.actual - c.limit
                          : c.limit - c.actual,
                      )
                    : "无法计算"}
                  <small>
                    {c.reason ?? (c.passed ? "已达到要求" : "实际值未达到要求")}
                  </small>
                </td>
                <td style={{ color: c.passed ? "#b6dc91" : "#f1a39d" }}>
                  {c.passed ? "通过" : "未通过 / 无法确认"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        长度单位 mm（F
        数无量纲，曲率与非球面使用各自参数单位）；正余量表示数值上有余地。最薄处为采样估计，“通过”仍须连续区间认证。通光只针对声明的瞳采样。
      </p>
    </section>
  );
}
