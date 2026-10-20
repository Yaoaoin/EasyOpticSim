import type {
  Analysis,
  ConstraintCheck,
  Geometry,
  Project,
  Wave,
} from "./types";
import { fieldTargets } from "./fields";

export type HealthStatus = "pass" | "improve" | "fail" | "unchecked";
export type HealthAction =
  | "autofocus"
  | "surface"
  | "aperture"
  | "optimization"
  | "goals"
  | "wave"
  | "save";

export interface HealthCard {
  id: "image" | "throughput" | "quality" | "mechanics" | "export";
  title: string;
  status: HealthStatus;
  summary: string;
  details: string[];
  action?: HealthAction;
  surface?: number | null;
}

export interface HealthReport {
  format: "EasyOpticSim lens health v1";
  project: string;
  sampling: number;
  cards: HealthCard[];
  overall: Exclude<HealthStatus, "unchecked"> | "unchecked";
  completed: number;
}

const failedRays = (analysis: Analysis) =>
  analysis.spots.reduce((sum, spot) => sum + spot.failed, 0);
const worstBlocked = (analysis: Analysis) =>
  Math.max(0, ...analysis.spots.map((spot) => spot.blocked_fraction));
const validRms = (analysis: Analysis) =>
  analysis.fields
    .map((field) => field.polychromatic_rms_um)
    .filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );

export function evaluateHealth(
  project: Project,
  geometry: Geometry,
  analysis: Analysis,
  waves: (Wave | null)[],
  checks: ConstraintCheck[] = [],
): HealthReport {
  const rms = validRms(analysis);
  const hasImage =
    analysis.paraxial.efl !== null &&
    (project.object_distance !== null || (analysis.paraxial.bfl ?? 0) > 0) &&
    analysis.fields.length > 0 &&
    analysis.fields.length ===
      (fieldTargets(project)?.length ?? project.fields.length) &&
    rms.length === analysis.fields.length;
  const image: HealthCard = hasImage
    ? {
        id: "image",
        title: "能否成像",
        status: "pass",
        summary: "所有检查视场都得到有效像点",
        details: [`有效焦距 ${analysis.paraxial.efl!.toFixed(2)} mm`],
      }
    : {
        id: "image",
        title: "能否成像",
        status: "fail",
        summary: "焦点或部分视场尚未得到有效结果",
        details: analysis.diagnostics.map((item) => item.message).slice(0, 3),
        action: "autofocus",
      };

  const failed = failedRays(analysis),
    blocked = worstBlocked(analysis),
    firstRaySurface =
      analysis.spots
        .flatMap((spot) => spot.failures ?? [])
        .find((failure) => failure.surface !== null)?.surface ?? null;
  const throughput: HealthCard =
    failed > 0 || blocked >= 0.35
      ? {
          id: "throughput",
          title: "是否通光",
          status: "fail",
          summary: `${failed} 条追迹失败，最差遮挡 ${(blocked * 100).toFixed(0)}%`,
          details: ["先定位首个问题面，再检查有效口径和光阑。"],
          action: firstRaySurface === null ? "aperture" : "surface",
          surface: firstRaySurface,
        }
      : blocked > 0.02
        ? {
            id: "throughput",
            title: "是否通光",
            status: "improve",
            summary: `可以成像，但最差遮挡 ${(blocked * 100).toFixed(0)}%`,
            details: ["边缘画面可能损失通光；建议复核光圈与镜片口径。"],
            action: "aperture",
          }
        : {
            id: "throughput",
            title: "是否通光",
            status: "pass",
            summary: "当前采样未发现明显遮挡或追迹失败",
            details: ["通光比例不是相对照度或杂散光认证。"],
          };

  const geometryFailures = geometry.spans.filter((span) => !span.certified);
  const firstGeometrySurface =
    geometry.diagnostics.find((item) => item.surface !== null)?.surface ??
    geometryFailures[0]?.front ??
    null;
  const mechanics: HealthCard =
    geometry.diagnostics.length || geometryFailures.length
      ? {
          id: "mechanics",
          title: "机械结构是否可实现",
          status: "fail",
          summary: `${geometryFailures.length + geometry.diagnostics.length} 项几何问题需要修复`,
          details: geometry.diagnostics.map((item) => item.message).slice(0, 3),
          action: "surface",
          surface: firstGeometrySurface,
        }
      : {
          id: "mechanics",
          title: "机械结构是否可实现",
          status: "pass",
          summary: "曲面与相邻区域的连续分离检查通过",
          details: ["这不包含加工公差、强度、倒角或装配认证。"],
        };

  const target = project.workspace?.optimization?.quality?.max_worst_rms_um;
  const worstRms = rms.length ? Math.max(...rms) : null;
  const waveFailed = waves.some((wave) => wave && !wave.quality.converged);
  const waveMissing =
    waves.length !== analysis.fields.length ||
    waves.some((wave) => wave === null);
  const quality: HealthCard =
    worstRms === null || rms.length !== analysis.fields.length
      ? {
          id: "quality",
          title: "画质是否达到目标",
          status: "fail",
          summary: "没有完整的逐视场画质结果",
          details: ["先解决成像与通光问题，再进行画质判断。"],
          action: "autofocus",
        }
      : (target !== undefined && target !== null && worstRms > target) ||
          waveFailed
        ? {
            id: "quality",
            title: "画质是否达到目标",
            status: "fail",
            summary: `最差几何 RMS ${worstRms.toFixed(2)} µm${target ? `，目标 ≤ ${target.toFixed(2)} µm` : ""}`,
            details: [
              waveFailed
                ? "快速 PSF / MTF 收敛检查未通过。"
                : "设计目标尚未满足。",
            ],
            action: "optimization",
          }
        : waveMissing
          ? {
              id: "quality",
              title: "画质是否达到目标",
              status: "unchecked",
              summary: "精细画质检查尚未完整完成",
              details: [
                `已算出的最差几何 RMS ${worstRms.toFixed(2)} µm；不能据此认定完整画质通过。`,
              ],
              action: "wave",
            }
          : target == null
            ? {
                id: "quality",
                title: "画质是否达到目标",
                status: "improve",
                summary: `最差几何 RMS ${worstRms.toFixed(2)} µm`,
                details: ["未设置明确画质上限；已完成计算不等于达到画质目标。"],
                action: "optimization",
              }
            : {
                id: "quality",
                title: "画质是否达到目标",
                status: "pass",
                summary: `最差几何 RMS ${worstRms.toFixed(2)} µm，快速衍射检查已完成`,
                details: ["结果仅适用于当前视场、波长、采样和模型范围。"],
              };

  if (
    project.field_spec?.mode === "sensor" &&
    (!analysis.coverage ||
      analysis.coverage.checkpoints.some((c) => c.status !== "sampled_clear"))
  ) {
    throughput.status = "fail";
    throughput.summary = "画幅覆盖未完全通过，请检查边缘与角落";
    throughput.action = "aperture";
  }
  const failedChecks = checks.filter((c) => !c.passed);
  const blocking =
    failedChecks.length > 0 ||
    [image, throughput, mechanics, quality].some(
      (card) => card.status === "fail",
    );
  const exportCard: HealthCard = blocking
    ? {
        id: "export",
        title: "是否适合导出",
        status: "fail",
        summary: "存在阻断性问题，建议修复后再作为正式结果导出",
        details: [
          `${failedChecks.length} 项设计约束未通过。仍可导出草稿，但必须保留失败说明。`,
        ],
        action: "save",
      }
    : waveMissing || !checks.length
      ? {
          id: "export",
          title: "是否适合导出",
          status: "unchecked",
          summary: "部分检查未完成，只能作为待验证结果保存",
          details: ["保留未完成说明，不将其标为正式通过。"],
          action: "save",
        }
      : {
          id: "export",
          title: "是否适合导出",
          status: "pass",
          summary: "可以保存项目并导出带检查边界的报告",
          details: ["通过不等于制造、公差或真实相机系统认证。"],
          action: "save",
        };
  const cards = [image, throughput, quality, mechanics, exportCard];
  const overall = cards.some((card) => card.status === "fail")
    ? "fail"
    : cards.some((card) => card.status === "improve")
      ? "improve"
      : cards.some((card) => card.status === "unchecked")
        ? "unchecked"
        : "pass";
  return {
    format: "EasyOpticSim lens health v1",
    project: project.name,
    sampling: analysis.sampling,
    cards,
    overall,
    completed: cards.filter((card) => card.status !== "unchecked").length,
  };
}
