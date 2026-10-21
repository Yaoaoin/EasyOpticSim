import type {
  Analysis,
  AnalysisPreset,
  Candidate,
  ConstraintCheck,
  Constraints,
  Geometry,
  OptimizationOptions,
  Project,
  Wave,
} from "./types";
import { defaultSetting, fieldWeights, variableValue } from "./optimization";
import { fieldTargets } from "./fields";

export const assistantIntents: Record<AnalysisPreset, string> = {
  balanced: "改善整个画面",
  center: "优先改善中心",
  edge: "优先改善边缘",
};

export function assistantOptions(
  p: Project,
  preset: AnalysisPreset,
): OptimizationOptions {
  // Preserve user locks and bounds whenever an explicit variable configuration exists.
  const existing = p.workspace?.optimization;
  const variables = existing?.variables.length
    ? structuredClone(existing.variables)
    : p.surfaces
        .flatMap((s, surface) =>
          surface !== p.stop && s.curvature !== 0
            ? [defaultSetting(p, { kind: "curvature", surface })]
            : [],
        )
        .slice(0, 5)
        .concat(
          p.surfaces.length
            ? [
                defaultSetting(p, {
                  kind: "thickness",
                  surface: p.surfaces.length - 1,
                }),
              ]
            : [],
        );
  return {
    variables,
    preset,
    staged: true,
    refocus_each_stage: variables.some(
      (v) =>
        !v.locked &&
        v.variable.kind === "thickness" &&
        v.variable.surface === p.surfaces.length - 1,
    ),
    max_iterations: 25,
    quality: {
      ...existing?.quality,
      max_rms_um:
        existing?.quality?.max_rms_um ??
        Array(fieldTargets(p)?.length ?? p.fields.length).fill(null),
      max_degradation_percent: Math.min(
        existing?.quality?.max_degradation_percent ?? 0,
        0,
      ),
    },
  };
}

export function variableProblems(
  source: Project,
  candidate: Project,
  options: OptimizationOptions,
) {
  return options.variables.flatMap((v) => {
    const value = variableValue(candidate, v.variable);
    return value === undefined ||
      !Number.isFinite(value) ||
      (v.locked && value !== variableValue(source, v.variable)) ||
      (v.min !== null && value < v.min) ||
      (v.max !== null && value > v.max)
      ? [`第 ${v.variable.surface + 1} 面的变量越界或违反锁定`]
      : [];
  });
}

export function analysisProblems(p: Project, a: Analysis): string[] {
  const expected = fieldTargets(p)?.length ?? p.fields.length;
  const problems: string[] = [];
  if (
    !expected ||
    a.fields.length !== expected ||
    a.fields.some(
      (f) =>
        f.polychromatic_rms_um === null ||
        !Number.isFinite(f.polychromatic_rms_um),
    )
  )
    problems.push("部分画面位置没有有效结果");
  if (
    a.spots.length !== expected * p.wavelengths.length ||
    a.spots.some(
      (s) =>
        s.sampled <= 0 || s.failed > 0 || !Number.isFinite(s.blocked_fraction),
    )
  )
    problems.push("部分波长或光线追迹未完成");
  if (
    p.field_spec?.mode === "sensor" &&
    (!a.coverage ||
      a.coverage.checkpoints.some((c) => c.status !== "sampled_clear"))
  )
    problems.push("画幅中心、边缘或角落尚未通过覆盖检查");
  return problems;
}

export function verificationProblems(
  p: Project,
  before: Analysis,
  after: Analysis,
  checks: ConstraintCheck[],
) {
  const problems = [
    ...analysisProblems(p, before),
    ...analysisProblems(p, after),
  ];
  if (!checks.length || checks.some((c) => !c.passed))
    problems.push("设计目标或结构约束尚未满足");
  if (before.fields.length !== after.fields.length)
    problems.push("前后检查范围不一致");
  after.fields.forEach((f, i) => {
    const a = before.fields[i]?.polychromatic_rms_um,
      b = f.polychromatic_rms_um;
    if (a != null && b != null && b > a + Math.max(1e-6, a * 1e-5))
      problems.push(`第 ${i + 1} 个画面位置的光点更分散`);
    const limit = p.workspace?.optimization?.quality?.max_rms_um[i];
    const worst = p.workspace?.optimization?.quality?.max_worst_rms_um;
    if (
      b != null &&
      ((limit != null && b > limit) || (worst != null && b > worst))
    )
      problems.push(`第 ${i + 1} 个画面位置未达到画质上限`);
  });
  after.spots.forEach((s, i) => {
    if (s.blocked_fraction > (before.spots[i]?.blocked_fraction ?? 0) + 1e-6)
      problems.push("候选增加了光线遮挡");
    const quality = p.workspace?.optimization?.quality;
    if (
      quality?.min_geometric_fraction != null &&
      1 - s.blocked_fraction < quality.min_geometric_fraction
    )
      problems.push("候选未达到通光比例要求");
    if (
      quality?.max_distortion_percent != null &&
      (s.distortion_percent == null ||
        Math.abs(s.distortion_percent) > quality.max_distortion_percent)
    )
      problems.push("候选未达到畸变要求");
  });
  const color = p.workspace?.optimization?.quality?.max_lateral_color_um;
  if (
    color != null &&
    after.fields.some(
      (f) => f.lateral_color_um == null || f.lateral_color_um > color,
    )
  )
    problems.push("候选未达到彩色边缘偏移要求");
  return [...new Set(problems)];
}

export function weightedRms(a: Analysis, preset: AnalysisPreset) {
  if (!a.fields.length || a.fields.some((f) => f.polychromatic_rms_um == null))
    return Infinity;
  const weights = fieldWeights(
    a.fields.map((f) => f.field),
    preset,
  );
  return Math.sqrt(
    a.fields.reduce(
      (sum, f, i) => sum + weights[i] * f.polychromatic_rms_um! ** 2,
      0,
    ),
  );
}

export interface AssistantResult {
  before: Analysis;
  after: Analysis | null;
  candidate: Candidate | null;
  messages: string[];
  blockers: string[];
}
type Extras = {
  sampling?: number;
  constraints?: Constraints;
  optimization?: OptimizationOptions;
  wave_options?: import("./types").WaveOptions;
};
export type AssistantCompute = <T>(
  operation: string,
  p: Project,
  extras?: Extras,
) => Promise<T>;

export async function runAssistant(
  source: Project,
  preset: AnalysisPreset,
  compute: AssistantCompute,
  signal: AbortSignal,
  progress: (message: string) => void,
): Promise<AssistantResult> {
  const messages: string[] = [];
  const stage = (text: string) => {
    signal.throwIfAborted();
    progress(text);
    messages.push(text);
  };
  if (!source.workspace?.constraints)
    throw Error("请先在拍摄目标中设置设计目标，再运行助手。");
  stage("检查镜片结构与原始画面");
  const geometry = await compute<Geometry>("geometry", source);
  const before = await compute<Analysis>("analyze", source, { sampling: 65 });
  const initial = analysisProblems(source, before);
  if (geometry.diagnostics.length || geometry.spans.some((s) => !s.certified))
    initial.push("镜片存在碰撞或厚度问题，请先打开结构检查");
  if (initial.length)
    return {
      before,
      after: null,
      candidate: null,
      messages,
      blockers: initial,
    };

  const options = assistantOptions(source, preset);
  const extras = {
    constraints: source.workspace.constraints,
    optimization: options,
  };
  const candidates: Candidate[] = [];
  let working = source;
  if (options.refocus_each_stage) {
    stage("先尝试只调整焦点，保留镜片形状");
    try {
      const focus = await compute<Candidate>("autofocus", source, {
        constraints: extras.constraints,
      });
      signal.throwIfAborted();
      // Legacy autofocus returns no design checks: validate explicitly.
      const focusChecks = await compute<ConstraintCheck[]>(
        "checks",
        focus.project,
        { constraints: extras.constraints },
      );
      focus.checks = [...focus.checks, ...focusChecks];
      if (
        focus.accepted &&
        focusChecks.length > 0 &&
        focus.checks.every((c) => c.passed) &&
        !variableProblems(source, focus.project, options).length
      ) {
        working = { ...focus.project, workspace: source.workspace };
        candidates.push(focus);
      } else messages.push("对焦候选未满足目标或变量边界，从原设计继续尝试。");
    } catch (error) {
      signal.throwIfAborted();
      messages.push(
        `对焦未完成，从原设计继续：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else messages.push("像距未列为可调变量，保留焦点位置。");
  if (options.variables.some((v) => !v.locked)) {
    stage("按你的偏好尝试受约束优化，不放宽目标");
    try {
      const optimized = await compute<Candidate>("optimize", working, extras);
      if (
        optimized.accepted &&
        optimized.checks.length &&
        optimized.checks.every((c) => c.passed)
      )
        candidates.push(optimized);
      else messages.push("优化候选未通过原有约束，将复核对焦候选（若有）。");
    } catch (error) {
      signal.throwIfAborted();
      messages.push(
        `优化未完成：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else messages.push("所有变量已锁定，没有允许自动修改的参数。");
  let best: Candidate | null = null;
  let after: Analysis | null = null;
  let score = weightedRms(before, preset);
  const rejected: string[] = [];
  for (const candidate of candidates) {
    stage("用 65×65 光线独立复核候选与全部原始目标");
    const p = { ...candidate.project, workspace: source.workspace };
    const analysis = await compute<Analysis>("analyze", p, { sampling: 65 });
    const checks = await compute<ConstraintCheck[]>("checks", p, {
      constraints: extras.constraints,
    });
    const shape = await compute<Geometry>("geometry", p);
    const blockers = [
      ...verificationProblems(source, before, analysis, checks),
      ...variableProblems(source, p, options),
    ];
    if (shape.diagnostics.length || shape.spans.some((s) => !s.certified))
      blockers.push("候选结构检查未通过");
    const nextScore = weightedRms(analysis, preset);
    if (
      blockers.length ||
      !Number.isFinite(nextScore) ||
      nextScore >= score - 1e-6
    ) {
      rejected.push(...blockers);
      continue;
    }
    stage("复核候选各画面位置的精细衍射计算与收敛状态");
    for (let index = 0; index < analysis.fields.length; index++) {
      try {
        const wave = await compute<Wave>("wave", p, {
          wave_options: {
            field_index: index,
            wavelength_nm: null,
            max_pupil_samples: 128,
            method:
              Math.abs(analysis.fields[index].field) <= 0.15
                ? "fast"
                : "sphere_kirchhoff",
          },
        });
        if (!wave.quality.converged)
          blockers.push(`第 ${index + 1} 个位置的衍射计算尚未收敛`);
      } catch (error) {
        signal.throwIfAborted();
        blockers.push(
          `第 ${index + 1} 个位置的衍射检查未完成：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    signal.throwIfAborted();
    if (blockers.length) {
      rejected.push(...blockers);
      continue;
    }
    score = nextScore;
    after = analysis;
    best = {
      ...candidate,
      project: p,
      sampling: 65,
      checks: [...candidate.checks, ...checks],
      before_rms_um: weightedRms(before, preset),
      after_rms_um: score,
      note: "助手已复核原始目标、结构、逐视场几何画质、遮挡及衍射收敛。改善指标为几何光点 RMS；不代表所有空间频率的 MTF 都改善。",
      // The optimizer's report may start at the focused intermediate prescription.
      // The assistant owns the original-to-final comparison instead.
      report: null,
    };
  }
  return {
    before,
    after,
    candidate: best,
    messages,
    blockers: best
      ? []
      : [
          ...new Set(
            rejected.length
              ? rejected
              : ["没有找到同时改善画面并满足全部目标的候选；原设计保持不变。"],
          ),
        ],
  };
}
