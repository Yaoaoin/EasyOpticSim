import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Download, LoaderCircle, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { compute, exportReport } from "./engine";
import { explainError } from "./errors";
import { evaluateHealth, type HealthAction, type HealthReport } from "./health";
import type { Analysis, Geometry, Project, Wave } from "./types";

const labels = {
  pass: "可以继续",
  improve: "建议改进",
  fail: "必须修复",
  unchecked: "尚未检查",
};

export default function HealthCheckPanel({ project, disabled, navigate, onSurface, onAutofocus, onOptimize, onSave, onReport }: {
  project: Project;
  disabled: boolean;
  navigate: (tab: string) => void;
  onSurface: (surface: number) => void;
  onAutofocus: () => void;
  onOptimize: () => void;
  onSave: () => void;
  onReport: (report: HealthReport | null) => void;
}) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setReport(null);
    onReport(null);
    return () => controller.current?.abort();
  }, [project, onReport]);

  async function run() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setReport(null);
    onReport(null);
    try {
      setStage("检查镜片与空气间隔");
      const geometry = await compute<Geometry>(crypto.randomUUID(), "geometry", project, c.signal);
      setStage("追迹中心、边缘和角落");
      const analysis = await compute<Analysis>(crypto.randomUUID(), "analyze", project, c.signal, { sampling: 33 });
      const indexes = [...new Set([0, Math.max(0, project.fields.length - 1)])];
      const waves: (Wave | null)[] = [];
      for (const index of indexes) {
        setStage(`检查快速 PSF / MTF（${waves.length + 1}/${indexes.length}）`);
        try {
          waves.push(await compute<Wave>(crypto.randomUUID(), "wave", project, c.signal, {
            wave_options: {
              field_index: index,
              wavelength_nm: null,
              max_pupil_samples: 128,
              method: Math.abs(project.fields[index] ?? 0) <= 0.15 ? "fast" : "sphere_kirchhoff",
            },
          }));
        } catch (waveError) {
          if (c.signal.aborted) throw waveError;
          waves.push(null);
        }
      }
      const next = evaluateHealth(project, geometry, analysis, waves);
      if (!c.signal.aborted) {
        setReport(next);
        onReport(next);
      }
    } catch (value) {
      if (!c.signal.aborted) setError(explainError(value));
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        setStage("");
      }
    }
  }

  const act = (action?: HealthAction, surface?: number | null) => {
    if (action === "surface" && surface !== null && surface !== undefined) {
      onSurface(surface);
      navigate("geometry");
    } else if (action === "autofocus") onAutofocus();
    else if (action === "optimization") onOptimize();
    else if (action === "aperture") navigate("aperture");
    else if (action === "goals") navigate("goals");
    else if (action === "wave") navigate("wave");
    else if (action === "save") onSave();
  };

  return <div className="health-panel workflow-panel">
    <div className="health-hero">
      <div><span className="tag">ONE-CLICK CHECK</span><h2><ShieldCheck size={24} /> 一键镜头体检</h2><p>按固定顺序检查数据、机械、通光、几何画质、焦点、目标和快速 PSF / MTF。任何自动修改都会先成为候选。</p></div>
      <button className="primary health-run" disabled={disabled || busy || !project.surfaces.length} onClick={() => void run()}>{busy ? <><LoaderCircle className="spin" size={17} />{stage}</> : <><ShieldCheck size={17} />开始完整体检</>}</button>
    </div>
    {busy && <div className="health-progress"><span /><strong>{stage}</strong><button onClick={() => { controller.current?.abort(); setBusy(false); setStage(""); }}>取消</button></div>}
    {error && <div className="error" role="alert"><strong>体检没有完成</strong><p>{error}</p></div>}
    {!report && !busy && !error && <div className="health-empty"><ShieldCheck size={32} /><strong>还没有体检结果</strong><span>点击一次即可完成五类检查；高成本项目可以随时取消。</span></div>}
    {report && <>
      <div className={`health-summary ${report.overall}`}><strong>{labels[report.overall]}</strong><span>{report.completed}/5 类检查完成 · {report.sampling}×{report.sampling} 几何复核</span></div>
      <div className="health-grid">{report.cards.map((card) => <article className={`health-card ${card.status}`} key={card.id}>
        <header>{card.status === "pass" ? <CheckCircle2 /> : card.status === "fail" ? <XCircle /> : <CircleAlert />}<div><small>{labels[card.status]}</small><h3>{card.title}</h3></div></header>
        <strong>{card.summary}</strong>
        {card.details.map((detail, index) => <p key={index}>{detail}</p>)}
        {card.action && <button onClick={() => act(card.action, card.surface)}>{card.action === "autofocus" ? "生成自动对焦候选" : card.action === "optimization" ? <><Sparkles size={14} />生成改进候选</> : card.action === "surface" ? "带我去问题镜片" : card.action === "aperture" ? "检查光圈与口径" : card.action === "wave" ? "打开精细画质检查" : "保存当前项目"}</button>}
      </article>)}</div>
      <div className="workflow-actions"><button onClick={() => void exportReport(`${project.name}-lens-health.json`, { ...report, generated_at: new Date().toISOString(), project })}><Download size={15} />导出完整体检报告</button><button onClick={() => void run()}>重新体检</button></div>
    </>}
  </div>;
}
