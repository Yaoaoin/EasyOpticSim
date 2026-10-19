import { CircleHelp } from "lucide-react";
import { useRef } from "react";
import { sectionFor } from "./navigation";
export default function WorkspaceNav({
  tab,
  onTab,
  onHelp,
}: {
  tab: string;
  onTab: (v: string) => void;
  onHelp: () => void;
}) {
  const section = sectionFor(tab);
  const last = useRef<Record<string, string>>({});
  last.current[section.id] = tab;
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
