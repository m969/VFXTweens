import type { ParameterDefinition } from "./types";

export type ParameterControlSpec =
  | {
      name: string;
      type: "number";
      defaultValue: number;
      min?: number;
      max?: number;
    }
  | {
      name: string;
      type: "color";
      defaultValue: string;
    };

export function getParameterControlSpecs(
  parameters: Record<string, ParameterDefinition>
): ParameterControlSpec[] {
  const controls: ParameterControlSpec[] = [];
  for (const [name, parameter] of Object.entries(parameters)) {
    if (parameter.type === "number") {
      controls.push({
        name,
        type: "number",
        defaultValue: parameter.default,
        min: parameter.min,
        max: parameter.max
      });
    } else {
      controls.push({
        name,
        type: "color",
        defaultValue: parameter.default
      });
    }
  }
  return controls;
}
