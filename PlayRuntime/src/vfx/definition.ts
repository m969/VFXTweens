import Ajv2020 from "ajv/dist/2020.js";
import effectSchema from "../../schema/vfx-effect-v1.schema.json";
import { SAMPLED_EASE_SAMPLE_COUNT } from "./easing";
import type {
  ColorParameterDefinition,
  EffectDefinition,
  NumberParameterDefinition,
  NumericValue,
  ParameterDefinition,
  ParameterReference,
  EffectLayerDefinition,
  TrackDefinition
} from "./types";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateShape = ajv.compile<EffectDefinition>(effectSchema);
const colorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSupportedParameterTypes(input: unknown): void {
  if (!isRecord(input) || !isRecord(input.params)) {
    return;
  }

  for (const [name, parameter] of Object.entries(input.params)) {
    if (
      isRecord(parameter) &&
      typeof parameter.type === "string" &&
      parameter.type !== "number" &&
      parameter.type !== "color"
    ) {
      throw new Error(
        `Unsupported parameter type "${parameter.type}" for parameter "${name}". Supported types are "number" and "color".`
      );
    }
  }
}

function isParameterReference(value: unknown): value is ParameterReference {
  return (
    typeof value === "object" &&
    value !== null &&
    "param" in value &&
    typeof value.param === "string"
  );
}

function isNumberParameter(
  parameter: ParameterDefinition
): parameter is NumberParameterDefinition {
  return parameter.type === "number";
}

function isColorParameter(
  parameter: ParameterDefinition
): parameter is ColorParameterDefinition {
  return parameter.type === "color";
}

function validateParameters(definition: EffectDefinition): void {
  for (const [name, parameter] of Object.entries(definition.params)) {
    if (isNumberParameter(parameter)) {
      if (
        parameter.min !== undefined &&
        parameter.max !== undefined &&
        parameter.min > parameter.max
      ) {
        throw new Error(`Parameter "${name}" has min greater than max.`);
      }
      if (parameter.min !== undefined && parameter.default < parameter.min) {
        throw new Error(`Parameter "${name}" default is below its minimum.`);
      }
      if (parameter.max !== undefined && parameter.default > parameter.max) {
        throw new Error(`Parameter "${name}" default is above its maximum.`);
      }
    } else if (!colorPattern.test(parameter.default)) {
      throw new Error(`Parameter "${name}" has an invalid color default.`);
    }
  }
}

function validateNumericValue(
  value: NumericValue,
  definition: EffectDefinition,
  location: string,
  min?: number,
  max?: number
): void {
  if (typeof value === "number") {
    if (value < (min ?? Number.NEGATIVE_INFINITY)) {
      throw new Error(`${location} must be at least ${min}.`);
    }
    if (value > (max ?? Number.POSITIVE_INFINITY)) {
      throw new Error(`${location} must be at most ${max}.`);
    }
    return;
  }

  const parameter = definition.params[value.param];
  if (!parameter) {
    throw new Error(`${location} references missing parameter "${value.param}".`);
  }
  if (!isNumberParameter(parameter)) {
    throw new Error(`${location} must reference a number parameter.`);
  }
  if (min !== undefined && parameter.min === undefined) {
    throw new Error(`${location} references a parameter without a minimum bound.`);
  }
  if (max !== undefined && parameter.max === undefined) {
    throw new Error(`${location} references a parameter without a maximum bound.`);
  }
  if (parameter.min !== undefined && parameter.min < (min ?? Number.NEGATIVE_INFINITY)) {
    throw new Error(`${location} references a parameter whose minimum is too low.`);
  }
  if (parameter.max !== undefined && parameter.max > (max ?? Number.POSITIVE_INFINITY)) {
    throw new Error(`${location} references a parameter whose maximum is too high.`);
  }
}

function validateTrack(
  track: TrackDefinition,
  definition: EffectDefinition,
  layerId: string
): void {
  const location = `Layer "${layerId}" track "${track.property}"`;
  if (track.keys[0]?.t !== 0 || track.keys.at(-1)?.t !== 1) {
    throw new Error(`${location} must start at t=0 and end at t=1.`);
  }

  for (let index = 0; index < track.keys.length; index += 1) {
    const key = track.keys[index];
    const previous = track.keys[index - 1];
    if (previous && key.t <= previous.t) {
      throw new Error(`${location} key times must be strictly increasing.`);
    }
    if (index === 0 && key.ease !== undefined) {
      throw new Error(`${location} first keyframe cannot define an easing function.`);
    }
    if (key.ease && typeof key.ease !== "string") {
      const samples = key.ease.samples;
      if (samples.some((sample) => !Number.isFinite(sample))) {
        throw new Error(`${location} easing samples must all be finite.`);
      }
      if (
        Math.abs(samples[0]) > 1e-4 ||
        Math.abs(samples.at(-1)! - 1) > 1e-4
      ) {
        throw new Error(
          `${location} easing samples must start at 0 and end at 1.`
        );
      }
      if (samples.length !== SAMPLED_EASE_SAMPLE_COUNT) {
        throw new Error(
          `${location} easing must contain ${SAMPLED_EASE_SAMPLE_COUNT} samples.`
        );
      }
    }

    const bounds =
      track.property === "opacity" ? { min: 0, max: 1 } : { min: 0 };
    validateNumericValue(
      key.value,
      definition,
      `${location} key at t=${key.t}`,
      bounds.min,
      bounds.max
    );
  }
}

function validateLayer(
  layer: EffectLayerDefinition,
  definition: EffectDefinition
): void {
  if (layer.startAt + layer.duration > definition.duration) {
    throw new Error(`Layer "${layer.id}" extends beyond the effect duration.`);
  }
  if (layer.type === "wave" && (layer.geometry.softness < 0 || layer.geometry.softness > 1)) {
    throw new Error(`Wave layer "${layer.id}" softness must be between zero and one.`);
  }
  if (
    layer.type === "slashArc" &&
    (layer.geometry.startAngle < 0 ||
      layer.geometry.startAngle > 360 ||
      layer.geometry.sweepAngle <= 0 ||
      layer.geometry.sweepAngle > 360)
  ) {
    throw new Error(
      `Slash arc layer "${layer.id}" angles must be in range: startAngle 0..360, sweepAngle (0..360].`
    );
  }
  const sweepAngleTrack = layer.tracks.find(
    (track) => track.property === "sweepAngle"
  );
  if (sweepAngleTrack && layer.type !== "slashArc") {
    throw new Error(
      `Layer "${layer.id}" has a sweepAngle track, but only slashArc layers support it.`
    );
  }
  if (sweepAngleTrack && layer.type === "slashArc") {
    for (const key of sweepAngleTrack.keys) {
      validateNumericValue(
        key.value,
        definition,
        `Layer "${layer.id}" sweepAngle track key at t=${key.t}`,
        0,
        layer.geometry.sweepAngle
      );
    }
  }
  const trackProperties = new Set<string>();
  for (const track of layer.tracks) {
    if (trackProperties.has(track.property)) {
      throw new Error(
        `Layer "${layer.id}" has duplicate "${track.property}" tracks.`
      );
    }
    trackProperties.add(track.property);
    validateTrack(track, definition, layer.id);
  }

  if (!trackProperties.has("radius") || !trackProperties.has("opacity")) {
    throw new Error(
      `Layer "${layer.id}" requires radius and opacity tracks.`
    );
  }

  if (isParameterReference(layer.material.color)) {
    const parameter = definition.params[layer.material.color.param];
    if (!parameter) {
      throw new Error(
        `Layer "${layer.id}" references missing color parameter "${layer.material.color.param}".`
      );
    }
    if (!isColorParameter(parameter)) {
      throw new Error(
        `Layer "${layer.id}" material color must reference a color parameter.`
      );
    }
  } else if (!colorPattern.test(layer.material.color)) {
    throw new Error(`Layer "${layer.id}" has an invalid material color.`);
  }
}

export function parseEffectDefinition(input: unknown): EffectDefinition {
  validateSupportedParameterTypes(input);
  if (!validateShape(input)) {
    const details = ajv.errorsText(validateShape.errors, { separator: "\n" });
    throw new Error(`Invalid VFX effect definition:\n${details}`);
  }

  const definition = input;
  validateParameters(definition);

  const layerIds = new Set<string>();
  for (const layer of definition.layers) {
    if (layerIds.has(layer.id)) {
      throw new Error(`Duplicate layer id "${layer.id}".`);
    }
    layerIds.add(layer.id);
    validateLayer(layer, definition);
  }

  return definition;
}
