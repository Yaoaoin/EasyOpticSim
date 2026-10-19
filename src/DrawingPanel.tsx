import { useEffect, useRef, useState } from "react";
import { FileDown, CircleHelp } from "lucide-react";
import type {
  Analysis,
  FieldPlan,
  Geometry,
  Project,
  Wave,
  WaveOptions,
} from "./types";
import { compute, exportPdf } from "./engine";
import {
  drawingGeometry,
  drawingStatus,
  sha256,
  type DrawingSnapshot,
} from "./drawing";
import { explainError } from "./errors";
import fontUrl from "./assets/fonts/NotoSansSC.ttf?url";
export default function DrawingPanel({
  project,
  onHelp,
}: {
  project: Project;
  onHelp: () => void;
}) {
  const [includeWave, setIncludeWave] = useState(false),
    [method, setMethod] = useState<WaveOptions["method"]>("sphere_kirchhoff"),
    [status, setStatus] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const ctrl = useRef<AbortController | null>(null),
    worker = useRef<Worker | null>(null);
  useEffect(
    () => () => {
      ctrl.current?.abort();
      worker.current?.terminate();
    },
    [],
  );
  // Editing or leaving this panel invalidates its in-flight snapshot before saving.
  useEffect(() => {
    ctrl.current?.abort();
    worker.current?.terminate();
    setWorking(false);
    setStatus("");
  }, [project]);
  const g = drawingGeometry(project),
    viewWidth = Math.max(1, g.maxZ - g.minZ),
    vheight = Math.max(2, 2 * g.radius);
  async function build() {
    const c = new AbortController();
    ctrl.current = c;
    setWorking(true);
    setError("");
    const frozen = structuredClone(project),
      source = JSON.stringify(frozen, null, 2);
    const snapshot: DrawingSnapshot = {
      project: frozen,
      createdAt: new Date().toISOString(),
      analysis: null,
      geometry: null,
      fields: null,
      waves: [],
      errors: [],
      sampling: 33,
      waveMethod: method,
      sourceHash: "",
    };
    try {
      snapshot.sourceHash = await sha256(source);
      async function get<T>(operation: string) {
        try {
          return await compute<T>(
            crypto.randomUUID(),
            operation,
            frozen,
            c.signal,
            { sampling: 33 },
          );
        } catch (e) {
          if (c.signal.aborted) throw e;
          snapshot.errors.push(`${operation}: ${explainError(e)}`);
          return null;
        }
      }
      setStatus("冻结当前处方，重新检查几何与实际视场…");
      snapshot.geometry = await get<Geometry>("geometry");
      snapshot.fields = await get<FieldPlan>("field_plan");
      setStatus("按当前共同像面进行 33 × 33 几何分析，不自动重新对焦…");
      snapshot.analysis = await get<Analysis>("analyze");
      if (includeWave)
        for (let i = 0; i < frozen.fields.length; i++) {
          setStatus(
            `计算多色 PSF / MTF：视场 ${i + 1} / ${frozen.fields.length}…`,
          );
          try {
            const result = await compute<Wave>(
              crypto.randomUUID(),
              "wave",
              frozen,
              c.signal,
              {
                wave_options: {
                  method,
                  field_index: i,
                  wavelength_nm: null,
                  max_pupil_samples: 256,
                },
              },
            );
            snapshot.waves.push({ index: i, result, error: null });
          } catch (e) {
            if (c.signal.aborted) throw e;
            snapshot.waves.push({
              index: i,
              result: null,
              error: explainError(e),
            });
          }
        }
      if (c.signal.aborted) return;
      setStatus("生成分页图纸、参数表和内嵌源项目…");
      const fontResponse = await fetch(fontUrl, { signal: c.signal });
      if (!fontResponse.ok)
        throw Error("未能载入内置中文字体，请重新安装软件后再导出。");
      const font = new Uint8Array(await fontResponse.arrayBuffer());
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        const w = new Worker(new URL("./drawingWorker.ts", import.meta.url), {
          type: "module",
        });
        worker.current = w;
        c.signal.addEventListener(
          "abort",
          () => {
            w.terminate();
            reject(new DOMException("Cancelled", "AbortError"));
          },
          { once: true },
        );
        w.onerror = (e) => {
          w.terminate();
          reject(Error(e.message));
        };
        w.onmessage = (e) => {
          w.terminate();
          e.data.error ? reject(Error(e.data.error)) : resolve(e.data.bytes);
        };
        w.postMessage({ snapshot, font }, { transfer: [font.buffer] });
      });
      if (c.signal.aborted) return;
      setStatus("图纸已生成，请选择 PDF 保存位置…");
      const saved = await exportPdf(`${frozen.name}-技术图纸.pdf`, bytes);
      if (!c.signal.aborted)
        setStatus(
          saved
            ? `PDF 已保存。${drawingStatus(snapshot).includes("草稿") ? "包含草稿诊断，请查看检查页。" : "包含完整处方、图纸与计算条件。"}${snapshot.waves.some((w) => w.error) ? "部分衍射分析未完成，原因已写入图纸。" : ""}`
            : "已取消保存；项目保持不变。",
        );
    } catch (e) {
      if (!c.signal.aborted) setError(explainError(e));
    } finally {
      if (ctrl.current === c) setWorking(false);
    }
  }
  return (
    <div className="workflow-panel drawing-panel">
      <h2>技术图纸导出</h2>
      <p>
        将当前设计整理为可检索的
        PDF：矢量剖面、名义尺寸和完整参数，附原生项目与本次计算摘要。全部在本地完成。
      </p>
      <div className="drawing-preview">
        <h3>{project.name}</h3>
        <p>
          {project.surfaces.length} 面 · 传感器 {project.sensor.join(" × ")} mm
          · 首顶点至像面 {g.imageZ.toFixed(3)} mm
        </p>
        <svg
          viewBox={`${g.minZ - viewWidth * 0.05} ${-vheight * 0.6} ${viewWidth * 1.1} ${vheight * 1.2}`}
          role="img"
          aria-label="技术图纸剖面预览"
          preserveAspectRatio="xMidYMid meet"
        >
          <line
            x1={g.minZ - viewWidth * 0.05}
            x2={g.maxZ + viewWidth * 0.05}
            y1={0}
            y2={0}
            stroke="#9aaab1"
            vectorEffect="non-scaling-stroke"
          />
          {g.paths.map((a) => (
            <polyline
              key={a.index}
              points={a.points.map((q) => q.join(",")).join(" ")}
              fill="none"
              stroke="#245d66"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1={g.imageZ}
            x2={g.imageZ}
            y1={-Math.min(g.radius, project.sensor[1] / 2)}
            y2={Math.min(g.radius, project.sensor[1] / 2)}
            stroke="#ad7329"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="drawing-checklist">
        {[
          "总剖面及逐镜片 / 胶合组分图",
          "全部表面处方、顶点坐标与机械外径",
          "圆锥常数、A4-A10 与材料色散系数",
          "视场、波长、覆盖、几何与通光检查",
          "目标、优化设置、镜组与版本摘要",
          "精确原生项目附件与来源 SHA-256",
        ].map((t) => (
          <span key={t}>✓ {t}</span>
        ))}
      </div>
      <div className="drawing-options">
        <label>
          <input
            type="checkbox"
            checked={includeWave}
            disabled={working}
            onChange={(e) => setIncludeWave(e.target.checked)}
          />
          加入逐视场多色 PSF / MTF（较慢）
        </label>
        {includeWave && (
          <label>
            图纸衍射模型
            <select
              aria-label="图纸衍射模型"
              value={method}
              disabled={working}
              onChange={(e) =>
                setMethod(e.target.value as WaveOptions["method"])
              }
            >
              <option value="fast">快速 · 小视场</option>
              <option value="sphere_kirchhoff">
                直接 Kirchhoff · 离轴平面像面
              </option>
            </select>
          </label>
        )}
      </div>
      <p>
        导出重新计算当前处方，固定当前像面，几何采样 33 × 33；衍射上限
        256。未完成的分析会明确记录原因，几何问题会标记为设计草稿。图纸不补造加工公差、镀膜或装配要求。
      </p>
      <div className="workflow-actions">
        <button
          className="primary"
          disabled={working || !project.surfaces.length}
          onClick={() => void build()}
        >
          <FileDown size={16} />
          {working ? "正在生成图纸…" : "导出技术图纸 PDF"}
        </button>
        {working && (
          <button
            onClick={() => {
              ctrl.current?.abort();
              worker.current?.terminate();
              setWorking(false);
              setStatus("已取消图纸导出；项目保持不变。");
            }}
          >
            取消导出
          </button>
        )}
        <button onClick={onHelp}>
          <CircleHelp size={15} />
          图纸说明
        </button>
      </div>
      {status && (
        <p className="drawing-status" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
