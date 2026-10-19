import { useEffect, useState } from "react";
import { compute } from "./engine";
import { explainError } from "./errors";
import { opticalKey } from "./design";
import { fieldTargets, sensorHeights, setFieldSpec } from "./fields";
import type { Analysis, FieldPlan, Project } from "./types";
import Coverage from "./Coverage";
export default function FieldPanel({
  project,
  result,
  edit,
}: {
  project: Project;
  result: Analysis | null;
  edit: (f: (p: Project) => void) => void;
}) {
  const [plan, setPlan] = useState<FieldPlan | null>(null),
    [planKey, setPlanKey] = useState(""),
    [error, setError] = useState(""),
    [draft, setDraft] = useState("");
  const key = opticalKey(project);
  const definitionKey = JSON.stringify([
    project.field_spec,
    project.fields,
    project.sensor,
  ]);
  const heightMode = project.field_spec?.mode === "image_heights";
  const currentPlan = planKey === key ? plan : null;
  const efl = currentPlan?.efl_mm ?? result?.paraxial.efl ?? null;
  useEffect(() => {
    const c = new AbortController();
    setPlan(null);
    setError("");
    const timer = setTimeout(() => {
      void compute<FieldPlan>(
        crypto.randomUUID(),
        "field_plan",
        project,
        c.signal,
      )
        .then((v) => {
          if (!c.signal.aborted) {
            setPlan(v);
            setPlanKey(key);
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(explainError(e));
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [key]);
  useEffect(
    () =>
      setDraft(
        (
          fieldTargets(project) ??
          project.fields.map((f) => (f * 180) / Math.PI)
        ).join(", "),
      ),
    [definitionKey],
  );
  return (
    <section className="field-panel">
      <h3>视场与传感器</h3>
      <label>
        视场定义
        <select
          aria-label="视场定义"
          value={project.field_spec?.mode ?? "angles"}
          onChange={(e) =>
            edit((p) => {
              setFieldSpec(
                p,
                e.target.value === "sensor"
                  ? { mode: "sensor" }
                  : e.target.value === "image_heights"
                    ? {
                        mode: "image_heights",
                        heights_mm: [0, ...sensorHeights(p)],
                      }
                    : undefined,
                efl ?? 50,
              );
              if (
                e.target.value === "angles" &&
                currentPlan?.fields.every((f) => f.angle_rad !== null)
              )
                p.fields = currentPlan.fields.map((f) => f.angle_rad!);
            })
          }
        >
          <option value="angles">按物方角度</option>
          <option value="sensor">跟随传感器：中心、边中点与角落</option>
          <option value="image_heights">按目标像高</option>
        </select>
      </label>
      <p>
        理想建议（
        {efl === null ? "当前焦距待计算" : `当前 EFL ${efl.toFixed(3)} mm`}）：
        {sensorHeights(project)
          .map(
            (h, i) =>
              `${["短边", "长边", "角落"][i]} ${h.toFixed(3)} mm${efl === null ? "" : ` ≈ ${((Math.atan(h / Math.abs(efl)) * 180) / Math.PI).toFixed(2)}°`}`,
          )
          .join("；")}
        。角度只是初值；像高模式按参考波长主光线在实际像面上的交点反求，镜头或传感器改变后重新求解。
      </p>
      {project.field_spec?.mode !== "sensor" && (
        <div className="workflow-actions">
          <label>
            {heightMode ? "目标像高 mm" : "物方半视场 °"}
            <input
              aria-label={heightMode ? "目标像高列表" : "物方半视场列表"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              const h = draft
                .split(/[,，\s]+/)
                .filter(Boolean)
                .map(Number);
              if (
                !h.length ||
                h.length > 15 ||
                h.some(
                  (v) =>
                    !Number.isFinite(v) ||
                    Math.abs(v) > (heightMode ? 10000 : (0.7 * 180) / Math.PI),
                )
              ) {
                setError(
                  heightMode
                    ? "请输入 1–15 个有限像高（±10000 mm），用逗号分隔"
                    : "请输入 1–15 个半视场角度（±40.107°），用逗号分隔",
                );
                return;
              }
              edit((p) => {
                if (!heightMode) {
                  delete p.field_spec;
                  p.fields = h.map((v) => (v * Math.PI) / 180);
                  return;
                }
                setFieldSpec(
                  p,
                  { mode: "image_heights", heights_mm: h },
                  efl ?? 50,
                );
              });
            }}
          >
            {heightMode ? "应用目标像高" : "应用物方角度"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {currentPlan ? (
        <div className="scroll-table">
          <table aria-label="实际视场求解">
            <thead>
              <tr>
                <th>位置</th>
                <th>目标像高 mm</th>
                <th>理想初值</th>
                <th>实际物方角度</th>
                <th>实际像高 mm</th>
                <th>主光线 / 原因</th>
              </tr>
            </thead>
            <tbody>
              {currentPlan.fields.map((f, i) => (
                <tr key={i}>
                  <td>{f.label}</td>
                  <td>{f.target_height_mm?.toFixed(4) ?? "按角度"}</td>
                  <td>
                    {f.initial_angle_rad === null
                      ? "—"
                      : ((f.initial_angle_rad * 180) / Math.PI).toFixed(4) +
                        "°"}
                  </td>
                  <td>
                    {f.angle_rad === null
                      ? "未求解"
                      : ((f.angle_rad * 180) / Math.PI).toFixed(4) + "°"}
                  </td>
                  <td>{f.actual_height_mm?.toFixed(5) ?? "—"}</td>
                  <td>
                    {f.chief_status === "complete"
                      ? "通过（仍须检查整束光线）"
                      : f.chief_status === "blocked"
                        ? "物理遮挡"
                        : "未完成"}
                    {f.diagnostic && (
                      <small>{explainError(f.diagnostic)}</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            参考波长 {currentPlan.reference_wavelength_nm.toFixed(3)}{" "}
            nm；几何计算角度边界 ±
            {((currentPlan.geometry_limit_rad * 180) / Math.PI).toFixed(2)}
            °，实际能力取决于瞄准、曲面与通光检查。未找到目标像高时不会退回理想角度假装通过。
          </p>
        </div>
      ) : (
        !error && <p role="status">正在求解实际测试视场…</p>
      )}
      <Coverage value={result?.coverage} />
    </section>
  );
}
