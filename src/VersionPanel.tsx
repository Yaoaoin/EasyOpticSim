import { useEffect, useRef, useState } from "react";
import { compute, exportReport } from "./engine";
import Coverage from "./Coverage";
import { commonSensorPlane } from "./versions";
import { fieldLabel } from "./fields";
import {
  addVersion,
  alignedPair,
  configurationMatches,
  comparisonConfiguration,
  ensureWorkspace,
  prescription,
  psfDensity,
  spotExtent,
} from "./versions";
import { Spots } from "./Plots";
import { explainError } from "./errors";
import type {
  Analysis,
  Candidate,
  AnalysisPreset,
  Project,
  Wave,
  OpticalGroup,
} from "./types";
import { presetLabels } from "./optimization";

function SharedWave({ waves }: { waves: [Wave, Wave] }) {
  const refs = [
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
  ];
  const [log, setLog] = useState(true),
    [windowUm, setWindowUm] = useState(100);
  const half = Math.min(
    windowUm / 2,
    ...waves.map((w) => (w.size / 2 - 1) * w.pixel_um),
  );
  const peak = Math.max(
    ...waves.map(
      (w) =>
        w.psf.reduce((m, v) => Math.max(m, v), 0) / (w.pixel_um * w.pixel_um),
    ),
  );
  const maxF = Math.min(
    200,
    ...waves.map((w) => (w.mtf_sagittal.length - 1) * w.frequency_step_lp_mm),
  );
  useEffect(() => {
    waves.forEach((w, j) => {
      const ctx = refs[j].current!.getContext("2d")!,
        img = ctx.createImageData(256, 256);
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++) {
          const v =
            psfDensity(
              w,
              ((x - 127.5) / 128) * half,
              ((y - 127.5) / 128) * half,
            ) / peak;
          const t = log ? Math.log1p(1000 * v) / Math.log(1001) : v;
          img.data.set([216 * t, 252 * t, 162 * t, 255], (y * 256 + x) * 4);
        }
      ctx.putImageData(img, 0, 0);
    });
  }, [waves, log, half, peak]);
  return (
    <div>
      <div className="workflow-actions">
        <label>
          <input
            type="checkbox"
            checked={log}
            onChange={(e) => setLog(e.target.checked)}
          />{" "}
          PSF 对数亮度
        </label>
        <label>
          共同视窗
          <select
            aria-label="对比PSF视窗"
            value={windowUm}
            onChange={(e) => setWindowUm(Number(e.target.value))}
          >
            {[20, 50, 100, 200, 500].map((v) => (
              <option key={v} value={v}>
                {v} µm
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="comparison-pair">
        {waves.map((w, i) => (
          <div key={i}>
            <h3>{i ? "B" : "A"} · PSF</h3>
            <canvas ref={refs[i]} width={256} height={256} />
            <p>相同视窗 {(2 * half).toFixed(2)} µm · 同一亮度标尺</p>
            <p>
              瞳采样 {w.quality.previous_sampling} → {w.quality.pupil_sampling}{" "}
              · MTF Δ {w.quality.mtf_max_change.toFixed(4)}
            </p>
          </div>
        ))}
      </div>
      <p>
        PSF 均按总能量 1 归一化，比较密度（µm⁻²），共同峰值{" "}
        {peak.toPrecision(4)}。双线性重采样仅用于显示，中心为各自参考主光线。
      </p>
      <svg
        className="focus-chart"
        viewBox="0 0 650 250"
        role="img"
        aria-label="统一物理频率轴的版本 MTF 对比"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <path d={`M55 ${210 - t * 180}H625`} stroke="#ffffff18" />
            <text x={48} y={214 - t * 180} textAnchor="end">
              {t}
            </text>
            <text x={55 + t * 570} y={232} textAnchor="middle">
              {(t * maxF).toFixed(0)}
            </text>
          </g>
        ))}
        <text x={55} y={15}>
          MTF
        </text>
        <text x={625} y={249} textAnchor="end">
          空间频率 lp/mm
        </text>
        {waves.flatMap((w, j) =>
          [w.mtf_sagittal, w.mtf_tangential].map((line, k) => (
            <polyline
              key={`${j}-${k}`}
              fill="none"
              stroke={j ? "#9ebdfb" : "#b6dc91"}
              strokeWidth={2}
              strokeDasharray={k ? "5 4" : undefined}
              points={line
                .map((v, i) => [i * w.frequency_step_lp_mm, v])
                .filter(([f]) => f <= maxF)
                .map(([f, v]) => `${55 + (f / maxF) * 570},${210 - v * 180}`)
                .join(" ")}
            />
          )),
        )}
      </svg>
      <p>
        A 绿色 · B 蓝色；实线弧矢 S，虚线子午 T。横轴共同截取至{" "}
        {maxF.toFixed(1)} lp/mm。
      </p>
    </div>
  );
}

export default function VersionPanel({
  project,
  edit,
  restore,
}: {
  project: Project;
  edit: (f: (p: Project) => void) => void;
  restore: (
    p: Project,
    preset?: AnalysisPreset,
    groups?: OpticalGroup[],
  ) => void;
}) {
  const versions = project.workspace?.versions ?? [];
  const [name, setName] = useState(""),
    [aId, setAId] = useState(versions[0]?.id ?? "current"),
    [bId, setBId] = useState("current"),
    [aligned, setAligned] = useState(false),
    [field, setField] = useState(0);
  const [focusCondition, setFocusCondition] = useState("common"),
    [method, setMethod] = useState<"fast" | "sphere_kirchhoff">("fast"),
    [computedPair, setComputedPair] = useState<[Project, Project] | null>(null);
  const [analyses, setAnalyses] = useState<[Analysis, Analysis] | null>(null),
    [waves, setWaves] = useState<[Wave, Wave] | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const a = versions.find((v) => v.id === aId)?.prescription ?? project,
    b = versions.find((v) => v.id === bId)?.prescription ?? project;
  const same = configurationMatches(a, b),
    key = JSON.stringify([
      prescription(a),
      prescription(b),
      aligned,
      focusCondition,
      method,
    ]);
  useEffect(() => {
    controller.current?.abort();
    setAnalyses(null);
    setWaves(null);
    setBusy("");
    setError("");
    setComputedPair(null);
    return () => controller.current?.abort();
  }, [key]);
  useEffect(() => {
    setAligned(false);
    setField(0);
  }, [aId, bId]);
  useEffect(() => {
    controller.current?.abort();
    setWaves(null);
    setBusy("");
  }, [field]);
  const pair = alignedPair(a, b);
  const options = {
    method,
    field_index: Math.min(field, a.fields.length - 1),
    wavelength_nm: null,
    max_pupil_samples: 256,
  };
  async function compare(wave = false) {
    const c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    setBusy(wave ? "计算 A 的衍射…" : "计算 A 的几何分析…");
    setError("");
    if (wave) setWaves(null);
    else {
      setAnalyses(null);
      setWaves(null);
    }
    try {
      let tested = wave && computedPair ? computedPair : pair;
      if (!wave || !computedPair) {
        if (focusCondition === "common") tested = commonSensorPlane(pair);
        else {
          const x = await compute<Candidate>(
            crypto.randomUUID(),
            "autofocus",
            pair[0],
            c.signal,
          );
          const y = await compute<Candidate>(
            crypto.randomUUID(),
            "autofocus",
            pair[1],
            c.signal,
          );
          tested = [x.project, y.project];
        }
        if (c.signal.aborted) return;
        setComputedPair(tested);
      }
      if (wave) {
        const x = await compute<Wave>(
          crypto.randomUUID(),
          "wave",
          tested[0],
          c.signal,
          { wave_options: options },
        );
        if (c.signal.aborted) return;
        setBusy("计算 B 的衍射…");
        const y = await compute<Wave>(
          crypto.randomUUID(),
          "wave",
          tested[1],
          c.signal,
          { wave_options: options },
        );
        if (!c.signal.aborted) setWaves([x, y]);
      } else {
        const x = await compute<Analysis>(
          crypto.randomUUID(),
          "analyze",
          tested[0],
          c.signal,
          { sampling: 33 },
        );
        if (c.signal.aborted) return;
        setBusy("计算 B 的几何分析…");
        const y = await compute<Analysis>(
          crypto.randomUUID(),
          "analyze",
          tested[1],
          c.signal,
          { sampling: 33 },
        );
        if (!c.signal.aborted) setAnalyses([x, y]);
      }
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy("");
    }
  }
  const add = () => {
    try {
      edit((p) => addVersion(p, project, name));
      setName("");
    } catch (e) {
      setError(explainError(e));
    }
  };
  const label = (id: string) =>
    versions.find((v) => v.id === id)?.name ?? "当前设计";
  return (
    <div className="workflow-panel">
      <h2>设计版本与同尺度对比</h2>
      <p>
        版本保存完整处方、材料与分析配置，随项目文件保存。恢复保留版本库，并可撤销。
      </p>
      <div className="workflow-actions">
        <label>
          对比对焦条件
          <select
            aria-label="对比对焦条件"
            value={focusCondition}
            onChange={(e) => setFocusCondition(e.target.value)}
          >
            <option value="common">共用 A 的绝对平面像面</option>
            <option value="refocus">A / B 分别自动对焦</option>
          </select>
        </label>
        <label>
          对比衍射模型
          <select
            aria-label="对比衍射模型"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="fast">快速 · 小视场</option>
            <option value="sphere_kirchhoff">直接 Kirchhoff · 离轴</option>
          </select>
        </label>
        <input
          aria-label="新版本名称"
          placeholder="例如：缩小光圈前"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button disabled={versions.length >= 20} onClick={add}>
          保存当前为版本
        </button>
        <span>{versions.length} / 20</span>
      </div>
      {versions.length > 0 && (
        <div className="scroll-table">
          <table>
            <thead>
              <tr>
                <th>版本名称</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>
                    <input
                      aria-label={`版本名称 ${v.name}`}
                      defaultValue={v.name}
                      key={v.name}
                      maxLength={120}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== v.name)
                          edit((p) => {
                            ensureWorkspace(p).versions.find(
                              (x) => x.id === v.id,
                            )!.name = next;
                          });
                        else e.target.value = v.name;
                      }}
                    />
                    <small>
                      {v.note} · 目标预设：
                      {presetLabels[v.analysis_preset ?? "balanced"]}
                    </small>
                  </td>
                  <td>{new Date(v.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() =>
                        restore(
                          v.prescription,
                          v.analysis_preset ?? "balanced",
                          v.groups,
                        )
                      }
                    >
                      恢复
                    </button>
                    <button
                      onClick={() =>
                        edit((p) => {
                          p.workspace!.versions = p.workspace!.versions.filter(
                            (x) => x.id !== v.id,
                          );
                        })
                      }
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="workflow-actions">
        {(
          [
            ["A", aId, setAId],
            ["B", bId, setBId],
          ] as const
        ).map(([title, id, set]) => (
          <label key={title}>
            {title}
            <select
              aria-label={`对比版本${title}`}
              value={versions.some((v) => v.id === id) ? id : "current"}
              onChange={(e) => set(e.target.value)}
            >
              <option value="current">当前设计</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {!same && (
        <div className="error">
          <p>
            两个设计的视场、光谱、物距或传感器设置不同。需要统一设置才能比较。
          </p>
          <label>
            <input
              type="checkbox"
              checked={aligned}
              onChange={(e) => setAligned(e.target.checked)}
            />{" "}
            仅在此次计算中将 B 统一为 A 的配置
          </label>
        </div>
      )}
      <p>
        共同配置（A）：视场{" "}
        {a.fields.map((_, i) => fieldLabel(a, i)).join(" / ")} ·{" "}
        {a.object_distance === null ? "无限远" : `物距 ${a.object_distance} mm`}{" "}
        · 传感器 {a.sensor.join("×")} mm。光谱{" "}
        {a.wavelengths.map((w) => `${w.nm} nm × ${w.weight}`).join(" / ")}
        ；几何采样 33×33。像高模式分别反求实际物方角度，详见各自覆盖报告。
      </p>
      <div className="workflow-actions">
        <button
          className="primary"
          disabled={
            !!busy ||
            (!same && !aligned) ||
            !a.surfaces.length ||
            !b.surfaces.length
          }
          onClick={() => void compare()}
        >
          计算同尺度对比
        </button>
        {busy && (
          <button
            onClick={() => {
              controller.current?.abort();
              setBusy("");
              setError("已取消对比。");
            }}
          >
            取消
          </button>
        )}
        <span role="status">{busy}</span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {analyses && (
        <>
          <p className="quality-bar">
            共同点列图半宽 {spotExtent(analyses).toFixed(6)} mm ·
            各自多色共同质心对齐，保留横向色差
          </p>
          <div className="comparison-pair">
            {analyses.map((r, i) => (
              <div key={i}>
                <h3>
                  {i ? "B" : "A"} · {label(i ? bId : aId)}
                </h3>
                <p>
                  EFL {r.paraxial.efl?.toFixed(4) ?? "—"} mm · F/
                  {r.paraxial.f_number?.toFixed(3) ?? "—"}
                </p>
                <Spots result={r} extent={spotExtent(analyses)} />
                <Coverage value={r.coverage} compact />
                <p className={r.spots.some((s) => s.failed > 0) ? "error" : ""}>
                  失败 / 遮挡 {r.spots.reduce((n, s) => n + s.failed, 0)} /{" "}
                  {r.spots.reduce((n, s) => n + s.sampled, 0)}。
                  {r.spots.some((s) => s.failed > 0) &&
                    "RMS 仅统计存活光线，不能据此判定优化成功。"}
                </p>
              </div>
            ))}
          </div>
          <div className="workflow-actions">
            <label>
              衍射视场
              <select
                aria-label="对比衍射视场"
                value={options.field_index}
                onChange={(e) => setField(Number(e.target.value))}
              >
                {a.fields.map((f, i) => (
                  <option key={i} value={i}>
                    {fieldLabel(a, i)}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={!!busy} onClick={() => void compare(true)}>
              计算多色 PSF / MTF 对比
            </button>
            <button
              onClick={() =>
                void exportReport("version-comparison.json", {
                  format: "OSS comparison 2",
                  focus_condition: focusCondition,
                  labels: [label(aId), label(bId)],
                  projects: computedPair,
                  configuration: comparisonConfiguration(a),
                  sampling: 33,
                  spot_half_width_mm: spotExtent(analyses),
                  analyses: analyses.map((r) => ({
                    ...r,
                    rays: undefined,
                    spots: r.spots.map((s) => ({ ...s, points: undefined })),
                  })),
                  wave_options: options,
                  waves: waves?.map((w) => ({ ...w, psf: undefined })),
                  contents:
                    "Prescriptions, configuration, geometric summaries, MTF and convergence diagnostics; raw ray and PSF arrays omitted.",
                }).catch((e) => setError(explainError(e)))
              }
            >
              导出对比报告
            </button>
          </div>
        </>
      )}
      {waves && <SharedWave waves={waves} />}
    </div>
  );
}
