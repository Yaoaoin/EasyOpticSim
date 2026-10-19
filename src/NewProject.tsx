import { useState } from "react";
import type { Project } from "./types";
import Modal from "./Modal";
import { Num } from "./Num";
import { blankProject } from "./lenses";
import { copy } from "./project";
import { setFieldSpec } from "./fields";
export default function NewProject({
  library,
  onCreate,
  onCancel,
}: {
  library: Project[];
  onCreate: (p: Project) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("未命名项目"),
    [template, setTemplate] = useState(-1),
    [width, setWidth] = useState(36),
    [height, setHeight] = useState(24),
    [field, setField] = useState(5.73),
    [sensorFields, setSensorFields] = useState(true),
    [infinity, setInfinity] = useState(true),
    [distance, setDistance] = useState(1000);
  return (
    <Modal title="新建项目" onCancel={onCancel}>
      <label className="text-label">
        项目名称
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="text-label">
        起点
        <select
          value={template}
          onChange={(e) => setTemplate(Number(e.target.value))}
        >
          <option value={-1}>空白项目 · 从第一枚镜片开始</option>
          {library.map((p, i) => (
            <option key={i} value={i}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="dialog-grid">
        <Num
          label="传感器宽度"
          value={width}
          onChange={setWidth}
          min={0.1}
          unit="mm"
        />
        <Num
          label="传感器高度"
          value={height}
          onChange={setHeight}
          min={0.1}
          unit="mm"
        />
      </div>
      <label>
        <input
          type="checkbox"
          checked={sensorFields}
          onChange={(e) => setSensorFields(e.target.checked)}
        />
        按传感器自动反求测试视场（推荐）
      </label>
      {!sensorFields && (
        <Num
          label="最大半视场"
          value={field}
          onChange={setField}
          min={0}
          max={40.1}
          unit="°"
        />
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={infinity}
          onChange={(e) => setInfinity(e.target.checked)}
        />
        无限远物体
      </label>
      {!infinity && (
        <Num
          label="物距"
          value={distance}
          onChange={setDistance}
          min={1.01}
          max={1e12}
          unit="mm"
        />
      )}
      <p className="hint">
        使用 F/d/C 谱线等权重。项目完整携带材料数据，可以离线保存和重开。
      </p>
      <div className="dialog-actions">
        <button onClick={onCancel}>取消</button>
        <button
          className="primary"
          disabled={!name.trim()}
          onClick={() => {
            const p =
              template < 0
                ? blankProject(library[0], name)
                : copy(library[template]);
            p.schema_version = 2;
            p.name = name.trim();
            p.sensor = [width, height];
            p.fields = [
              0,
              ((field * Math.PI) / 180) * 0.7,
              (field * Math.PI) / 180,
            ];
            delete p.field_spec;
            if (sensorFields) setFieldSpec(p, { mode: "sensor" });
            p.object_distance = infinity ? null : distance;
            onCreate(p);
          }}
        >
          创建项目
        </button>
      </div>
    </Modal>
  );
}
