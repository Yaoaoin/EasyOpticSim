import type { OptimizationOptions, Project } from "./types";
import { Num } from "./Num";
import { fieldLabel, fieldTargets } from "./fields";
export default function QualityEditor({
  project,
  value,
  onChange,
}: {
  project: Project;
  value: OptimizationOptions;
  onChange: (v: OptimizationOptions) => void;
}) {
  const count = fieldTargets(project)?.length ?? project.fields.length,
    g = value.quality;
  return (
    <details className="quality-editor">
      <summary>画质底线与分阶段视场</summary>
      <label>
        <input
          type="checkbox"
          checked={!!g}
          onChange={(e) =>
            onChange({
              ...value,
              quality: e.target.checked
                ? {
                    max_rms_um: Array(count).fill(null),
                    max_degradation_percent: 0,
                  }
                : undefined,
            })
          }
        />
        启用逐视场保护（最终 33×33 复核）
      </label>
      {g && (
        <>
          <p className="hint">
            未开启的指标不参与约束。原设计保护针对每个配置视场；中心不会因平均分提高而被默默牺牲。已有机械间隙约束仍执行连续区间检查。
          </p>
          {(
            [
              ["max_degradation_percent", "每个视场相对原设计最多退化", "%"],
              ["max_worst_rms_um", "最差视场 RMS 上限", "µm"],
              ["max_distortion_percent", "最大绝对畸变", "%"],
              ["max_lateral_color_um", "横向色差上限", "µm"],
              ["min_geometric_fraction", "最低几何采样通过比例", "0–1"],
            ] as const
          ).map(([k, label, unit]) => (
            <div key={k}>
              <label>
                <input
                  type="checkbox"
                  checked={g[k] != null}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      quality: {
                        ...g,
                        [k]: e.target.checked
                          ? k === "min_geometric_fraction"
                            ? 1
                            : k === "max_degradation_percent"
                              ? 0
                              : 10
                          : null,
                      },
                    })
                  }
                />
                {label}
              </label>
              {g[k] != null && (
                <Num
                  label={label}
                  value={g[k]!}
                  min={0}
                  max={k === "min_geometric_fraction" ? 1 : 1e8}
                  unit={unit}
                  onChange={(v) =>
                    onChange({ ...value, quality: { ...g, [k]: v } })
                  }
                />
              )}
            </div>
          ))}
          {Array.from({ length: count }, (_, i) => (
            <div key={i}>
              <label>
                <input
                  type="checkbox"
                  checked={g.max_rms_um[i] != null}
                  onChange={(e) => {
                    const values = Array.from(
                      { length: count },
                      (_, j) => g.max_rms_um[j] ?? null,
                    );
                    values[i] = e.target.checked ? 20 : null;
                    onChange({
                      ...value,
                      quality: { ...g, max_rms_um: values },
                    });
                  }}
                />
                {fieldLabel(project, i)} RMS 上限
              </label>
              {g.max_rms_um[i] != null && (
                <Num
                  label={`视场 ${i + 1} RMS 上限`}
                  value={g.max_rms_um[i]!}
                  min={0}
                  unit="µm"
                  onChange={(v) => {
                    const values = [...g.max_rms_um];
                    values[i] = v;
                    onChange({
                      ...value,
                      quality: { ...g, max_rms_um: values },
                    });
                  }}
                />
              )}
            </div>
          ))}
          <p className="hint">
            通光比例只指指定瞳采样；瞄准与数值失败始终阻止采纳。畸变约束目前仅定义无限远理想像高。视场定义变化后，请重新确认各行底线。
          </p>
        </>
      )}
      <label>
        <input
          type="checkbox"
          checked={!!value.staged}
          onChange={(e) => onChange({ ...value, staged: e.target.checked })}
        />
        按 50% → 75% → 100% 扩大视场，每阶段对照原设计
      </label>
      {value.staged && (
        <label>
          阶段对焦条件
          <select
            aria-label="阶段对焦条件"
            value={value.refocus_each_stage ? "refocus" : "common"}
            onChange={(e) =>
              onChange({
                ...value,
                refocus_each_stage: e.target.value === "refocus",
              })
            }
          >
            <option value="common">每个设计共用像面，不自动重新对焦</option>
            <option value="refocus">每阶段原设计与候选分别重新对焦</option>
          </select>
        </label>
      )}
    </details>
  );
}
