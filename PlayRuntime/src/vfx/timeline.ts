import { applyEase } from "./easing";
import type {
  NumericValue,
  ResolvedParameters,
  TrackDefinition
} from "./types";

function resolveNumericValue(
  value: NumericValue,
  params: ResolvedParameters
): number {
  if (typeof value === "number") {
    return value;
  }

  const resolved = params[value.param];
  if (typeof resolved !== "number") {
    throw new Error(`Parameter "${value.param}" must resolve to a number.`);
  }
  return resolved;
}

export function evaluateTrack(
  track: TrackDefinition,
  progress: number,
  params: ResolvedParameters
): number {
  if (!Number.isFinite(progress)) {
    throw new Error(`Track progress must be finite; received ${progress}.`);
  }

  const t = Math.min(1, Math.max(0, progress));
  const first = track.keys[0];
  if (!first) {
    throw new Error(`Track "${track.property}" has no keyframes.`);
  }
  if (t <= first.t) {
    return resolveNumericValue(first.value, params);
  }

  for (let index = 1; index < track.keys.length; index += 1) {
    const current = track.keys[index];
    const previous = track.keys[index - 1];
    if (t > current.t) {
      continue;
    }

    const segmentProgress = (t - previous.t) / (current.t - previous.t);
    const easedProgress = applyEase(current.ease ?? "linear", segmentProgress);
    const startValue = resolveNumericValue(previous.value, params);
    const endValue = resolveNumericValue(current.value, params);
    return startValue + (endValue - startValue) * easedProgress;
  }

  const last = track.keys.at(-1);
  if (!last) {
    throw new Error(`Track "${track.property}" has no keyframes.`);
  }
  return resolveNumericValue(last.value, params);
}
