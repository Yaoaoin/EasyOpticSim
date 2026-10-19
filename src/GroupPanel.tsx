import { useEffect, useRef, useState } from "react";
import type { Project } from "./types";
import { compute } from "./engine";
import { ensureWorkspace } from "./versions";
import { lenses } from "./lenses";
import { opticalKey, validGroups } from "./design";
import { Num } from "./Num";
import { explainError } from "./errors";
export default function GroupPanel({
  project,
  edit,
  onSurface,
}: {
  project: Project;
  edit: (f: (p: Project) => void) => void;
  onSurface: (i: number) => void;
}) {
  const items = lenses(project),
    groups = project.workspace?.groups ?? [];
  const [name, setName] = useState("新镜组"),
    [first, setFirst] = useState(0),
    [last, setLast] = useState(Math.max(0, items.length - 1)),
    [group, setGroup] = useState(groups[0]?.id ?? ""),
    [delta, setDelta] = useState(0.01),
    [candidate, setCandidate] = useState<Project | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null),
    key = opticalKey(project) + JSON.stringify(groups),
    g = groups.find((v) => v.id === group);
  useEffect(() => {
    controller.current?.abort();
    setCandidate(null);
    setBusy(false);
    setError("");
    return () => controller.current?.abort();
  }, [key, delta, group]);
  function create() {
    const a = items[first],
      b = items[last];
    if (!a || !b || last < first) {
      setError("请选择一枚或多枚相邻完整镜片");
      return;
    }
    const next = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 120) || "新镜组",
      start: a.start,
      end: b.end,
    };
    if (!validGroups(project, [...groups, next])) {
      setError("镜组范围重复或重叠，请先解散原组");
      return;
    }
    edit((p) => {
      ensureWorkspace(p).groups = [...groups, next];
    });
    setGroup(next.id);
  }
  async function preview() {
    if (!g) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    try {
      const p = await compute<Project>(
        crypto.randomUUID(),
        "move_group",
        project,
        c.signal,
        { group_move: { start: g.start, end: g.end, delta_mm: delta } },
      );
      if (!c.signal.aborted) setCandidate(p);
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="workflow-panel">
      <h2>多镜片编组与整体移动</h2>
      <p>
        按相邻完整镜片编组，胶合面不拆分；移动只改组前与组后空气间隔，内部曲率、厚度和材料保持不变，组外镜片与传感器坐标固定。第一面是坐标原点，包含首面的组可保存但不能平移。
      </p>
      <div className="workflow-actions">
        <label>
          镜组名称
          <input
            aria-label="镜组名称"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {(["first", "last"] as const).map((which) => (
          <label key={which}>
            {which === "first" ? "开始镜片" : "结束镜片"}
            <select
              aria-label={which === "first" ? "编组开始镜片" : "编组结束镜片"}
              value={which === "first" ? first : last}
              onChange={(e) =>
                (which === "first" ? setFirst : setLast)(Number(e.target.value))
              }
            >
              {items.map((l, i) => (
                <option key={i} value={i}>
                  {i + 1} {l.name} S{l.start + 1}–S{l.end + 1}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          disabled={groups.length >= 20 || items.length < 1}
          onClick={create}
        >
          创建镜组
        </button>
      </div>
      <table aria-label="保存的镜组">
        <thead>
          <tr>
            <th>名称</th>
            <th>范围</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((v) => (
            <tr key={v.id}>
              <td>
                <input
                  aria-label={`镜组名称 ${v.id}`}
                  value={v.name}
                  maxLength={120}
                  onChange={(e) =>
                    edit((p) => {
                      ensureWorkspace(p).groups!.find(
                        (x) => x.id === v.id,
                      )!.name = e.target.value || "镜组";
                    })
                  }
                />
              </td>
              <td>
                S{v.start + 1}–S{v.end + 1}
              </td>
              <td>
                <button
                  onClick={() => {
                    setGroup(v.id);
                    onSurface(v.start);
                  }}
                >
                  选择并定位
                </button>
                <button
                  onClick={() =>
                    edit((p) => {
                      ensureWorkspace(p).groups = groups.filter(
                        (x) => x.id !== v.id,
                      );
                    })
                  }
                >
                  解散
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="workflow-actions">
        <label>
          移动镜组
          <select
            aria-label="移动镜组"
            value={g?.id ?? ""}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">选择镜组</option>
            {groups.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <Num
          label="镜组移动距离"
          value={delta}
          step={0.01}
          unit="mm"
          onChange={setDelta}
        />
        <button
          disabled={!g || g.start === 0 || busy}
          onClick={() => void preview()}
        >
          {busy ? "检查连续几何…" : "检查移动候选"}
        </button>
        {busy && (
          <button
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
            }}
          >
            取消移动检查
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {candidate && g && (
        <div className="group-candidate">
          <p>
            几何检查通过：S{g.start + 1}–S{g.end + 1} 移动 {delta} mm。组前间隔{" "}
            {candidate.surfaces[g.start - 1].thickness.toFixed(6)} mm，组后间隔{" "}
            {candidate.surfaces[g.end].thickness.toFixed(6)} mm。
          </p>
          <p>
            这仅确认几何有效，应用后重新计算通光和画质；不表示光学性能达标。
          </p>
          <button
            onClick={() => {
              edit((p) => {
                p.surfaces = candidate.surfaces;
              });
              setCandidate(null);
              onSurface(g.start);
            }}
          >
            应用镜组移动（可撤销）
          </button>
        </div>
      )}
      <p className="hint">
        新增、删除或复制表面会清空编组，避免面号错位；重命名或更改曲率不影响编组范围。命名版本保存当时的镜组定义。
      </p>
    </div>
  );
}
