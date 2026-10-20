import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Mountain, ScanFace, Search, Telescope } from "lucide-react";
import type { Project } from "./types";
import Modal from "./Modal";
import { Num } from "./Num";
import { blankProject } from "./lenses";
import { copy } from "./project";
import { setFieldSpec } from "./fields";
import { defaultConstraints, ensureWorkspace } from "./versions";

type Purpose = "portrait" | "landscape" | "telephoto" | "macro";
const purposes = {
  portrait: {
    name: "拍人像",
    summary: "自然视角，背景更柔和",
    Icon: ScanFace,
    efl: 85,
    fNumber: 2.8,
    distance: 2000,
  },
  landscape: {
    name: "拍风景",
    summary: "装下更多景物，边角也清楚",
    Icon: Mountain,
    efl: 28,
    fNumber: 8,
    distance: null,
  },
  telephoto: {
    name: "拍远处",
    summary: "把远处主体拉近",
    Icon: Telescope,
    efl: 200,
    fNumber: 5.6,
    distance: null,
  },
  macro: {
    name: "拍近物",
    summary: "观察小物体和细节",
    Icon: Search,
    efl: 60,
    fNumber: 4,
    distance: 300,
  },
} satisfies Record<Purpose, object>;

export default function NewProject({
  library,
  onCreate,
  onCancel,
}: {
  library: Project[];
  onCreate: (p: Project) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1),
    [purpose, setPurpose] = useState<Purpose>("portrait"),
    [name, setName] = useState("我的第一个镜头"),
    [template, setTemplate] = useState(library.length ? 0 : -1),
    [width, setWidth] = useState(36),
    [height, setHeight] = useState(24),
    [field, setField] = useState(5.73),
    [sensorFields, setSensorFields] = useState(true),
    [infinity, setInfinity] = useState(false),
    [distance, setDistance] = useState(2000),
    [advanced, setAdvanced] = useState(false);
  const choice = purposes[purpose];
  const progress = useMemo(() => `${step} / 3`, [step]);
  const guidedStarters = useMemo(() => {
    const find = (pattern: RegExp, fallback: number) => {
      const index = library.findIndex((project) => pattern.test(`${project.name} ${project.description}`));
      return index >= 0 ? index : Math.min(fallback, Math.max(0, library.length - 1));
    };
    return [
      { purpose: "portrait" as const, label: "人像练习模板", index: find(/doublet|双胶合|portrait|人像/i, 0) },
      { purpose: "landscape" as const, label: "广角练习模板", index: find(/35|wide|广角|风景/i, 1) },
      { purpose: "telephoto" as const, label: "长焦练习模板", index: find(/400|tele|长焦|远摄/i, 2) },
      { purpose: "macro" as const, label: "近物练习模板", index: find(/macro|近物|singlet|单透镜/i, 0) },
    ];
  }, [library]);

  const choosePurpose = (value: Purpose) => {
    const preset = purposes[value];
    setPurpose(value);
    setInfinity(preset.distance === null);
    if (preset.distance !== null) setDistance(preset.distance);
  };

  const create = () => {
    const p = template < 0 ? blankProject(library[0], name) : copy(library[template]);
    p.schema_version = Math.max(3, p.schema_version);
    p.name = name.trim();
    p.description = `${choice.name} · EasyOpticSim Y1.1 简单向导创建`;
    p.sensor = [width, height];
    p.fields = [0, ((field * Math.PI) / 180) * 0.7, (field * Math.PI) / 180];
    delete p.field_spec;
    if (sensorFields) setFieldSpec(p, { mode: "sensor" });
    p.object_distance = infinity ? null : distance;
    const constraints = defaultConstraints(p, choice.efl);
    constraints.design = {
      f_number: choice.fNumber,
      f_tolerance: Math.max(0.1, choice.fNumber * 0.08),
      min_bfl_mm: Math.max(1, height * 0.15),
      max_front_diameter_mm: Math.max(35, choice.efl / choice.fNumber * 1.6),
    };
    ensureWorkspace(p).constraints = constraints;
    onCreate(p);
  };

  return (
    <Modal title="创建一个镜头" onCancel={onCancel} className="onboarding-dialog">
      <div className="wizard-progress" aria-label={`创建进度 ${progress}`}>
        {["想拍什么", "想要什么效果", "选择起点"].map((label, i) => (
          <div className={step >= i + 1 ? "active" : ""} key={label}>
            <span>{step > i + 1 ? <Check size={14} /> : i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <section className="wizard-page">
          <p className="wizard-eyebrow">不用懂光学，先选一个最接近的用途</p>
          <h2>你最想拍什么？</h2>
          <div className="purpose-grid">
            {(Object.keys(purposes) as Purpose[]).map((id) => {
              const item = purposes[id];
              return (
                <button
                  className={purpose === id ? "selected" : ""}
                  aria-pressed={purpose === id}
                  key={id}
                  onClick={() => choosePurpose(id)}
                >
                  <item.Icon size={28} />
                  <strong>{item.name}</strong>
                  <small>{item.summary}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="wizard-page">
          <p className="wizard-eyebrow">这些选择会变成正式的光学目标，之后仍可修改</p>
          <h2>{choice.name}，我们先这样开始</h2>
          <div className="plain-goals">
            <div><span>画面感觉</span><strong>{choice.efl <= 35 ? "宽广" : choice.efl >= 135 ? "拉近远处" : "自然聚焦主体"}</strong></div>
            <div><span>背景与进光</span><strong>{choice.fNumber <= 3 ? "柔和背景、更多进光" : "清楚稳定、容易成功"}</strong></div>
            <div><span>拍摄距离</span><strong>{choice.distance === null ? "远处景物" : `${choice.distance / 1000} 米左右`}</strong></div>
          </div>
          <label className="text-label wizard-name">
            给这个设计起个名字
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <details className="advanced-disclosure" open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
            <summary>精确设置（可跳过）</summary>
            <div className="dialog-grid">
              <Num label="传感器宽度" value={width} onChange={setWidth} min={0.1} unit="mm" />
              <Num label="传感器高度" value={height} onChange={setHeight} min={0.1} unit="mm" />
            </div>
            <label className="check"><input type="checkbox" checked={sensorFields} onChange={(e) => setSensorFields(e.target.checked)} />自动检查传感器中心、边缘与角落（推荐）</label>
            {!sensorFields && <Num label="最大半视场" value={field} onChange={setField} min={0} max={40.1} unit="°" />}
            <label className="check"><input type="checkbox" checked={infinity} onChange={(e) => setInfinity(e.target.checked)} />拍摄远处景物</label>
            {!infinity && <Num label="拍摄距离" value={distance} onChange={setDistance} min={1.01} max={1e12} unit="mm" />}
          </details>
        </section>
      )}

      {step === 3 && (
        <section className="wizard-page">
          <p className="wizard-eyebrow">推荐从已能成像的示例继续，更容易看到每次修改的效果</p>
          <h2>选择一个起点</h2>
          <div className="starter-list">
            {guidedStarters.map((starter) => {
              const source = library[starter.index];
              if (!source) return null;
              const active = purpose === starter.purpose && template === starter.index;
              return <button key={starter.purpose} className={active ? "selected" : ""} onClick={() => { choosePurpose(starter.purpose); setTemplate(starter.index); }}>
                <span className="starter-art" aria-hidden="true">)(</span>
                <span><strong>{starter.label}{starter.purpose === purpose ? " · 推荐" : ""}</strong><small>基于 {source.name} · 教学起点，不冒充已达标成品</small></span>
                {active && <Check size={18} />}
              </button>;
            })}
          </div>
          <details className="advanced-disclosure">
            <summary>查看全部示例和空白项目</summary>
            <div className="starter-list">
            {library.slice(0, 5).map((p, i) => (
              <button key={i} className={template === i ? "selected" : ""} onClick={() => setTemplate(i)}>
                <span className="starter-art" aria-hidden="true">)(</span>
                <span><strong>{p.name}</strong><small>{p.surfaces.length} 个光学表面 · 可立即分析</small></span>
                {template === i && <Check size={18} />}
              </button>
            ))}
            <button className={template === -1 ? "selected" : ""} onClick={() => setTemplate(-1)}>
              <span className="starter-art" aria-hidden="true">＋</span>
              <span><strong>完全空白</strong><small>适合熟悉镜头结构后从零搭建</small></span>
              {template === -1 && <Check size={18} />}
            </button>
            </div>
          </details>
          <div className="wizard-summary">
            <strong>准备好了</strong>
            <span>{name || "未命名项目"} · {choice.name} · 目标约 {choice.efl} mm F/{choice.fNumber}</span>
          </div>
        </section>
      )}

      <div className="dialog-actions wizard-actions">
        <button onClick={step === 1 ? onCancel : () => setStep(step - 1)}>{step === 1 ? "取消" : <><ArrowLeft size={15} />上一步</>}</button>
        {step < 3 ? (
          <button className="primary" disabled={step === 2 && !name.trim()} onClick={() => setStep(step + 1)}>继续 <ArrowRight size={15} /></button>
        ) : (
          <button className="primary" disabled={!name.trim() || (template < 0 && !library[0])} onClick={create}>创建并开始设计 <ArrowRight size={15} /></button>
        )}
      </div>
    </Modal>
  );
}
