import type { Coverage as Report } from "./types";
export const coverageStatus = (s: string) =>
  ({
    untested: "未验证",
    unresolved: "求解未完成",
    clipped: "存在物理遮挡",
    sampled_clear: "声明采样通过",
  })[s] ?? s;
export default function Coverage({
  value,
  compact = false,
}: {
  value: Report | null | undefined;
  compact?: boolean;
}) {
  if (!value)
    return (
      <p className="hint">传感器覆盖尚未验证；传感器尺寸不能代替测试视场。</p>
    );
  return (
    <section className="coverage-report" aria-label="传感器覆盖报告">
      <strong>传感器覆盖 · {value.sensor_mm.join(" × ")} mm</strong>
      <p>
        半对角线 {value.half_diagonal_mm.toFixed(3)} mm · 最大已测试主光线像高{" "}
        {value.max_tested_height_mm?.toFixed(3) ?? "未确定"} mm · 共用平面像面
        z={value.image_z_mm.toFixed(4)} mm · {value.sampling}×{value.sampling}{" "}
        瞳采样
      </p>
      <div className="coverage-checkpoints">
        {value.checkpoints.map((c) => (
          <span
            key={c.label}
            className={c.status === "sampled_clear" ? "hint" : "coverage-gap"}
          >
            {c.label} {c.height_mm.toFixed(3)} mm：{coverageStatus(c.status)}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="scroll-table">
          <table>
            <thead>
              <tr>
                <th>实际物方半视场</th>
                <th>参考波长主光线像高 mm</th>
                <th>几何采样通过比例</th>
                <th>物理遮挡</th>
                <th>瞄准未解 / 其他失败</th>
                <th>快速 / 离轴 MTF</th>
              </tr>
            </thead>
            <tbody>
              {value.fields.map((f, i) => (
                <tr key={i}>
                  <td>{((f.angle_rad * 180) / Math.PI).toFixed(4)}°</td>
                  <td>{f.chief_height_mm?.toFixed(4) ?? "未确定"}</td>
                  <td>{(f.geometric_fraction * 100).toFixed(2)}%</td>
                  <td>{f.blocked}</td>
                  <td>
                    {f.unresolved} / {f.other_failed}
                  </td>
                  <td>
                    {f.fast_mtf === "converged"
                      ? "已收敛"
                      : f.fast_mtf === "outside_model"
                        ? "超出快速模型"
                        : f.fast_mtf === "failed"
                          ? "未通过"
                          : "未计算"}{" "}
                    /{" "}
                    {f.wide_mtf === "converged"
                      ? "已收敛"
                      : f.wide_mtf === "failed"
                        ? "未通过"
                        : "未计算"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(compact ? value.warnings.slice(0, 1) : value.warnings).map((w, i) => (
        <p className="hint" key={i}>
          {w}
        </p>
      ))}
    </section>
  );
}
