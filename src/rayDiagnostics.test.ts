import { describe, it, expect } from "vitest";
import { diagnostic, explainError, rayFailureText } from "./errors";
import { isDrawableRay } from "./rayDisplay";
import type { Ray } from "./types";
import repairedFile from "../examples/400mm-repaired.oos.json";
import { fromCsv, projectFromJson, toCsv } from "./project";
describe("0.7 ray diagnosis", () => {
  it("reopens the repaired telephoto with its original version, materials and optimization settings", () => {
    const p = projectFromJson(JSON.stringify(repairedFile));
    expect(projectFromJson(JSON.stringify(p))).toEqual(p);
    expect(fromCsv(toCsv(p))).toEqual(p);
    expect(p.surfaces).toHaveLength(34);
    expect(p.workspace?.versions).toHaveLength(2);
    expect(p.workspace?.versions[0].prescription.materials).toEqual(
      p.materials,
    );
    expect(p.workspace?.optimization?.variables).toHaveLength(1);
    expect(p.workspace?.constraints?.target_efl_mm).toBe(400);
    expect(p.surfaces.at(-1)!.thickness).toBeCloseTo(388.7863114888424, 10);
  });
  it("never draws aiming trial paths, including malformed legacy failure payloads", () => {
    const ray: Ray = {
      points: [
        [0, 0, -0.5],
        [0, 61, 10],
      ],
      status: "aiming_failed",
      stage: "aiming",
      surface: 14,
      wavelength_nm: 587.5618,
    };
    expect(isDrawableRay(ray)).toBe(false);
    expect(isDrawableRay({ ...ray, status: "missed" })).toBe(false);
    expect(isDrawableRay({ ...ray, stage: "trace", status: "blocked" })).toBe(
      true,
    );
    expect(
      isDrawableRay({ ...ray, stage: "trace", status: "blocked" }, false),
    ).toBe(false);
    expect(
      isDrawableRay({ ...ray, stage: "trace", status: "complete" }, false),
    ).toBe(true);
    expect(
      isDrawableRay({
        ...ray,
        stage: "trace",
        status: "complete",
        points: [
          [NaN, 0, 0],
          [0, 0, 1],
        ],
      }),
    ).toBe(false);
  });
  it("renders a virtual focus as an optical configuration problem", () => {
    const text = explainError(
      JSON.stringify({ code: "virtual_image", bfl_mm: -42.8819488822 }),
    );
    expect(text).toContain("-42.8819");
    expect(text).toContain("曲率或镜组间隔");
    expect(text).not.toContain("缩小光阑");
    expect(diagnostic("VirtualImage|-42.881949")).toContain("前方");
  });
  it("keeps real aperture clipping distinct from unresolved shooting", () => {
    expect(rayFailureText("blocked")).toContain("口径遮挡");
    expect(rayFailureText("aiming_failed", "target_unresolved")).toContain(
      "不等同",
    );
    expect(diagnostic("AimingFailed|folded_mapping")).toContain("分支翻转");
    expect(
      explainError(
        JSON.stringify({
          code: "ray_failure",
          stage: "aiming",
          status: "aiming_failed",
          surface: 14,
          wavelength_nm: 587.5618,
          reason: "chief_unresolved",
        }),
      ),
    ).toContain("S15 光阑瞄准");
  });
  it("shows per-field, per-band counts and actual physical termination surfaces", () => {
    const text = explainError(
      JSON.stringify({
        code: "ray_failures",
        failures: [
          {
            field_rad: 0.07,
            wavelength_nm: 486.1327,
            failed: 12,
            sampled: 49,
            causes: [
              {
                stage: "trace",
                status: "blocked",
                surface: 28,
                reason: null,
                count: 12,
              },
            ],
          },
        ],
      }),
    );
    expect(text).toContain("4.01° / 486.1 nm");
    expect(text).toContain("S29 物理追迹，12 条");
    expect(text).toContain("口径遮挡");
  });
});
