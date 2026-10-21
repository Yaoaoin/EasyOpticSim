import { describe, expect, it } from "vitest";
import { evaluateHealth } from "./health";
import type { Analysis, Geometry, Project, Wave } from "./types";

const project = {
  name: "test",
  object_distance: null,
  fields: [0],
  workspace: { optimization: { quality: { max_worst_rms_um: 10 } } },
} as Project;
const geometry = {
  spans: [{ certified: true }],
  diagnostics: [],
} as unknown as Geometry;
const analysis = {
  sampling: 33,
  paraxial: { efl: 50, bfl: 40 },
  fields: [{ polychromatic_rms_um: 8 }],
  spots: [{ failed: 0, blocked_fraction: 0, failures: [] }],
  diagnostics: [],
} as unknown as Analysis;
const wave = { quality: { converged: true } } as Wave;
const checks = [
  {
    name: "efl",
    surface: null,
    actual: 50,
    limit: 50,
    relation: "max" as const,
    passed: true,
  },
];

describe("Y1.2 one-click lens health", () => {
  it("passes a complete trace without inventing manufacturing certification", () => {
    const report = evaluateHealth(project, geometry, analysis, [wave], checks);
    expect(report.overall).toBe("pass");
    expect(report.cards).toHaveLength(5);
    expect(
      report.cards.find((card) => card.id === "mechanics")?.details[0],
    ).toContain("不包含");
  });

  it("blocks export when rays fail and points to the first surface", () => {
    const broken = {
      ...analysis,
      spots: [{ failed: 2, blocked_fraction: 0.4, failures: [{ surface: 3 }] }],
    } as unknown as Analysis;
    const report = evaluateHealth(project, geometry, broken, [wave]);
    expect(report.overall).toBe("fail");
    expect(report.cards.find((card) => card.id === "throughput")).toMatchObject(
      {
        status: "fail",
        action: "surface",
        surface: 3,
      },
    );
    expect(report.cards.find((card) => card.id === "export")?.status).toBe(
      "fail",
    );
  });

  it("keeps an unavailable wave check visible instead of treating it as pass", () => {
    const report = evaluateHealth(project, geometry, analysis, [null]);
    expect(report.overall).toBe("unchecked");
    expect(report.cards.find((card) => card.id === "quality")?.action).toBe(
      "wave",
    );
  });

  it("does not pass an empty or partial result", () => {
    expect(
      evaluateHealth(project, geometry, { ...analysis, fields: [] }, [])
        .overall,
    ).toBe("fail");
    const report = evaluateHealth(
      { ...project, fields: [0, 0.1] },
      geometry,
      analysis,
      [wave],
      checks,
    );
    expect(report.cards.find((c) => c.id === "image")?.status).toBe("fail");
  });

  it("does not equate a computed image with a defined quality goal", () => {
    const report = evaluateHealth(
      { ...project, workspace: undefined },
      geometry,
      analysis,
      [wave],
      checks,
    );
    expect(report.cards.find((c) => c.id === "quality")?.status).toBe(
      "improve",
    );
  });

  it("blocks a failed design constraint despite good image metrics", () => {
    const report = evaluateHealth(
      project,
      geometry,
      analysis,
      [wave],
      [{ ...checks[0], passed: false }],
    );
    expect(report.cards.find((c) => c.id === "export")?.status).toBe("fail");
  });
});
