import type { Geometry } from "./types";
import { diagnostic } from "./errors";
export default function GeometryPanel({
  result,
  onSelect,
}: {
  result: Geometry | null;
  onSelect: (i: number) => void;
}) {
  if (!result)
    return (
      <div className="empty">添加镜片或完成参数计算后显示尺寸与几何检查</div>
    );
  return (
    <div className="tablewrap">
      <h3>尺寸与几何检查</h3>
      <p>
        检查有效曲面、平面环带及曲面延伸区域的相交；跨过独立光阑检查相邻镜片。单位
        mm。
      </p>
      {result.diagnostics.map((d, i) => (
        <button
          className="geometry-error"
          key={i}
          onClick={() => d.surface !== null && onSelect(d.surface)}
        >
          S{(d.surface ?? 0) + 1}：{diagnostic(d.message)}
        </button>
      ))}
      <table>
        <thead>
          <tr>
            {[
              "区域",
              "轴上厚度/间隔",
              "共同边缘厚度",
              "采样最薄处",
              "检查半径",
              "分离检查",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.spans.map((s, i) => (
            <tr key={i} onClick={() => onSelect(s.front)}>
              <td>
                S{s.front + 1}–S{s.back + 1} {s.glass ? "玻璃" : "空气"}
              </td>
              <td>{s.center_mm.toFixed(4)}</td>
              <td>{s.edge_mm?.toFixed(4) ?? "—"}</td>
              <td>{s.sampled_min_mm?.toFixed(4) ?? "—"}</td>
              <td>{s.radius_mm.toFixed(3)}</td>
              <td>{s.certified ? "通过" : "需修正"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        “采样最薄处”是采样估计；通过状态另由曲面导数区间界限验证，容差 10⁻⁹
        mm。此处不代表加工公差或强度合格。
      </p>
    </div>
  );
}
