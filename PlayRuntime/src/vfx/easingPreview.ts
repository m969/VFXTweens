import { applyEase } from "./easing";
import type {
  EaseDefinition,
  EffectDefinition,
  EffectLayerDefinition,
  TrackDefinition
} from "./types";

export interface EasingPreviewSegment {
  id: string;
  layerId: string;
  layerType: EffectLayerDefinition["type"];
  property: TrackDefinition["property"];
  from: number;
  to: number;
  startTime: number;
  endTime: number;
  ease: EaseDefinition;
}

export interface EasingPreviewPoint {
  x: number;
  y: number;
}

export function getEasingPreviewSegments(
  definition: EffectDefinition
): EasingPreviewSegment[] {
  const segments: EasingPreviewSegment[] = [];
  for (const layer of definition.layers) {
    for (const track of layer.tracks) {
      for (let index = 1; index < track.keys.length; index += 1) {
        const fromKey = track.keys[index - 1];
        const toKey = track.keys[index];
        segments.push({
          id: `${layer.id}:${track.property}:${index}`,
          layerId: layer.id,
          layerType: layer.type,
          property: track.property,
          from: fromKey.t,
          to: toKey.t,
          startTime: layer.startAt + layer.duration * fromKey.t,
          endTime: layer.startAt + layer.duration * toKey.t,
          ease: toKey.ease ?? "linear"
        });
      }
    }
  }
  return segments;
}

export function getEasingPreviewPoint(
  segment: EasingPreviewSegment,
  effectTime: number
): EasingPreviewPoint {
  if (!Number.isFinite(effectTime)) {
    throw new Error(`Effect time must be finite; received ${effectTime}.`);
  }
  const x = Math.min(
    1,
    Math.max(0, (effectTime - segment.startTime) / (segment.endTime - segment.startTime))
  );
  return { x, y: applyEase(segment.ease, x) };
}

export function sampleEaseCurve(
  ease: EaseDefinition,
  intervalCount = 64
): EasingPreviewPoint[] {
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw new Error("Easing curve interval count must be a positive integer.");
  }
  return Array.from({ length: intervalCount + 1 }, (_, index) => {
    const x = index / intervalCount;
    return { x, y: applyEase(ease, x) };
  });
}
