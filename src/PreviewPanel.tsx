import { useEffect, useRef, useState } from "react";
import { compute } from "./engine";
import { explainError } from "./errors";
import type { Project, WaveOptions } from "./types";
import Coverage from "./Coverage";
import TestChart, { type TestPreview } from "./TestChart";
export default function PreviewPanel({
  project,
  disabled,
}: {
  project: Project;
  disabled: boolean;
}) {
  const [pattern, setPattern] = useState("grid"),
    [method, setMethod] = useState<WaveOptions["method"]>("fast"),
    [preview, setPreview] = useState<TestPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setPreview(null);
    setBusy(false);
    setError("");
    return () => controller.current?.abort();
  }, [project, pattern, method]);
  async function run() {
    const c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    setBusy(true);
    setError("");
    try {
      const p = await compute<TestPreview>(
        crypto.randomUUID(),
        "preview",
        project,
        c.signal,
        {
          pattern,
          wave_options: {
            field_index: 0,
            wavelength_nm: null,
            max_pupil_samples: 256,
            method,
          },
        },
      );
      if (!c.signal.aborted) setPreview(p);
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <div className="preview-controls">
        <label>
          成像衍射模型
          <select
            aria-label="成像衍射模型"
            value={method}
            onChange={(e) => setMethod(e.target.value as WaveOptions["method"])}
          >
            <option value="fast">快速 · 小视场</option>
            <option value="sphere_kirchhoff">
              直接 Kirchhoff · 离轴平面像面
            </option>
          </select>
        </label>
        <select
          aria-label="测试图类型"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        >
          <option value="grid">网格</option>
          <option value="resolution">分辨率条纹</option>
          <option value="points">点光源阵列</option>
        </select>
        <button disabled={disabled || busy} onClick={() => void run()}>
          {busy ? "检查各视场 PSF 并卷积…" : "计算多色测试图"}
        </button>
        {busy && (
          <button
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
            }}
          >
            取消
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {preview ? (
        <>
          <Coverage value={preview.coverage} />
          <TestChart preview={preview} pattern={pattern} />
        </>
      ) : (
        <div className="wave-empty">
          <h3>从光学指标到可见效果</h3>
          <p>
            每个视场使用完整多色 PSF 卷积局部平面测试图，自动检查采样收敛。
            建议先自动对焦。图像采用周期延拓与线性灰度；标尺随计算区域显示。
          </p>
        </div>
      )}
    </>
  );
}
