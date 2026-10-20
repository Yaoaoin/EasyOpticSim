export type ExperienceMode = "simple" | "pro";

export const experienceStorageKey = "easyopticsim-experience-mode";
export const legacyExperienceStorageKey = "oos-y1-experience-mode";
export const tourStorageKey = "easyopticsim-y1.1-tour-complete";

export function readExperienceMode(
  storage: Pick<Storage, "getItem"> | null =
    typeof localStorage === "undefined" ? null : localStorage,
): ExperienceMode {
  try {
    return (storage?.getItem(experienceStorageKey) ?? storage?.getItem(legacyExperienceStorageKey)) === "pro" ? "pro" : "simple";
  } catch {
    return "simple";
  }
}

export function shouldShowTour(storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage) {
  try {
    return storage?.getItem(tourStorageKey) !== "done";
  } catch {
    return true;
  }
}

export function completeTour(storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage) {
  try {
    storage?.setItem(tourStorageKey, "done");
  } catch {}
}

export function saveExperienceMode(
  mode: ExperienceMode,
  storage: Pick<Storage, "setItem"> | null =
    typeof localStorage === "undefined" ? null : localStorage,
) {
  try {
    storage?.setItem(experienceStorageKey, mode);
  } catch {
    // Private browsing and locked-down WebViews may reject local storage.
  }
}

export const simpleSteps = [
  { id: "goal", label: "告诉我想拍什么", tabs: ["goals"] },
  { id: "build", label: "搭建镜头", tabs: ["prescription", "geometry"] },
  { id: "improve", label: "让画面更好", tabs: ["spots", "focus", "optimization"] },
  { id: "verify", label: "检查与保存", tabs: ["health", "aberration", "wave", "drawing", "versions"] },
] as const;

export function simpleStepFor(tab: string) {
  return simpleSteps.find((step) => step.tabs.includes(tab as never)) ?? simpleSteps[0];
}
