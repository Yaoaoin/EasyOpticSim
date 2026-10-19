import { useEffect, useRef, useState } from "react";
import type { Analysis, Project, Wave, Ray } from "./types";
import { sag, outerRadius, profile, profileHeights } from "./project";
import { initialView, zoomAt, type View } from "./viewport";
import { lensAt } from "./lenses";
import { spotExtent } from "./versions";
import { isDrawableRay } from "./rayDisplay";
export function Diffraction({ wave }: { wave: Wave }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [log, setLog] = useState(true);
  const [extent, setExtent] = useState(256);
  const [limit, setLimit] = useState(200);
  const side = Math.min(extent || wave.size, wave.size);
  const offset = (wave.size - side) / 2;
  let shownEnergy = 0;
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++)
      shownEnergy += wave.psf[(y + offset) * wave.size + x + offset];
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    const img = ctx.createImageData(side, side);
    const max = wave.psf.reduce((a, b) => Math.max(a, b), 0);
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const v = wave.psf[(y + offset) * wave.size + x + offset] / max;
        const t = log ? Math.log1p(1000 * v) / Math.log(1001) : v;
        img.data.set([t * 216, t * 252, t * 162, 255], (y * side + x) * 4);
      }
    ctx.putImageData(img, 0, 0);
  }, [wave, log, side, offset]);
  const maxFreq = Math.min(
    limit || Infinity,
    (wave.mtf_sagittal.length - 1) * wave.frequency_step_lp_mm,
  );
  const q = wave.quality;
  return (
    <div className="diffraction-result">
      <div className="quality-bar" role="status">
        <strong>✓ 数值收敛检查通过</strong>
        <span>
          瞳采样 {q.previous_sampling} → {q.pupil_sampling}
        </span>
        <span>MTF 最大变化 {q.mtf_max_change.toFixed(4)}</span>
        <span>PSF L1 {q.psf_l1_change.toFixed(4)}</span>
        <span>边缘能量 {(100 * q.edge_energy).toFixed(2)}%</span>
      </div>
      <div className="wave-controls">
        <label>
          <input
            type="checkbox"
            checked={log}
            onChange={(e) => setLog(e.target.checked)}
          />
          PSF 对数显示（仅影响亮度显示）
        </label>
        <label>
          PSF 视窗
          <select
            aria-label="PSF视窗"
            value={extent}
            onChange={(e) => setExtent(Number(e.target.value))}
          >
            <option value={128}>中心 128 px</option>
            <option value={256}>中心 256 px</option>
            <option value={0}>完整计算区域</option>
          </select>
        </label>
        <label>
          频率上限
          <select
            aria-label="MTF频率上限"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={100}>100 lp/mm</option>
            <option value={200}>200 lp/mm</option>
            <option value={0}>完整频率范围</option>
          </select>
        </label>
      </div>
      <div className="wave wave-plots">
        <div>
          <canvas
            ref={ref}
            width={side}
            height={side}
            aria-label="物理尺度衍射点扩散函数"
          />
          <p>
            视窗宽 {(side * wave.pixel_um).toFixed(1)} µm · 包含{" "}
            {(100 * shownEnergy).toFixed(2)}% 计算窗口内能量
          </p>
          <p>采样间距 {wave.pixel_um.toFixed(3)} µm；中心为参考主光线像点</p>
        </div>
        <div>
          <svg
            viewBox="0 0 430 235"
            role="img"
            aria-label="弧矢与子午调制传递函数"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <path
                  d={"M40 " + (185 - 160 * v) + "H410"}
                  stroke="#ffffff15"
                />
                <text
                  x="32"
                  y={189 - 160 * v}
                  fill="#8b9ba8"
                  fontSize="11"
                  textAnchor="end"
                >
                  {v}
                </text>
              </g>
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <text
                key={v}
                x={40 + 370 * v}
                y="205"
                fill="#8b9ba8"
                fontSize="10"
                textAnchor="middle"
              >
                {(v * maxFreq).toFixed(0)}
              </text>
            ))}
            <path d="M40 25V185H410" fill="none" stroke="#657080" />
            {[wave.mtf_sagittal, wave.mtf_tangential].map((line, i) => (
              <polyline
                key={i}
                points={line
                  .map((v, j) => [j * wave.frequency_step_lp_mm, v])
                  .filter(([f]) => f <= maxFreq)
                  .map(
                    ([f, v]) =>
                      40 + (f / maxFreq) * 370 + "," + (185 - v * 160),
                  )
                  .join(" ")}
                fill="none"
                stroke={i ? "#dfb985" : "#b6dc91"}
                strokeWidth="2"
              />
            ))}
            <text x="40" y="14" fill="#8b9ba8" fontSize="11">
              MTF
            </text>
            <text x="410" y="227" fill="#8b9ba8" fontSize="11" textAnchor="end">
              空间频率 · lp/mm
            </text>
          </svg>
          <p>
            <span style={{ color: "#b6dc91" }}>— 弧矢 S（X）</span>　
            <span style={{ color: "#dfb985" }}>— 子午 T（Y）</span>
          </p>
          <p>
            {((wave.field * 180) / Math.PI).toFixed(2)}° ·{" "}
            {wave.bands.length === 1 ? "单色" : "多色非相干强度叠加"} · 频率步长{" "}
            {wave.frequency_step_lp_mm.toFixed(2)} lp/mm
          </p>
        </div>
      </div>
      <table className="wave-table">
        <thead>
          <tr>
            <th>波长 nm</th>
            <th>归一化权重</th>
            <th>波前 RMS / λ</th>
            <th>最大相位步长 / λ</th>
            <th>有效 / 遮挡采样</th>
          </tr>
        </thead>
        <tbody>
          {wave.bands.map((b, i) => (
            <tr key={i}>
              <td>{b.wavelength_nm.toFixed(3)}</td>
              <td>{b.weight.toFixed(3)}</td>
              <td>{b.rms_waves.toFixed(4)}</td>
              <td>{b.max_phase_step_waves.toFixed(3)}</td>
              <td>
                {b.pupil_samples} / {b.blocked_samples}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        RMS 仅移除活塞项，保留离焦与像差。
        {wave.method === "sphere_kirchhoff"
          ? "直接积分采用有限像面窗口，能量在该窗口内归一化；边缘能量是窗口检查指标，不是全部缺失能量的严格误差界。"
          : `局部傅里叶展开估计误差 ${q.local_expansion_error_waves.toFixed(4)} λ（99% 能量半径内）。`}
        {wave.warning}
      </p>
    </div>
  );
}

export function Layout({
  project,
  result,
  selected,
  onSelect,
  highlightedRay,
}: {
  project: Project;
  result: Analysis | null;
  selected: number;
  onSelect: (i: number) => void;
  highlightedRay?: Ray | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(initialView);
  const [showFailed, setShowFailed] = useState(true);
  const aimingFailed =
    result?.rays.filter(
      (r) => r.stage === "aiming" || r.status === "aiming_failed",
    ).length ?? 0;
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const moved = useRef(false);
  const position = (clientX: number, clientY: number) => {
    const matrix = svgRef.current?.getScreenCTM()?.inverse();
    return matrix
      ? new DOMPoint(clientX, clientY).matrixTransform(matrix)
      : new DOMPoint(500, 180);
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = position(e.clientX, e.clientY);
      setView((v) =>
        zoomAt(
          v,
          Math.exp(-Math.max(-200, Math.min(200, e.deltaY)) * 0.003),
          p.x,
          p.y,
        ),
      );
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, []);
  let z = 0;
  const vertices = project.surfaces.map((s) => {
    const v = z;
    z += s.thickness;
    return v;
  });
  const maxR = Math.max(
    ...project.surfaces.map((s) => Math.max(s.semi_aperture, outerRadius(s))),
    project.sensor[1] / 2,
    10,
  );
  const extent = Math.max(z, 20);
  const scale = Math.min(740 / (extent + 20), 245 / (maxR * 2));
  const X = (v: number) => (90 + v * scale) * view.zoom + view.x;
  const Y = (v: number) => (180 - v * scale) * view.zoom + view.y;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 1000, 360);
    if (!result) return;
    for (let i = 0; i < result.rays.length; i++) {
      const r = result.rays[i];
      if (!isDrawableRay(r, showFailed)) continue;
      ctx.strokeStyle =
        r.status === "complete"
          ? r.wavelength_nm < 530
            ? "#9ebdfb80"
            : r.wavelength_nm < 620
              ? "#a9d99080"
              : "#efa77a80"
          : r.status === "blocked"
            ? "#efb46e90"
            : "#e8727290";
      ctx.lineWidth = 1;
      ctx.beginPath();
      r.points.forEach((p, k) =>
        k ? ctx.lineTo(X(p[2]), Y(p[1])) : ctx.moveTo(X(p[2]), Y(p[1])),
      );
      ctx.stroke();
      if (r.status !== "complete") {
        const last = r.points.at(-1)!;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(X(last[2]) - 2, Y(last[1]) - 2, 4, 4);
      }
    }
    if (highlightedRay && isDrawableRay(highlightedRay, true)) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      highlightedRay.points.forEach((p, k) =>
        k ? ctx.lineTo(X(p[2]), Y(p[1])) : ctx.moveTo(X(p[2]), Y(p[1])),
      );
      ctx.stroke();
      const last = highlightedRay.points.at(-1)!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(X(last[2]) - 3, Y(last[1]) - 3, 6, 6);
    }
  }, [result, project, view, showFailed, highlightedRay]);
  return (
    <>
      <div className="canvas-tools">
        <label className="ray-toggle">
          <input
            type="checkbox"
            checked={showFailed}
            onChange={(e) => setShowFailed(e.target.checked)}
          />
          显示物理失败光路
        </label>
        {aimingFailed > 0 && (
          <small className="aiming-hidden">
            {aimingFailed} 条显示样本瞄准失败，未绘制试算路径
          </small>
        )}
        <button
          aria-label="缩小画布"
          onClick={() => setView((v) => zoomAt(v, 1 / 1.25, 500, 180))}
        >
          −
        </button>
        <span>{(view.zoom * 100).toFixed(0)}%</span>
        <button
          aria-label="放大画布"
          onClick={() => setView((v) => zoomAt(v, 1.25, 500, 180))}
        >
          ＋
        </button>
        <button onClick={() => setView(initialView)}>适应全部</button>
        <button
          disabled={!project.surfaces.length}
          onClick={() => {
            const lens = lensAt(project, selected);
            const start = lens?.start ?? selected,
              end = lens?.end ?? selected;
            const r = Math.max(
              ...project.surfaces.slice(start, end + 1).map(outerRadius),
              1,
            );
            const zoom = Math.max(
              0.25,
              Math.min(
                16,
                200 / (r * 2 * scale),
                650 / (Math.max(5, vertices[end] - vertices[start]) * scale),
              ),
            );
            setView({
              zoom,
              x:
                500 -
                (90 + ((vertices[start] + vertices[end]) / 2) * scale) * zoom,
              y: 180 - 180 * zoom,
            });
          }}
        >
          聚焦选中镜片
        </button>
        <small>滚轮缩放 · 拖动平移 · 方向键移动</small>
      </div>
      <div className="layout">
        <canvas
          ref={ref}
          width={1000}
          height={360}
          data-drawn-rays={
            result?.rays.filter((r) => isDrawableRay(r, showFailed)).length ?? 0
          }
          data-aiming-suppressed={aimingFailed}
          data-highlighted-ray={
            highlightedRay && isDrawableRay(highlightedRay, true)
              ? highlightedRay.status
              : "none"
          }
        />
        <svg
          ref={svgRef}
          tabIndex={0}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.focus();
            const p = position(e.clientX, e.clientY);
            drag.current = { x: p.x, y: p.y, startX: p.x, startY: p.y };
            moved.current = false;
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            if (e.buttons === 0) {
              drag.current = null;
              return;
            }
            const p = position(e.clientX, e.clientY),
              d = drag.current;
            if (Math.hypot(p.x - d.startX, p.y - d.startY) > 4)
              moved.current = true;
            if (moved.current) {
              e.currentTarget.setPointerCapture(e.pointerId);
              const dx = p.x - d.x,
                dy = p.y - d.y;
              setView((v) => ({
                ...v,
                x: v.x + dx,
                y: v.y + dy,
              }));
            }
            d.x = p.x;
            d.y = p.y;
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onClickCapture={(e) => {
            if (moved.current) {
              e.stopPropagation();
              moved.current = false;
            }
          }}
          onKeyDown={(e) => {
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "+",
                "=",
                "-",
                "0",
              ].includes(e.key)
            ) {
              e.preventDefault();
              if (e.key === "0") setView(initialView);
              else if (["+", "=", "-"].includes(e.key))
                setView((v) =>
                  zoomAt(v, e.key === "-" ? 1 / 1.25 : 1.25, 500, 180),
                );
              else
                setView((v) => ({
                  ...v,
                  x:
                    v.x +
                    (e.key === "ArrowLeft"
                      ? 30
                      : e.key === "ArrowRight"
                        ? -30
                        : 0),
                  y:
                    v.y +
                    (e.key === "ArrowUp"
                      ? 30
                      : e.key === "ArrowDown"
                        ? -30
                        : 0),
                }));
            }
          }}
          viewBox="0 0 1000 360"
          role="img"
          aria-label="镜头剖面与实际追迹光线"
        >
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ffffff08" />
            </pattern>
            <linearGradient id="glass">
              <stop stopColor="#61d7c0" stopOpacity=".06" />
              <stop offset=".5" stopColor="#61d7c0" stopOpacity=".22" />
              <stop offset="1" stopColor="#61d7c0" stopOpacity=".06" />
            </linearGradient>
          </defs>
          <rect width="1000" height="360" fill="url(#grid)" />
          <path
            d={`M0 ${Y(0)}H1000`}
            stroke="#8b969a55"
            strokeDasharray="5 6"
          />
          {project.surfaces.map((s, i) => {
            const pts = Array.from({ length: 65 }, (_, j) => {
              const h = -s.semi_aperture + (2 * s.semi_aperture * j) / 64;
              return [X(vertices[i] + sag(s, Math.abs(h))), Y(h)];
            });
            let fill = "";
            const next = project.surfaces[i + 1];
            if (s.material !== 0 && next) {
              const front = profileHeights(s).map((h) => [
                X(vertices[i] + profile(s, Math.abs(h))),
                Y(h),
              ]);
              const back = profileHeights(next)
                .reverse()
                .map((h) => [
                  X(vertices[i + 1] + profile(next, Math.abs(h))),
                  Y(h),
                ]);
              if (front.concat(back).every((p) => p.every(Number.isFinite)))
                fill = front
                  .concat(back)
                  .map((p) => p.join(","))
                  .join(" ");
            }
            return (
              <g
                key={i}
                onClick={() => onSelect(i)}
                className="surface"
                tabIndex={0}
                role="button"
                aria-label={s.name}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect(i);
                }}
              >
                {fill && (
                  <polygon
                    points={fill}
                    fill="url(#glass)"
                    stroke={
                      selected === i || selected === i + 1
                        ? "#b2c38d"
                        : "#657e83"
                    }
                    strokeWidth="1.3"
                  >
                    <title>镜片实体 · 含非成像机械边缘</title>
                  </polygon>
                )}
                <polyline
                  points={pts
                    .filter((p) => p.every(Number.isFinite))
                    .map((p) => p.join(","))
                    .join(" ")}
                  fill="none"
                  stroke={selected === i ? "#d7fca2" : "#5dc8b8"}
                  strokeWidth={selected === i ? 2.5 : 1.5}
                />
                <polyline
                  points={pts
                    .filter((p) => p.every(Number.isFinite))
                    .map((p) => p.join(","))
                    .join(" ")}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                />
                {i === project.stop && (
                  <path
                    d={`M${X(vertices[i])} ${Y(maxR)}V${Y(s.semi_aperture)} M${X(vertices[i])} ${Y(-s.semi_aperture)}V${Y(-maxR)}`}
                    stroke="#c5d0d7"
                    strokeWidth="5"
                  />
                )}
                <text
                  x={X(vertices[i])}
                  y={Y(-maxR) - 8 + (i % 2) * 17}
                  fill={selected === i ? "#d7fca2" : "#78838f"}
                  fontSize="10"
                  textAnchor="middle"
                >
                  S{i + 1}
                </text>
              </g>
            );
          })}
          <path
            d={`M${X(z)} ${Y(project.sensor[1] / 2)}V${Y(-project.sensor[1] / 2)}`}
            stroke="#dfb985"
            strokeWidth="3"
          />
          <text
            x={X(z) + 10}
            y={Y(project.sensor[1] / 2)}
            fill="#dfb985"
            fontSize="11"
          >
            像面
          </text>
          <text x="28" y="30" fill="#7b8996" fontSize="11">
            MERIDIONAL SECTION · 子午剖面
          </text>
          <text x="28" y="338" fill="#7b8996" fontSize="11">
            光线方向 +Z →　 /　 等比例 · mm
          </text>
        </svg>
      </div>
    </>
  );
}
export function Spots({
  result,
  extent: sharedExtent,
}: {
  result: Analysis | null;
  extent?: number;
}) {
  if (!result) return <div className="empty">等待光学计算</div>;
  const extent = sharedExtent ?? spotExtent([result]);
  return (
    <div className="spot-grid">
      {result.fields.map((f, index) => {
        const spots = result.spots.filter((s) => s.field === f.field);
        return (
          <div className="spot" key={index}>
            <div>
              <span>
                {f.field === 0
                  ? "中心视场"
                  : `${((f.field * 180) / Math.PI).toFixed(1)}° 视场`}
              </span>
              <b>
                {f.polychromatic_rms_um?.toFixed(2) ?? "—"} <small>µm</small>
              </b>
            </div>
            <svg viewBox="0 0 240 180" aria-label="围绕多色共同质心的点列图">
              <path d="M20 90H220M120 12V168" stroke="#ffffff13" />
              {[30, 60].map((r) => (
                <circle
                  key={r}
                  cx="120"
                  cy="90"
                  r={r}
                  fill="none"
                  stroke="#ffffff08"
                />
              ))}
              {spots.map((s, i) =>
                s.points.map((p, k) => (
                  <circle
                    key={`${i}-${k}`}
                    cx={120 + ((p[0] - (f.centroid?.[0] ?? 0)) / extent) * 76}
                    cy={90 - ((p[1] - (f.centroid?.[1] ?? 0)) / extent) * 76}
                    r="1.3"
                    opacity=".65"
                    fill={
                      s.wavelength_nm < 530
                        ? "#9ebdfb"
                        : s.wavelength_nm < 620
                          ? "#a9d990"
                          : "#efa77a"
                    }
                  />
                )),
              )}
              <path d="M175 158H215" stroke="#7b8996" />
              <text
                x="215"
                y="174"
                textAnchor="end"
                fontSize="9"
                fill="#7b8996"
              >
                {((extent * 1000 * 40) / 76).toFixed(0)} µm
              </text>
            </svg>
          </div>
        );
      })}
    </div>
  );
}
