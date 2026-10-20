import {
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import Modal from "./Modal";

const steps = [
  [
    "先告诉我想拍什么",
    "新建向导会检查模板的实际能力，并说明它离你的目标还有多远。",
    "goals",
  ],
  [
    "先看懂当前画面",
    "查看各画面位置的光点大小。光点集中不等于全部画质通过，精细检查仍然保留。",
    "assistant",
  ],
  [
    "让助手尝试改进",
    "选择中心、边缘或全画面。助手检查结构、尝试对焦与优化，再独立复核；确认后才会改变设计。",
    "assistant",
  ],
  [
    "点击一次完成体检",
    "机械、通光、画质、焦点和导出准备会按固定顺序检查。",
    "health",
  ],
  [
    "保存、导出、再回来",
    "新项目使用 .eos.json；旧 .oos.json 仍可打开。离线手册和示例随安装包提供。",
    "versions",
  ],
] as const;

export default function OnboardingTour({
  close,
  navigate,
}: {
  close: (completed: boolean) => void;
  navigate: (tab: string) => void;
}) {
  const [step, setStep] = useState(0);
  const item = steps[step];
  return (
    <Modal
      title="第一次使用 EasyOpticSim"
      className="tour-dialog"
      onCancel={() => close(false)}
    >
      <div className="tour-progress">
        {steps.map((_, index) => (
          <span className={index <= step ? "active" : ""} key={index}>
            {index < step ? <Check size={13} /> : index + 1}
          </span>
        ))}
      </div>
      <section className="tour-page">
        <div className="tour-orb">
          {step === 3 ? <ShieldCheck /> : <Sparkles />}
        </div>
        <small>
          第 {step + 1} 步，共 {steps.length} 步
        </small>
        <h2>{item[0]}</h2>
        <p>{item[1]}</p>
        <button
          onClick={() => {
            navigate(item[2]);
            close(step === steps.length - 1);
          }}
        >
          在工作区看看
        </button>
      </section>
      <div className="dialog-actions">
        <button onClick={() => close(true)}>
          <X size={14} />
          跳过引导
        </button>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)}>
            <ArrowLeft size={14} />
            上一步
          </button>
        )}
        {step < steps.length - 1 ? (
          <button className="primary" onClick={() => setStep(step + 1)}>
            下一步
            <ArrowRight size={14} />
          </button>
        ) : (
          <button className="primary" onClick={() => close(true)}>
            开始设计
            <Check size={14} />
          </button>
        )}
      </div>
    </Modal>
  );
}
