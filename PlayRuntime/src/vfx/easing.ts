import type { EaseDefinition, EaseId } from "./types";

type EasingFunction = (t: number) => number;

export const SAMPLED_EASE_SAMPLE_COUNT = 64;

export const easingFunctions: Record<EaseId, EasingFunction> = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2
};

export function applyEase(ease: EaseDefinition, t: number): number {
  if (!Number.isFinite(t)) {
    throw new Error(`Easing progress must be finite; received ${t}.`);
  }

  if (typeof ease === "string") {
    return easingFunctions[ease](t);
  }

  if (ease.samples.length !== SAMPLED_EASE_SAMPLE_COUNT) {
    throw new Error(
      `Sampled easing must contain ${SAMPLED_EASE_SAMPLE_COUNT} values; received ${ease.samples.length}.`
    );
  }

  const position =
    Math.min(1, Math.max(0, t)) * (SAMPLED_EASE_SAMPLE_COUNT - 1);
  const leftIndex = Math.min(
    Math.floor(position),
    SAMPLED_EASE_SAMPLE_COUNT - 2
  );
  const fraction = position - leftIndex;
  const start = ease.samples[leftIndex];
  const end = ease.samples[leftIndex + 1];
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("Sampled easing values must be finite.");
  }
  return start + (end - start) * fraction;
}
