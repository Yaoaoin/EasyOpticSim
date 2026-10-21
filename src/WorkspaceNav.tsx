import { CircleHelp } from "lucide-react";
import { useRef } from "react";
import { sectionFor } from "./navigation";
import type { ExperienceMode } from "./experience";
export default function WorkspaceNav({
  tab,
  onTab,
  onHelp,
  experience,
}: {
  tab: string;
  onTab: (v: string) => void;
  onHelp: () => void;
  experience: ExperienceMode;
}) {
  const section = sectionFor(tab);
  const last = useRef<Record<string, string>>({});
  last.current[section.id] = tab;
  if (experience === "simple") {
    const active =
      tab === "goals"
        ? "goals"
        : ["health", "versions", "drawing"].includes(tab)
          ? "health"
          : "assistant";
    return (
      <div className="workspace-navigation guided-navigation">
        <nav aria-label="设计流程">
          {[
            ["goals", "我的目标"],
            ["assistant", "画面与改进"],
            ["health", "检查与保存"],
          ].map(([id, label], i) => (
            <button
              key={id}
              className={active === id ? "selected" : ""}
              aria-pressed={active === id}
              onClick={() => onTab(id)}
            >
              <span>0{i + 1}</span>
              {label}
            </button>
          ))}
          <details className="guided-tools">
            <summary>更多工具</summary>
            <div>
              {[
                ["prescription", "编辑镜片"],
                ["geometry", "结构检查"],
                ["spots", "光点分布"],
                ["wave", "精细画质"],
                ["preview", "测试图成像"],
                ["focus", "手动对焦扫描"],
                ["aperture", "光圈与通光"],
                ["optimization", "高级优化"],
                ["versions", "设计版本"],
                ["drawing", "导出图纸"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={(e) => {
                    onTab(id);
                    e.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>
          <button onClick={onHelp} aria-label="当前页面帮助">
            <CircleHelp size={16} />
          </button>
        </nav>
      </div>
    );
  }
  return (
    <div className="workspace-navigation">
      <nav aria-label="工作流程" className="workflow-nav">
        {(["design", "quality", "tune", "deliver"] as const).map((id, i) => {
          const labels = ["设计", "画质", "调校", "交付"];
          const defaults = ["goals", "spots", "focus", "versions"];
          return (
            <button
              key={id}
              aria-pressed={section.id === id}
              className={section.id === id ? "active" : ""}
              onClick={() => onTab(last.current[id] ?? defaults[i])}
            >
              <span>0{i + 1}</span>
              {labels[i]}
            </button>
          );
        })}
        <button className="context-help" onClick={onHelp}>
          <CircleHelp size={15} />
          当前页面帮助
        </button>
      </nav>
      <div className="workflow-subnav">
        <nav aria-label={`${section.label}功能`}>
          {section.tabs.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              className={tab === id ? "selected" : ""}
              onClick={() => onTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <span>{section.hint}</span>
      </div>
    </div>
  );
}
