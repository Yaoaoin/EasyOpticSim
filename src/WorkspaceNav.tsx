import { CircleHelp } from "lucide-react";
import { useRef } from "react";
import { sectionFor } from "./navigation";
import { simpleStepFor, simpleSteps, type ExperienceMode } from "./experience";
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
    const step = simpleStepFor(tab);
    const destinations: Record<(typeof simpleSteps)[number]["id"], string> = {
      goal: "goals",
      build: "prescription",
      improve: "spots",
      verify: "aberration",
    };
    const tools: Record<string, [string, string][]> = {
      goal: [["goals", "设置拍摄目标"]],
      build: [
        ["prescription", "添加与调整镜片"],
        ["geometry", "看看镜片是否碰撞"],
      ],
      improve: [
        ["spots", "查看清晰度"],
        ["focus", "自动寻找焦点"],
        ["optimization", "自动改进"],
      ],
      verify: [
        ["aberration", "检查通光"],
        ["wave", "精细画质检查"],
        ["drawing", "导出图纸"],
        ["versions", "保存设计版本"],
      ],
    };
    return (
      <div className="workspace-navigation simple-navigation">
        <nav aria-label="简单设计流程" className="simple-steps">
          {simpleSteps.map((item, index) => (
            <button
              key={item.id}
              aria-current={step.id === item.id ? "step" : undefined}
              className={step.id === item.id ? "active" : ""}
              onClick={() => onTab(destinations[item.id])}
            >
              <span>{index + 1}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
          <button className="context-help" onClick={onHelp} title="当前页面帮助">
            <CircleHelp size={16} />
          </button>
        </nav>
        <div className="simple-subnav">
          <span>现在做什么</span>
          <nav aria-label="当前步骤工具">
            {tools[step.id].map(([id, label]) => (
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
        </div>
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
