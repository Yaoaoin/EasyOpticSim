import type { Ray } from "./types";
export function isDrawableRay(ray: Ray, showFailed = true) {
  return (
    ray.stage !== "aiming" &&
    ray.status !== "aiming_failed" &&
    ray.points.length >= 2 &&
    (showFailed || ray.status === "complete") &&
    ray.points.every((p) => p.length === 3 && p.every(Number.isFinite))
  );
}
