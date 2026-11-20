export type EaseId = "linear" | "inQuad" | "outCubic" | "inOutSine";

export interface SampledEase {
  samples: number[];
}

export type EaseDefinition = EaseId | SampledEase;

export interface ParameterReference {
  param: string;
}

export interface NumberParameterDefinition {
  type: "number";
  default: number;
  min?: number;
  max?: number;
}

export interface ColorParameterDefinition {
  type: "color";
  default: string;
}

export type ParameterDefinition =
  | NumberParameterDefinition
  | ColorParameterDefinition;

export type NumericValue = number | ParameterReference;
export type ColorValue = string | ParameterReference;

export interface KeyframeDefinition {
  t: number;
  value: NumericValue;
  ease?: EaseDefinition;
}

export interface TrackDefinition {
  property: "radius" | "opacity" | "sweepAngle" | "reveal";
  keys: KeyframeDefinition[];
}

interface EffectLayerBase {
  id: string;
  startAt: number;
  duration: number;
  material: {
    color: ColorValue;
    blend: "normal" | "additive";
  };
  tracks: TrackDefinition[];
}

export interface RingLayerDefinition extends EffectLayerBase {
  type: "ring";
  geometry: {
    thickness: number;
  };
}

export interface WaveLayerDefinition extends EffectLayerBase {
  type: "wave";
  geometry: {
    thickness: number;
    softness: number;
  };
}

export interface SlashArcLayerDefinition extends EffectLayerBase {
  type: "slashArc";
  geometry: {
    thickness: number;
    startAngle: number;
    sweepAngle: number;
    tipRatio?: number;
  };
}

export interface SlashRibbonPoint {
  x: number;
  y: number;
}

export interface SlashRibbonLayerDefinition extends EffectLayerBase {
  type: "slashRibbon";
  geometry: {
    path: {
      start: SlashRibbonPoint;
      control1: SlashRibbonPoint;
      control2: SlashRibbonPoint;
      end: SlashRibbonPoint;
    };
    width: number;
    tipRatio: number;
  };
}

/** 碎片图层：按表面法线方向抛起碎片，并沿局部平面向外散射。 */
export interface ShardLayerDefinition extends EffectLayerBase {
  type: "shards";
  geometry: {
    count: number;
    size: number;
    spread: number;
    lift: number;
    gravity: number;
  };
}

/** 飞弹图层：沿表面切线飞行，并按抛物线弧高偏离表面。 */
export interface ProjectileLayerDefinition extends EffectLayerBase {
  type: "projectile";
  geometry: {
    shape: "orb" | "dart" | "bomb";
    directionAngle: number;
    size: number;
    travel: number;
    arcHeight: number;
    trailLength: number;
  };
}

export type EffectLayerDefinition =
  | RingLayerDefinition
  | WaveLayerDefinition
  | SlashArcLayerDefinition
  | SlashRibbonLayerDefinition
  | ShardLayerDefinition
  | ProjectileLayerDefinition;

export interface EffectDefinition {
  schemaVersion: 1;
  id: string;
  duration: number;
  space: "surface";
  params: Record<string, ParameterDefinition>;
  layers: EffectLayerDefinition[];
}

export type RuntimeParameterValue = number | string;
export type ResolvedParameters = Record<string, RuntimeParameterValue>;
