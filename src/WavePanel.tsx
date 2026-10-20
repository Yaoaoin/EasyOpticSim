import { useEffect, useRef, useState } from "react";
import { compute, native, saveNativeProject } from "./engine";
import { download } from "./project";
import { explainError } from "./errors";
import { Diffraction } from "./Plots";
import type { Project, Wave, WaveOptions } from "./types";
import Coverage from "./Coverage";
import { fieldLabel } from "./fields";
export default function WavePanel({
  project,
  disabled,
}: {
  project: Project;
  disabled: boolean;
}) {
  const [options, setOptions] = useState<WaveOptions>({
    field_index: 0,
    wavelength_nm: null,
    max_pupil_samples: 256,
    method: "fast",
  });
  const [wave, setWave] = useState<Wave | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setWave(null);
    setBusy(false);
    setError("");
    setNotice("");
    return () => controller.current?.abort();
  }, [project, options]);
  // Keep a changed project with fewer fields usable.
  const fieldIndex = Math.min(options.field_index, project.fields.length - 1);
  async function run() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setWave(null);
    setNotice("");
    try {
      const w = await compute<Wave>(
        crypto.randomUUID(),
        "wave",
        project,
        c.signal,
        { wave_options: { ...options, field_index: fieldIndex } },
      );
      if (!c.signal.aborted) setWave(w);
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  async function exportMtf() {
    if (!wave) return;
    const metadata = [
      ["format", "EasyOpticSim diffraction report v1"],
      ["project_json", JSON.stringify(project)],
      ["field_rad", String(wave.field)],
      ["pixel_um", String(wave.pixel_um)],
      ["bands_json", JSON.stringify(wave.bands)],
      ["quality_json", JSON.stringify(wave.quality)],
      ["coverage_json", JSON.stringify(wave.coverage)],
      ["method", wave.method ?? "fast"],
      ["model", wave.warning],
    ];
    const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
    const rows = metadata.map((row) => row.map(quote).join(","));
    rows.push("frequency_lp_mm,mtf_sagittal,mtf_tangential");
    wave.mtf_sagittal.forEach((v, i) =>
      rows.push(
        [i * wave.frequency_step_lp_mm, v, wave.mtf_tangential[i]].join(","),
      ),
    );
    const text = rows.join("\r\n");
    try {
      if (native) {
        const saved = await saveNativeProject(
          "diffraction-report.csv",
          text,
          true,
        );
        setNotice(
          saved ? "MTF 报告已保存，包含处方、光谱与收敛信息。" : "已取消导出。",
        );
      } else {
        download("diffraction-report.csv", text, "text/csv");
        setNotice("MTF 报告已导出。");
      }
    } catch (e) {
      setError(explainError(e));
    }
  }
  return (
    <div className="wave-panel">
      <div className="preview-controls">
        <label>
          衍射模型
          <select
            aria-label="衍射模型"
            value={options.method ?? "fast"}
            onChange={(e) =>
              setOptions({
                ...options,
                method: e.target.value as WaveOptions["method"],
              })
            }
          >
            <option value="fast">快速 · 小视场 ±8.59°</option>
            <option value="sphere_kirchhoff">离轴 · 平面像面 Kirchhoff</option>
          </select>
        </label>
        <label>
          视场
          <select
            aria-label="衍射视场"
            value={fieldIndex}
            onChange={(e) =>
              setOptions({ ...options, field_index: Number(e.target.value) })
            }
          >
            {project.fields.map((f, i) => (
              <option key={i} value={i}>
                {fieldLabel(project, i)}
              </option>
            ))}
          </select>
        </label>
        <label>
          光谱
          <select
            aria-label="衍射光谱"
            value={options.wavelength_nm ?? "all"}
            onChange={(e) =>
              setOptions({
                ...options,
                wavelength_nm:
                  e.target.value === "all" ? null : Number(e.target.value),
              })
            }
          >
            <option value="all">多色 · 使用项目权重</option>
            {project.wavelengths.map((w, i) => (
              <option key={i} value={w.nm}>
                {w.nm.toFixed(2)} nm
              </option>
            ))}
          </select>
        </label>
        <label>
          采样上限
          <select
            aria-label="衍射采样上限"
            value={options.max_pupil_samples}
            onChange={(e) =>
              setOptions({
                ...options,
                max_pupil_samples: Number(e.target.value),
              })
            }
          >
            <option value={128}>128 · 快速验证</option>
            <option value={256}>256 · 精细验证</option>
          </select>
        </label>
        <button disabled={disabled || busy} onClick={() => void run()}>
          {busy ? "追迹瞳面并检查收敛…" : "计算 PSF / MTF"}
        </button>
        {busy && (
          <button
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
              setNotice("计算已取消。");
            }}
          >
            取消衍射
          </button>
        )}
        {wave && (
          <button onClick={() => void exportMtf()}>导出 MTF 报告</button>
        )}
      </div>
      <div role="status" aria-live="polite">
        {notice && <p className="hint">{notice}</p>}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {wave ? (
        <>
          <Coverage value={wave.coverage} />
          <p className="quality-bar">
            模型：
            {wave.method === "sphere_kirchhoff" ? "离轴 Kirchhoff" : "快速"} ·
            {wave.method === "sphere_kirchhoff"
              ? `直接距离积分 · 像面 Nyquist 比例 ${wave.quality.image_nyquist_ratio?.toFixed(4) ?? "—"}（须小于 1）`
              : `局部展开误差 ${wave.quality.local_expansion_error_waves.toExponential(3)} 波长`}
          </p>
          <Diffraction wave={wave} />
        </>
      ) : (
        !error && (
          <div className="wave-empty">
            <h3>经过收敛检查的标量衍射</h3>
            <p>
              规则参考球面采样；多色强度相加，保留横向色差。结果包含物理尺度、光谱权重及收敛误差。建议先自动对焦并采纳像面。
            </p>
            <p>
              快速模型限小视场；离轴模型使用实际参考球面、遮挡、球面积与倾斜因子，在最终平面传感器上计算。两者都保留采样与误差检查；角度在范围内不保证可算或已验证传感器角落。
            </p>
          </div>
        )
      )}
    </div>
  );
}
