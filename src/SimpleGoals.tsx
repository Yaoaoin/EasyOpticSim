import { Num } from "./Num";
import type { Analysis, Project } from "./types";
import { defaultConstraints, ensureWorkspace } from "./versions";
import GoalPanel from "./GoalPanel";

export default function SimpleGoals({
  project,
  analysis,
  edit,
  navigate,
  disabled,
}: {
  project: Project;
  analysis: Analysis | null;
  edit: (fn: (p: Project) => void) => void;
  navigate: (tab: string) => void;
  disabled: boolean;
}) {
  const goals = project.workspace?.constraints;
  return (
    <section className="assistant-card simple-goals">
      <small>明确方向，再让助手尝试</small>
      <h2>这个镜头要做到什么？</h2>
      <p>
        目标和实际能力分开记录。修改目标不会立即改变镜片，也不保证当前结构一定能达到。
      </p>
      {!goals ? (
        <button
          className="primary"
          disabled={disabled || !analysis?.paraxial.efl}
          onClick={() =>
            edit((p) => {
              ensureWorkspace(p).constraints = defaultConstraints(
                p,
                analysis!.paraxial.efl!,
              );
            })
          }
        >
          以当前焦距建立目标
        </button>
      ) : (
        <>
          <Num
            label="拍摄范围 · 目标焦距"
            value={goals.target_efl_mm}
            min={1}
            unit="mm"
            onChange={(n) =>
              edit((p) => {
                p.workspace!.constraints!.target_efl_mm = n;
              })
            }
          />
          <p>
            同一画幅下，焦距越长，拍到的范围通常越窄。当前实际焦距：
            {analysis?.paraxial.efl?.toFixed(2) ?? "待计算"} mm。
          </p>
          {goals.design && (
            <>
              <Num
                label="进光需求 · 目标光圈 F 数"
                value={goals.design.f_number}
                min={0.5}
                max={128}
                onChange={(n) =>
                  edit((p) => {
                    p.workspace!.constraints!.design!.f_number = n;
                  })
                }
              />
              <p>
                F 数越小，所需入瞳通常越大。当前实际光圈：F/
                {analysis?.paraxial.f_number?.toFixed(2) ?? "待计算"}。
              </p>
            </>
          )}
          <Num
            label="镜头到成像面的总长度上限"
            value={goals.max_length_mm}
            min={1}
            unit="mm"
            onChange={(n) =>
              edit((p) => {
                p.workspace!.constraints!.max_length_mm = n;
              })
            }
          />
          <button className="primary" onClick={() => navigate("assistant")}>
            查看画面并尝试改进
          </button>
        </>
      )}
      <details>
        <summary>更多条件与精确参数</summary>
        <GoalPanel
          project={project}
          result={analysis}
          edit={edit}
          disabled={disabled}
          optimize={() => navigate("assistant")}
        />
      </details>
    </section>
  );
}
