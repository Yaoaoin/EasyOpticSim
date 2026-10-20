import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { runAssistant, type AssistantCompute } from "./assistant";
import { createDesign } from "./starters";

// Opt-in integration test; requires the locally built Rust CLI.
// PowerShell: $env:EOS_ENGINE_TEST="1"; pnpm test
it.skipIf(process.env.EOS_ENGINE_TEST !== "1")(
  "recovers a defocused telephoto through the real Rust engine",
  async () => {
    const p = createDesign({
      starter: "telephoto",
      name: "assistant integration",
      sensor: 0,
      distance: null,
      focal: 400,
      aperture: 16,
    });
    p.surfaces.at(-1)!.thickness += 2;
    const original = JSON.stringify(p);
    const compute: AssistantCompute = async <T>(
      operation: string,
      project: typeof p,
      extras?: object,
    ) => {
      const { workspace: _, ...prescription } = project;
      const text = execFileSync(
        resolve(
          `target/debug/easyopticsim-cli${process.platform === "win32" ? ".exe" : ""}`,
        ),
        ["--request"],
        {
          input: JSON.stringify({
            operation,
            project: prescription,
            ...extras,
          }),
          encoding: "utf8",
          timeout: 90000,
          maxBuffer: 32 * 1024 * 1024,
        },
      );
      return JSON.parse(text) as T;
    };
    const result = await runAssistant(
      p,
      "balanced",
      compute,
      new AbortController().signal,
      () => {},
    );
    expect(JSON.stringify(p)).toBe(original);
    expect(result.before.sampling).toBe(65);
    expect(result.candidate, result.blockers.join("\n")).not.toBeNull();
    expect(result.candidate!.accepted).toBe(true);
    expect(result.candidate!.checks.every((c) => c.passed)).toBe(true);
    expect(result.candidate!.after_rms_um).toBeLessThan(
      result.candidate!.before_rms_um!,
    );
  },
  180000,
);
