import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { compute } from "./engine";
import { candidateKey } from "./design";
import {
  assistantIntents,
  runAssistant,
  type AssistantResult,
} from "./assistant";
import type { Analysis, AnalysisPreset, Candidate, Project } from "./types";
import { fieldLabel } from "./fields";

const number = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "未得到结果" : n.toFixed(2);

export function PictureSummary({
  project,
  analysis,
}: {
  project: Project;
  analysis: Analysis | null;
}) {
  return (
    <section className="picture-summary" aria-label="当前画面表现">
      <div className="assistant-heading">
        <div>
          <small>由当前光学模型计算</small>
          <h2>看懂你的镜头</h2>
        </div>
        <span className="tag">
          {analysis
            ? `${analysis.sampling} × ${analysis.sampling} 采样`
            : "等待计算"}
        </span>
      </div>
      <div className="picture-metrics">
        <div>
          <span>当前焦距</span>
          <strong>
            {number(analysis?.paraxial.efl)} <small>mm</small>
          </strong>
        </div>
        <div>
          <span>当前光圈</span>
          <strong>F / {number(analysis?.paraxial.f_number)}</strong>
        </div>
        <div>
          <span>使用画幅</span>
          <strong>
            {project.sensor.join(" × ")} <small>mm</small>
          </strong>
        </div>
      </div>
      <p>
        光点越集中，几何模糊通常越小。实际细节还需要结合衍射、对比度与通光结果判断。
      </p>
      <div className="field-results">
        {analysis?.fields.map((f, i) => (
          <article key={i}>
            <span>
              {project.field_spec?.mode === "sensor"
                ? (["中心", "短边中点", "长边中点", "角落"][i] ??
                  `画面位置 ${i + 1}`)
                : i === 0 && f.field === 0
                  ? "中心"
                  : `画面位置 ${i + 1}`}
            </span>
            <strong>
              {number(f.polychromatic_rms_um)} <small>µm</small>
            </strong>
            <small>{fieldLabel(project, i)} · 光点 RMS 半径</small>
          </article>
        ))}
      </div>
      <small>
        拍摄距离：
        {project.object_distance == null
          ? "远处景物"
          : `${project.object_distance / 1000} m`}{" "}
        · 波长：{project.wavelengths.map((w) => w.nm).join(" / ")}{" "}
        nm。预览不是实拍照片。
      </small>
    </section>
  );
}

export default function DesignAssistant({
  project,
  analysis,
  onCandidate,
  navigate,
}: {
  project: Project;
  analysis: Analysis | null;
  onCandidate: (candidate: Candidate) => void;
  navigate: (tab: string) => void;
}) {
  const [intent, setIntent] = useState<AnalysisPreset>("balanced");
  const [stage, setStage] = useState("");
  const [report, setReport] = useState<AssistantResult | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const key = candidateKey(project);
  useEffect(() => {
    controller.current?.abort();
    setStage("");
    setReport(null);
    setError("");
    return () => controller.current?.abort();
  }, [key]);
  async function run() {
    const c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    setReport(null);
    setError("");
    try {
      const next = await runAssistant(
        project,
        intent,
        (operation, p, extras) =>
          compute(crypto.randomUUID(), operation, p, c.signal, extras),
        c.signal,
        setStage,
      );
      if (!c.signal.aborted) setReport(next);
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!c.signal.aborted) setStage("");
    }
  }
  return (
    <div className="design-assistant">
      <PictureSummary project={project} analysis={analysis} />
      <section className="assistant-card">
        <div className="assistant-heading">
          <div>
            <small>你决定方向，助手负责检查</small>
            <h2>
              <Sparkles size={22} /> 让镜头更进一步
            </h2>
          </div>
        </div>
        <p>
          先检查结构与通光，再尝试对焦和有限参数优化。保留材料、画幅及原有目标；默认只调整曲率和像距，已有变量范围与锁定继续生效。
        </p>
        <div className="intent-options" role="group" aria-label="改进方向">
          {(Object.keys(assistantIntents) as AnalysisPreset[]).map((id) => (
            <button
              key={id}
              disabled={!!stage}
              aria-pressed={intent === id}
              className={intent === id ? "selected" : ""}
              onClick={() => {
                setIntent(id);
                setReport(null);
              }}
            >
              {assistantIntents[id]}
            </button>
          ))}
        </div>
        <div className="assistant-actions">
          <button
            className="primary"
            disabled={!!stage || !project.surfaces.length}
            onClick={() => void run()}
          >
            {stage ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            {stage ? "正在寻找并验证候选" : "检查并尝试改进"}
          </button>
          {stage && (
            <button
              onClick={() => {
                controller.current?.abort();
                setStage("");
                setError("已取消；当前设计没有改变。");
              }}
            >
              取消计算
            </button>
          )}
        </div>
        <p role="status" aria-live="polite">
          {stage ||
            "精细复核采用 65×65 几何采样，并检查各视场衍射收敛。计算可能需要一些时间。"}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {report && (
          <div className="assistant-report">
            <h3>
              {report.candidate ? (
                <>
                  <CheckCircle2 size={18} /> 找到了通过复核的候选
                </>
              ) : (
                "这次没有可直接采纳的方案"
              )}
            </h3>
            {!!report.blockers.length && (
              <ul>
                {report.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {report.after && (
              <div className="comparison-scroll">
                <table>
                  <caption>
                    同一画幅、距离与波长下的光点 RMS 半径（µm，越小越集中）
                  </caption>
                  <thead>
                    <tr>
                      <th>画面位置</th>
                      <th>原设计</th>
                      <th>候选</th>
                      <th>变化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.before.fields.map((f, i) => {
                      const b = f.polychromatic_rms_um,
                        a = report.after!.fields[i]?.polychromatic_rms_um;
                      return (
                        <tr key={i}>
                          <td>{fieldLabel(project, i)}</td>
                          <td>{number(b)}</td>
                          <td>{number(a)}</td>
                          <td>
                            {b != null && a != null
                              ? `${(a - b).toFixed(2)} µm`
                              : "未完成"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {report.candidate && (
              <>
                <p>{report.candidate.note}</p>
                <p>
                  焦距：{number(report.before.paraxial.efl)} →{" "}
                  {number(report.after?.paraxial.efl)} mm； 光圈：F/
                  {number(report.before.paraxial.f_number)} → F/
                  {number(report.after?.paraxial.f_number)}。
                </p>
                <details>
                  <summary>哪些镜片参数改变了</summary>
                  <ul>
                    {report.candidate.project.surfaces.flatMap((surface, i) =>
                      (
                        [
                          "curvature",
                          "thickness",
                          "semi_aperture",
                          "conic",
                        ] as const
                      )
                        .filter((k) => surface[k] !== project.surfaces[i]?.[k])
                        .map((k) => (
                          <li key={`${i}-${k}`}>
                            第 {i + 1} 面 ·{" "}
                            {
                              {
                                curvature: "曲率（mm⁻¹）",
                                thickness: "面后距离（mm）",
                                semi_aperture: "有效半口径（mm）",
                                conic: "圆锥系数",
                              }[k]
                            }
                            ：{project.surfaces[i]?.[k].toPrecision(6)} →{" "}
                            {surface[k].toPrecision(6)}
                          </li>
                        )),
                    )}
                  </ul>
                </details>
                <button
                  className="primary"
                  onClick={() => onCandidate(report.candidate!)}
                >
                  查看候选与采纳条件 <ArrowRight size={16} />
                </button>
              </>
            )}
            <details>
              <summary>助手做了哪些检查</summary>
              <ol>
                {report.messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
            </details>
          </div>
        )}
        <div className="assistant-links">
          <button onClick={() => navigate("geometry")}>检查镜片结构</button>
          <button onClick={() => navigate("spots")}>查看光点分布</button>
          <button onClick={() => navigate("wave")}>查看精细画质</button>
          <button onClick={() => navigate("health")}>完整体检与保存</button>
        </div>
      </section>
    </div>
  );
}
