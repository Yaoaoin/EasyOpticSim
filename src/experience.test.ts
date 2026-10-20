import { describe, expect, it } from "vitest";
import {
  experienceStorageKey,
  readExperienceMode,
  saveExperienceMode,
  simpleStepFor,
} from "./experience";

describe("Y1.0 experience mode", () => {
  it("defaults unknown and unavailable storage to simple mode", () => {
    expect(readExperienceMode(null)).toBe("simple");
    expect(readExperienceMode({ getItem: () => "unexpected" })).toBe("simple");
  });
  it("persists professional mode without touching project data", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    saveExperienceMode("pro", storage);
    expect(values.get(experienceStorageKey)).toBe("pro");
    expect(readExperienceMode(storage)).toBe("pro");
  });
  it("maps advanced pages into a safe simple workflow fallback", () => {
    expect(simpleStepFor("geometry").id).toBe("build");
    expect(simpleStepFor("wave").id).toBe("verify");
    expect(simpleStepFor("motion").id).toBe("goal");
  });
});
