import { useEffect, useRef } from "react";
import type { WaveBand, WaveQuality, Coverage } from "./types";
import { explainError } from "./errors";
export interface TestFrame {
  field: number;
  size: number;
  computation_size: number;
  width_mm: number;
  source: number[];
  image: number[];
  retained_energy: number;
  shift_mm: number | null;
  reference_image_mm: number[];
  bands: WaveBand[];
  quality: WaveQuality;
}
export interface TestPreview {
  coverage?: Coverage | null;
  frames: TestFrame[];
  failures: { field: number; error: string }[];
  warning: string;
}
function Tile({ pixels, size }: { pixels: number[]; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    pixels.forEach((v, i) => img.data.set([v, v, v, 255], i * 4));
    ctx.putImageData(img, 0, 0);
  }, [pixels, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: "100%", imageRendering: "pixelated", borderRadius: 4 }}
    />
  );
}
export default function TestChart({
  preview,
  pattern,
}: {
  preview: TestPreview;
  pattern: string;
}) {
  return (
    <div className="chart-preview">
      <div className="spot-grid">
        {preview.frames.map((f, i) => (
          <div className="spot" key={i}>
            <p>
              {((f.field * 180) / Math.PI).toFixed(1)}° · {f.bands.length}{" "}
              个波长 · 收敛已检查
            </p>
            <p>理想目标</p>
            {pattern === "resolution" && (
              <p>
                上 / 中 / 下：
                {[8, 16, 32]
                  .map((v) => (v / f.width_mm).toFixed(1))
                  .join(" / ")}{" "}
                lp/mm（X 方向）
              </p>
            )}
            <Tile pixels={f.source} size={f.size} />
            <p>经镜头成像 · 宽 {f.width_mm.toFixed(3)} mm</p>
            <Tile pixels={f.image} size={f.size} />
            <p>
              完整 PSF 能量 {(100 * f.retained_energy).toFixed(2)}% ·{" "}
              {f.computation_size}² 计算网格
            </p>
            <p>
              参考像高 {f.reference_image_mm[1].toFixed(4)} mm
              {f.shift_mm !== null && (
                <>
                  {" "}
                  · 主光线畸变位移 {(1000 * f.shift_mm).toFixed(2)} µm（仅报告）
                </>
              )}
            </p>
          </div>
        ))}
      </div>
      {preview.failures.map((f, i) => (
        <div className="error" role="alert" key={i}>
          {((f.field * 180) / Math.PI).toFixed(2)}°：{explainError(f.error)}
        </div>
      ))}
      <p className="hint" style={{ padding: "0 20px 20px" }}>
        {preview.warning}
      </p>
    </div>
  );
}
