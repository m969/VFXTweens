import type {
  EffectDefinition,
  ResolvedParameters,
  RuntimeParameterValue
} from "./types";

const colorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function resolveParameters(
  definition: EffectDefinition,
  overrides: Record<string, unknown> = {}
): ResolvedParameters {
  for (const name of Object.keys(overrides)) {
    if (!(name in definition.params)) {
      throw new Error(`Unknown parameter "${name}" for effect "${definition.id}".`);
    }
  }

  const resolved: ResolvedParameters = {};
  for (const [name, parameter] of Object.entries(definition.params)) {
    const override = overrides[name];
    const value =
      override === undefined ? parameter.default : override;

    if (parameter.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Parameter "${name}" must be a finite number.`);
      }
      if (parameter.min !== undefined && value < parameter.min) {
        throw new Error(`Parameter "${name}" must be at least ${parameter.min}.`);
      }
      if (parameter.max !== undefined && value > parameter.max) {
        throw new Error(`Parameter "${name}" must be at most ${parameter.max}.`);
      }
      resolved[name] = value;
      continue;
    }

    if (typeof value !== "string" || !colorPattern.test(value)) {
      throw new Error(`Parameter "${name}" must be a hex color.`);
    }
    resolved[name] = value;
  }

  return resolved;
}

export function resolveColorValue(
  value: string | { param: string },
  params: ResolvedParameters
): string {
  if (typeof value === "string") {
    return value;
  }

  const resolved: RuntimeParameterValue | undefined = params[value.param];
  if (typeof resolved !== "string" || !colorPattern.test(resolved)) {
    throw new Error(`Parameter "${value.param}" must resolve to a hex color.`);
  }
  return resolved;
}
