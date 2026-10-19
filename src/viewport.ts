export interface View {
  zoom: number;
  x: number;
  y: number;
}
export const initialView: View = { zoom: 1, x: 0, y: 0 };
// Keep the model point under the pointer fixed when changing scale.
export function zoomAt(view: View, factor: number, x: number, y: number): View {
  const zoom = Math.max(0.25, Math.min(16, view.zoom * factor)),
    ratio = zoom / view.zoom;
  return { zoom, x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio };
}
