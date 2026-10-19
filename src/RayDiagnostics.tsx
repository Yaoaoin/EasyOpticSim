import type { Analysis } from "./types";
import { rayFailureText } from "./errors";
export default function RayDiagnostics({
  result,
  onSelect,
}: {
  result: Analysis;
  onSelect: (surface: number) => void;
}) {
  const rows = result.spots.flatMap((s) =>
    (s.failures ?? []).map((f) => ({
      ...f,
      field: s.field,
      nm: s.wavelength_nm,
      sampled: s.sampled,
    })),
  );
  const aiming = rows
      .filter((r) => r.stage === "aiming")
      .reduce((n, r) => n + r.count, 0),
    physical = rows
      .filter((r) => r.stage === "trace")
      .reduce((n, r) => n + r.count, 0);
  return (
    <section className="ray-diagnostics" aria-label="追迹失败明细">
      <h3>追迹失败明细</h3>
      <p>
        瞄准阶段 {aiming} 条 · 物理追迹 {physical}{" "}
        条。瞄准试算不画入光路；表面位置在瞄准失败时指目标光阑，物理失败时指实际终止面。
      </p>
      {rows.length ? (
        <div className="scroll-table">
          <table>
            <thead>
              <tr>
                <th>半视场 / 波长</th>
                <th>阶段</th>
                <th>位置</th>
                <th>数量</th>
                <th>原因与处理</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    {((r.field * 180) / Math.PI).toFixed(3)}°
                    <small>{r.nm.toFixed(2)} nm</small>
                  </td>
                  <td>{r.stage === "aiming" ? "光阑瞄准" : "物理追迹"}</td>
                  <td>
                    {r.surface === null ? (
                      "像方"
                    ) : (
                      <button onClick={() => onSelect(r.surface!)}>
                        定位 S{r.surface + 1}
                      </button>
                    )}
                  </td>
                  <td>
                    {r.count}/{r.sampled}
                  </td>
                  <td>{rayFailureText(r.status, r.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="quality-bar">
          全部声明视场、波长与瞳采样通过。本结果不代表连续瞳的无条件通光保证。
        </p>
      )}
    </section>
  );
}
