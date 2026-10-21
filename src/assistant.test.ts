import { describe, it, expect } from "vitest";
import {
  assistantOptions,
  runAssistant,
  variableProblems,
  verificationProblems,
  type AssistantCompute,
} from "./assistant";
import { createDesign, starters, type StarterId } from "./starters";
import { projectFromJson } from "./project";
import type {
  Analysis,
  Candidate,
  ConstraintCheck,
  Geometry,
  Project,
  Wave,
} from "./types";

const base = () => {
  const p = createDesign({
    starter: "portrait",
    name: "test",
    sensor: 0,
    distance: null,
    focal: 66,
    aperture: 6.6,
  });
  delete p.field_spec;
  p.fields = [0, 0.1];
  p.wavelengths = [{ nm: 587.6, weight: 1 }];
  return p;
};
const check: ConstraintCheck = {
  name: "efl_error_mm",
  actual: 0,
  limit: 1,
  passed: true,
  surface: null,
  relation: "max",
};
const analysis = (values = [10, 20]): Analysis =>
  ({
    fields: values.map((rms, i) => ({
      field: i * 0.1,
      polychromatic_rms_um: rms,
    })),
    spots: values.map((_, i) => ({
      field: i * 0.1,
      failed: 0,
      sampled: 100,
      blocked_fraction: 0,
    })),
    sampling: 65,
  }) as Analysis;
const geometry = {
  spans: [{ certified: true }],
  diagnostics: [],
} as unknown as Geometry;

function fakeEngine(
  p: Project,
  opts: {
    wave?: boolean;
    blocked?: boolean;
    reject?: boolean;
    cancel?: AbortController;
  } = {},
) {
  const operations: string[] = [];
  let analyses = 0;
  const compute: AssistantCompute = async <T>(
    operation: string,
    project: Project,
  ) => {
    operations.push(operation);
    let result: unknown;
    if (operation === "geometry")
      result = opts.blocked
        ? { spans: [{ certified: false }], diagnostics: [] }
        : geometry;
    if (operation === "analyze")
      result = analysis(analyses++ ? [8, 18] : [10, 20]);
    if (operation === "checks") result = [check];
    if (operation === "wave")
      result = { quality: { converged: opts.wave !== false } } as Wave;
    if (operation === "autofocus" || operation === "optimize") {
      const candidate = structuredClone(project);
      candidate.surfaces.at(-1)!.thickness += 0.1;
      result = {
        project: candidate,
        checks: [check],
        accepted: !opts.reject,
        before_rms_um: 15,
        after_rms_um: 12,
        iterations: 1,
        sampling: 33,
        note: "",
      } as Candidate;
      opts.cancel?.abort();
    }
    return result as T;
  };
  return { compute, operations, original: JSON.stringify(p) };
}
describe("guided designs", () => {
  it("binds every purpose to a stable template and preserves material and spectral data", () => {
    for (const id of Object.keys(starters) as StarterId[]) {
      const p = createDesign({
        starter: id,
        name: "new",
        sensor: 1,
        distance: null,
        focal: starters[id].focal,
        aperture: starters[id].aperture,
      });
      expect(p.materials).toEqual(starters[id].source.materials);
      expect(p.wavelengths).toEqual(starters[id].source.wavelengths);
      expect(p.workspace!.versions).toEqual([]);
      expect(p.sensor).toEqual([23.6, 15.7]);
      expect(projectFromJson(JSON.stringify(p)).field_spec).toEqual({
        mode: "sensor",
      });
    }
  });
  it("rejects invalid user input rather than producing invalid prescriptions", () => {
    expect(() =>
      createDesign({
        starter: "portrait",
        name: "x",
        sensor: 0,
        distance: -1,
        focal: NaN,
        aperture: 2,
      }),
    ).toThrow();
  });
});
describe("design assistant verification", () => {
  it("preserves locks, bounds and quality limits", () => {
    const p = base();
    p.workspace!.optimization = {
      ...assistantOptions(p, "balanced"),
      variables: [
        {
          variable: { surface: 1, kind: "curvature" },
          min: 0,
          max: 0.1,
          locked: true,
        },
      ],
      quality: {
        max_rms_um: [15, 25],
        max_degradation_percent: 20,
        max_distortion_percent: 2,
      },
    };
    const options = assistantOptions(p, "edge");
    expect(options.variables).toEqual(p.workspace!.optimization.variables);
    expect(options.quality).toMatchObject({
      max_rms_um: [15, 25],
      max_distortion_percent: 2,
      max_degradation_percent: 0,
    });
  });
  it("rejects a worse edge even when the center improves", () => {
    expect(
      verificationProblems(base(), analysis(), analysis([5, 21]), [check]),
    ).toContain("第 2 个画面位置的光点更分散");
  });
  it("never moves a locked image plane, including automatic refocus", async () => {
    const p = base();
    p.workspace!.optimization = {
      ...assistantOptions(p, "balanced"),
      variables: [
        {
          variable: { kind: "thickness", surface: p.surfaces.length - 1 },
          locked: true,
          min: 1,
          max: 1000,
        },
      ],
    };
    const options = assistantOptions(p, "balanced"),
      changed = structuredClone(p);
    changed.surfaces.at(-1)!.thickness++;
    expect(options.refocus_each_stage).toBe(false);
    expect(variableProblems(p, changed, options)).toHaveLength(1);
    const fake = fakeEngine(p);
    await runAssistant(
      p,
      "balanced",
      fake.compute,
      new AbortController().signal,
      () => {},
    );
    expect(fake.operations).not.toContain("autofocus");
    expect(fake.operations).not.toContain("optimize");
  });
  it("rejects incomplete results and missing constraint evidence", () => {
    expect(
      verificationProblems(base(), analysis(), analysis([5]), []),
    ).toContain("部分画面位置没有有效结果");
    expect(verificationProblems(base(), analysis(), analysis(), [])).toContain(
      "设计目标或结构约束尚未满足",
    );
  });
  it("does not bypass user quality ceilings through autofocus", () => {
    const p = base();
    p.workspace!.optimization = {
      ...assistantOptions(p, "balanced"),
      quality: { max_rms_um: [3, 3] },
    };
    expect(
      verificationProblems(p, analysis(), analysis([8, 18]), [check]),
    ).toContain("第 1 个画面位置未达到画质上限");
  });
  it("returns a verified candidate without mutating the current design", async () => {
    const p = base(),
      fake = fakeEngine(p);
    const result = await runAssistant(
      p,
      "balanced",
      fake.compute,
      new AbortController().signal,
      () => {},
    );
    expect(result.candidate?.sampling).toBe(65);
    expect(result.before.fields[0].polychromatic_rms_um).toBe(10);
    expect(result.after?.fields[0].polychromatic_rms_um).toBe(8);
    expect(fake.operations.filter((op) => op === "wave")).toHaveLength(2);
    expect(JSON.stringify(p)).toBe(fake.original);
  });
  it("does not optimize a colliding design", async () => {
    const p = base(),
      fake = fakeEngine(p, { blocked: true });
    const result = await runAssistant(
      p,
      "balanced",
      fake.compute,
      new AbortController().signal,
      () => {},
    );
    expect(result.candidate).toBeNull();
    expect(fake.operations).not.toContain("optimize");
  });
  it("never accepts unconverged diffraction", async () => {
    const p = base(),
      fake = fakeEngine(p, { wave: false });
    const result = await runAssistant(
      p,
      "balanced",
      fake.compute,
      new AbortController().signal,
      () => {},
    );
    expect(result.candidate).toBeNull();
    expect(result.blockers.join(" ")).toContain("尚未收敛");
  });
  it("does not revive engine-rejected candidates", async () => {
    const p = base(),
      fake = fakeEngine(p, { reject: true });
    const result = await runAssistant(
      p,
      "balanced",
      fake.compute,
      new AbortController().signal,
      () => {},
    );
    expect(result.candidate).toBeNull();
  });
  it("stops after cancellation before attempting another operation", async () => {
    const c = new AbortController(),
      p = base(),
      fake = fakeEngine(p, { cancel: c });
    await expect(
      runAssistant(p, "balanced", fake.compute, c.signal, () => {}),
    ).rejects.toThrow();
    expect(fake.operations).not.toContain("optimize");
  });
});
