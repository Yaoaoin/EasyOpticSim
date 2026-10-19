export interface WorkspaceLayout {
  leftHidden: boolean;
  rightHidden: boolean;
  lensShare: number;
}
export const defaultLayout: WorkspaceLayout = {
  leftHidden: false,
  rightHidden: false,
  lensShare: 45,
};
const storageKey = "oos-ui-layout-v1";
export function readLayout(): WorkspaceLayout {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (
      value &&
      typeof value.leftHidden === "boolean" &&
      typeof value.rightHidden === "boolean" &&
      Number.isFinite(value.lensShare) &&
      value.lensShare >= 25 &&
      value.lensShare <= 75
    )
      return value;
  } catch {}
  return { ...defaultLayout };
}
export function saveLayout(value: WorkspaceLayout) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {}
}

// Scroll only this pane. scrollIntoView can move its ancestors as well.
export function revealItem(pane: HTMLElement | null, item: HTMLElement | null) {
  if (!pane || !item) return;
  const bounds = pane.getBoundingClientRect(),
    target = item.getBoundingClientRect();
  if (target.top < bounds.top) pane.scrollTop += target.top - bounds.top;
  else if (target.bottom > bounds.bottom)
    pane.scrollTop += target.bottom - bounds.bottom;
}
