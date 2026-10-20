import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Camera,
  ScanEye,
} from "lucide-react";
import type { Analysis, ConstraintCheck, Geometry, Project } from "./types";
import Modal from "./Modal";
import { Num } from "./Num";
import { compute } from "./engine";
import { analysisProblems } from "./assistant";
import {
  createDesign,
  sensorPresets,
  starters,
  type NewDesign,
  type StarterId,
} from "./starters";
import { addVersion } from "./versions";
import { PictureSummary } from "./DesignAssistant";
import { checkLabel } from "./ConstraintEditor";

const steps = [
  "选择用途",
  "拍摄条件",
  "设计目标",
  "确认起点",
  "实际检查",
  "开始设计",
];
interface Preview {
  project: Project;
  analysis: Analysis;
  problems: string[];
}

export default function NewProject({
  onCreate,
  onCancel,
}: {
  onCreate: (p: Project) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [value, setValue] = useState<NewDesign>({
    starter: "portrait",
    name: "我的镜头设计",
    sensor: 0,
    distance: 2000,
    focal: 66,
    aperture: 6.6,
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const patch = (p: Partial<NewDesign>) => {
    controller.current?.abort();
    setBusy(false);
    setPreview(null);
    setError("");
    setValue((v) => ({ ...v, ...p }));
  };
  const selected = starters[value.starter];
  let valid = true;
  try {
    createDesign(value);
  } catch {
    valid = false;
  }
  async function inspect() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const project = createDesign(value);
      const geometry = await compute<Geometry>(
        crypto.randomUUID(),
        "geometry",
        project,
        c.signal,
      );
      const analysis = await compute<Analysis>(
        crypto.randomUUID(),
        "analyze",
        project,
        c.signal,
        { sampling: 33 },
      );
      const checks = await compute<ConstraintCheck[]>(
        crypto.randomUUID(),
        "checks",
        project,
        c.signal,
        { constraints: project.workspace!.constraints },
      );
      const problems = analysisProblems(project, analysis);
      if (
        geometry.diagnostics.length ||
        geometry.spans.some((s) => !s.certified)
      )
        problems.push("存在结构问题，需要先检查镜片");
      if (!checks.length) problems.push("没有取得设计目标的检查结果");
      for (const check of checks.filter((c) => !c.passed))
        problems.push(
          `${checkLabel(check)}：当前 ${check.actual?.toFixed(3) ?? "未确定"}，要求 ${check.relation === "min" ? "至少" : "不超过"} ${check.limit.toFixed(3)}`,
        );
      if (!c.signal.aborted) setPreview({ project, analysis, problems });
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const create = () => {
    try {
      const p = preview
        ? structuredClone(preview.project)
        : createDesign(value);
      addVersion(
        p,
        p,
        "创建起点",
        preview
          ? "完成基础检查；精细衍射与自动修正由设计助手继续。"
          : "未经检查的实验草稿。",
      );
      onCreate(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal
      title="一起设计你的镜头"
      onCancel={onCancel}
      className="onboarding-dialog guided-create"
    >
      <div
        className="wizard-progress"
        aria-label={`第 ${step + 1} 步，共 6 步`}
      >
        {steps.map((s, i) => (
          <div
            key={s}
            className={i <= step ? "active" : ""}
            aria-current={i === step ? "step" : undefined}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <section className="wizard-page">
        {step === 0 && (
          <>
            <p className="wizard-eyebrow">从你想探索的画面开始</p>
            <h2>你想设计什么样的镜头？</h2>
            <div className="purpose-grid">
              {(Object.keys(starters) as StarterId[]).map((id) => (
                <button
                  key={id}
                  className={id === value.starter ? "selected" : ""}
                  aria-pressed={id === value.starter}
                  onClick={() =>
                    patch({
                      starter: id,
                      focal: starters[id].focal,
                      aperture: starters[id].aperture,
                      distance: starters[id].distance,
                    })
                  }
                >
                  <Camera size={24} />
                  <strong>{starters[id].title}</strong>
                  <small>{starters[id].subtitle}</small>
                </button>
              ))}
            </div>
            <p>
              每个起点都是可计算的教学模型。助手会说明实际表现与目标之间的差距。
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h2>镜头将怎样使用？</h2>
            <label className="text-label">
              画幅大小
              <select
                value={value.sensor}
                onChange={(e) => patch({ sensor: Number(e.target.value) })}
              >
                {sensorPresets.map((p, i) => (
                  <option key={p.name} value={i}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <p>
              画幅越大，越需要检查镜头能否覆盖边缘和角落。不确定时可保留全画幅，检查结果会说明限制。
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={value.distance === null}
                onChange={(e) =>
                  patch({ distance: e.target.checked ? null : 2000 })
                }
              />
              拍摄远处景物
            </label>
            {value.distance !== null && (
              <Num
                label="到拍摄对象的距离"
                value={value.distance / 1000}
                min={0.01}
                unit="m"
                onChange={(n) => patch({ distance: n * 1000 })}
              />
            )}
          </>
        )}
        {step === 2 && (
          <>
            <h2>希望得到什么效果？</h2>
            <p>
              这些是目标，不会立即改变镜片。默认值接近模板的焦距与光圈，较大的改变可能超出当前结构能力。
            </p>
            <Num
              label="目标焦距 · 同画幅下，越长拍摄范围越窄"
              value={value.focal}
              min={1}
              max={2000}
              unit="mm"
              onChange={(focal) => patch({ focal })}
            />
            <Num
              label="目标光圈 · F 数越小，进光需求越大"
              value={value.aperture}
              min={0.5}
              max={128}
              unit="F"
              onChange={(aperture) => patch({ aperture })}
            />
            <p>
              背景虚化还取决于拍摄距离等条件。助手不会为了达到目标而悄悄更换材料或扩大口径。
            </p>
            <label className="text-label">
              给设计起个名字
              <input
                maxLength={120}
                value={value.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <span className="tag">{selected.difficulty}</span>
            <h2>{selected.title}的设计起点</h2>
            <div className="starter-detail">
              <ScanEye size={32} />
              <strong>
                参考焦距约 {selected.focal} mm · F/{selected.aperture}
              </strong>
              <p>{selected.limitation}</p>
            </div>
            <p>
              来源：{selected.file}
              。保留模板的真实材料与光谱条件；下一步按你选择的画幅和距离重新计算。
            </p>
            <p>
              目标：{value.focal} mm · F/{value.aperture}
              。如果检查不通过，可以返回修改目标或作为实验草稿继续。
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <h2>先看看这个起点能做到什么</h2>
            <p>
              检查镜片结构、画幅覆盖和目标差距。这里是 33×33
              基础检查；精细衍射和自动修正会在创建后由助手继续。
            </p>
            <button
              className="primary"
              disabled={busy || !valid}
              onClick={() => void inspect()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ScanEye size={16} />
              )}
              {busy
                ? "正在计算实际表现"
                : preview
                  ? "重新检查"
                  : "检查这个起点"}
            </button>
            {busy && (
              <button
                onClick={() => {
                  controller.current?.abort();
                  setBusy(false);
                }}
              >
                取消检查
              </button>
            )}
            {preview && (
              <>
                <PictureSummary
                  project={preview.project}
                  analysis={preview.analysis}
                />
                {preview.problems.length ? (
                  <ul>
                    {preview.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p>基础检查通过。精细画质尚未验证。</p>
                )}
              </>
            )}
          </>
        )}
        {step === 5 && (
          <>
            <h2>
              {preview?.problems.length || !preview
                ? "带着明确的问题继续探索"
                : "起点准备好了"}
            </h2>
            <div className="starter-detail">
              <strong>{value.name}</strong>
              <p>
                {selected.title} · {sensorPresets[value.sensor].name} · 目标{" "}
                {value.focal} mm F/{value.aperture}
              </p>
            </div>
            <p>
              {!preview
                ? "你选择跳过基础检查。项目会作为未检查草稿创建。"
                : preview.problems.length
                  ? preview.problems.join("；")
                  : "基础检查已完成，下一步让助手尝试改进并进行精细复核。"}
            </p>
            <p>
              创建后进入设计助手。原始起点会保存在版本记录中，所有候选都需要你确认才能替换当前镜头。
            </p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <div className="dialog-actions wizard-actions">
        <button
          disabled={busy}
          onClick={step === 0 ? onCancel : () => setStep(step - 1)}
        >
          <ArrowLeft size={15} />
          {step === 0 ? "取消" : "上一步"}
        </button>
        {step < 5 ? (
          <button
            className="primary"
            disabled={!valid || busy}
            onClick={() => setStep(step + 1)}
          >
            {step === 4 && !preview ? "跳过检查，作为草稿继续" : "继续"}
            <ArrowRight size={15} />
          </button>
        ) : (
          <button className="primary" disabled={!valid} onClick={create}>
            {!preview || preview.problems.length
              ? "创建实验草稿"
              : "创建并进入设计助手"}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </Modal>
  );
}
