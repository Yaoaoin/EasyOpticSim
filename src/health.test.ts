import { describe, expect, it } from "vitest";
import { evaluateHealth } from "./health";
import type { Analysis, Geometry, Project, Wave } from "./types";

const project = {
  name: "test",
  object_distance: null,
  workspace: {},
} as Project;
const geometry = { spans: [{ certified: true }], diagnostics: [] } as unknown as Geometry;
const analysis = {
  sampling: 33,
  paraxial: { efl: 50, bfl: 40 },
  fields: [{ polychromatic_rms_um: 8 }],
  spots: [{ failed: 0, blocked_fraction: 0, failures: [] }],
  diagnostics: [],
} as unknown as Analysis;
const wave = { quality: { converged: true } } as Wave;

describe("Y1.1 one-click lens health", () => {
  it("passes a complete trace without inventing manufacturing certification", () => {
    const report = evaluateHealth(project, geometry, analysis, [wave]);
    expect(report.overall).toBe("pass");
    expect(report.cards).toHaveLength(5);
    expect(report.cards.find((card) => card.id === "mechanics")?.details[0]).toContain("不包含");
  });

  it("blocks export when rays fail and points to the first surface", () => {
    const broken = {
      ...analysis,
      spots: [{ failed: 2, blocked_fraction: 0.4, failures: [{ surface: 3 }] }],
    } as unknown as Analysis;
    const report = evaluateHealth(project, geometry, broken, [wave]);
    expect(report.overall).toBe("fail");
    expect(report.cards.find((card) => card.id === "throughput")).toMatchObject({
      status: "fail",
      action: "surface",
      surface: 3,
    });
    expect(report.cards.find((card) => card.id === "export")?.status).toBe("fail");
  });

  it("keeps an unavailable wave check visible instead of treating it as pass", () => {
    const report = evaluateHealth(project, geometry, analysis, [null]);
    expect(report.overall).toBe("improve");
    expect(report.cards.find((card) => card.id === "quality")?.action).toBe("wave");
  });
});
