import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Aperture,
  ChevronRight,
  Layers3,
  LocateFixed,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { Project } from "./types";
import { lensAt, lenses, templates, type LensKind } from "./lenses";
import { revealItem } from "./workspaceLayout";
import Modal from "./Modal";

export default function StructurePanel({
  project,
  library,
  selected,
  select,
  mode,
  kind,
  setKind,
  addLens,
  addSurface,
  openExample,
  lensShare,
  setLensShare,
  visible,
  resetEpoch,
}: {
  project: Project;
  library: Project[];
  selected: number;
  select: (i: number) => void;
  mode: string;
  kind: LensKind;
  setKind: (v: LensKind) => void;
  addLens: () => void;
  addSurface: () => void;
  openExample: (p: Project) => void;
  lensShare: number;
  setLensShare: (v: number) => void;
  visible: boolean;
  resetEpoch: number;
}) {
  const [query, setQuery] = useState(""),
    [locateEpoch, setLocateEpoch] = useState(0),
    [showExamples, setShowExamples] = useState(false);
  const lensScroll = useRef<HTMLDivElement>(null),
    surfaceScroll = useRef<HTMLDivElement>(null),
    split = useRef<HTMLDivElement>(null);
  const lastSelection = useRef(selected);
  const groups = lenses(project),
    current = lensAt(project, selected);
  const term = query.trim().toLocaleLowerCase();
  const matches = (text: string) => text.toLocaleLowerCase().includes(term);
  const faces = project.surfaces
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) =>
      matches(
        `${s.name} S${s.index + 1} ${project.materials[s.material]?.name ?? ""} ${s.index === project.stop ? "光阑" : ""}`,
      ),
    );
  const filteredGroups = groups.filter(
    (l) =>
      matches(`${l.name} S${l.start + 1}–S${l.end + 1}`) ||
      faces.some((s) => s.index >= l.start && s.index <= l.end),
  );
  useLayoutEffect(() => {
    if (lastSelection.current !== selected) {
      lastSelection.current = selected;
      if (term && !faces.some((s) => s.index === selected)) setQuery("");
    }
  }, [selected]);
  useLayoutEffect(() => {
    if (!visible) return;
    revealItem(
      lensScroll.current,
      lensScroll.current?.querySelector<HTMLElement>("[aria-pressed='true']") ??
        null,
    );
    revealItem(
      surfaceScroll.current,
      surfaceScroll.current?.querySelector<HTMLElement>(
        "[aria-pressed='true']",
      ) ?? null,
    );
  }, [
    selected,
    current?.start,
    project.surfaces.length,
    term,
    visible,
    lensShare,
    locateEpoch,
  ]);
  useLayoutEffect(() => {
    setQuery("");
    setLocateEpoch((v) => v + 1);
  }, [resetEpoch]);
  const navigate = (
    e: KeyboardEvent<HTMLDivElement>,
    indices: number[],
    active = selected,
  ) => {
    if (
      !indices.length ||
      !["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)
    )
      return;
    e.preventDefault();
    const position = indices.indexOf(active);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? indices.length - 1
          : Math.max(
              0,
              Math.min(
                indices.length - 1,
                position + (e.key === "ArrowUp" ? -1 : 1),
              ),
            );
    select(indices[next]);
    e.currentTarget
      .querySelector<HTMLButtonElement>(`[data-surface='${indices[next]}']`)
      ?.focus({ preventScroll: true });
  };
  return (
    <>
      <div className="paneltitle">
        <Layers3 size={15} />
        光学结构
        <span>
          {groups.length} 组 · {project.surfaces.length} 面
        </span>
      </div>
      <div className="structure-search">
        <Search size={14} />
        <input
          aria-label="搜索透镜与表面"
          placeholder="名称、材料或 S12…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
        />
        {query && (
          <button
            aria-label="清除结构搜索"
            title="清除搜索"
            onClick={() => setQuery("")}
          >
            <X size={13} />
          </button>
        )}
        <button
          aria-label="定位当前选择"
          title="清除搜索并定位当前选择"
          onClick={() => {
            setQuery("");
            setLocateEpoch((v) => v + 1);
          }}
        >
          <LocateFixed size={15} />
        </button>
      </div>
      <div
        className="structure-lists"
        ref={split}
        style={{
          gridTemplateRows: `minmax(0, ${lensShare}fr) 8px minmax(0, ${100 - lensShare}fr)`,
        }}
      >
        <section className="structure-section" aria-label="透镜与镜组">
          <div className="structure-section-title">
            <Layers3 size={13} />
            <strong>透镜 / 镜组</strong>
            <span>
              {filteredGroups.length} / {groups.length}
            </span>
          </div>
          <div
            className="tree independent-scroll"
            role="region"
            aria-label="透镜列表"
            tabIndex={0}
            ref={lensScroll}
            onKeyDown={(e) =>
              navigate(
                e,
                filteredGroups.map((l) => l.start),
                current?.start ?? selected,
              )
            }
          >
            {filteredGroups.map((l, i) => (
              <button
                key={l.start}
                title={`${l.name} · S${l.start + 1}–S${l.end + 1}`}
                data-surface={l.start}
                aria-pressed={current?.start === l.start}
                className={
                  current?.start === l.start
                    ? "active lens-group"
                    : "lens-group"
                }
                onClick={() => select(l.start)}
              >
                <Layers3 size={17} />
                <span>
                  <b>{l.name}</b>
                  <small>
                    {l.end - l.start} 片 · S{l.start + 1}–S{l.end + 1}
                  </small>
                </span>
                <em>{groups.indexOf(l) + 1 || i + 1}</em>
              </button>
            ))}
            {!filteredGroups.length && (
              <p className="structure-empty">
                {term ? "没有匹配的透镜" : "添加镜片后显示整组结构"}
              </p>
            )}
          </div>
        </section>
        <div
          className="structure-splitter"
          role="separator"
          tabIndex={0}
          aria-label="调整透镜与表面列表比例"
          aria-orientation="horizontal"
          aria-valuemin={25}
          aria-valuemax={75}
          aria-valuenow={Math.round(lensShare)}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const b = split.current!.getBoundingClientRect();
            setLensShare(
              Math.max(
                25,
                Math.min(75, ((e.clientY - b.top) / b.height) * 100),
              ),
            );
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onKeyDown={(e) => {
            if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              setLensShare(
                e.key === "Home"
                  ? 25
                  : e.key === "End"
                    ? 75
                    : Math.max(
                        25,
                        Math.min(
                          75,
                          lensShare + (e.key === "ArrowUp" ? -5 : 5),
                        ),
                      ),
              );
            }
          }}
        >
          <span />
        </div>
        <section className="structure-section" aria-label="顺序光学表面">
          <div className="structure-section-title">
            <Aperture size={13} />
            <strong>表面</strong>
            <span>
              {faces.length} / {project.surfaces.length}
            </span>
          </div>
          <div
            className="tree independent-scroll"
            role="region"
            aria-label="表面列表"
            tabIndex={0}
            ref={surfaceScroll}
            onKeyDown={(e) =>
              navigate(
                e,
                faces.map((s) => s.index),
              )
            }
          >
            {faces.map((s) => (
              <button
                key={s.index}
                title={`S${s.index + 1} · ${s.name}`}
                data-surface={s.index}
                aria-pressed={selected === s.index}
                className={selected === s.index ? "active" : ""}
                onClick={() => select(s.index)}
              >
                <span className="tree-icon">
                  {s.index === project.stop ? (
                    <Aperture size={17} />
                  ) : (
                    <span className="lens-icon">◖◗</span>
                  )}
                </span>
                <span>
                  <b>{s.name}</b>
                  <small>
                    {s.index === project.stop
                      ? "APERTURE STOP"
                      : (project.materials[s.material]?.name ?? "未知材料")}
                  </small>
                </span>
                <em>S{s.index + 1}</em>
              </button>
            ))}
            {!faces.length && (
              <p className="structure-empty">
                {term ? "没有匹配的表面" : "当前项目为空白处方"}
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="structure-actions">
        <div className="sensor-row">
          <span>▥</span>传感器<small>{project.sensor.join(" × ")} mm</small>
        </div>
        <div className="lens-add">
          <select
            aria-label="镜片类型"
            value={kind}
            onChange={(e) => setKind(e.target.value as LensKind)}
          >
            {Object.entries(templates).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="primary"
            disabled={project.surfaces.length > 96}
            onClick={addLens}
          >
            <Plus size={14} />
            添加镜片
          </button>
        </div>
        <div className="structure-secondary-actions">
          {mode === "pro" && (
            <button
              disabled={project.surfaces.length >= 100}
              onClick={addSurface}
            >
              <Plus size={13} />
              添加表面
            </button>
          )}
          <button onClick={() => setShowExamples(true)}>
            示例与学习
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
      {showExamples && (
        <Modal title="示例与学习" onCancel={() => setShowExamples(false)}>
          <div className="examples">
            {library.map((p, i) => (
              <button
                key={p.name}
                onClick={() => {
                  setShowExamples(false);
                  openExample(p);
                }}
              >
                <span>0{i + 1}</span>
                <div>
                  {p.name.replace(/^\d+\s*·\s*/, "")}
                  <small>
                    {
                      [
                        "观察球差与光圈",
                        "探索材料与色差",
                        "探索镜组组合",
                        "观察对称镜组",
                        "区分有效口径与机械边缘",
                        "传感器联动视场与 400 mm 工作流",
                        "35 mm 全画幅覆盖与离轴衍射验证",
                      ][i]
                    }
                  </small>
                </div>
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
          <div className="lesson">
            <span>OPTICS NOTE / 01</span>
            <h3>光线如何变成画面？</h3>
            <p>
              从单透镜开始，缩小光圈，然后点击自动对焦。观察点列图如何收拢。
            </p>
            <p className="muted">示例是原创教学处方，尚未优化为商用镜头。</p>
          </div>
        </Modal>
      )}
    </>
  );
}
