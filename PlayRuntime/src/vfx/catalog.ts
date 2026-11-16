export interface EffectCatalogEntry {
  id: string;
  name: string;
  category: string;
  file: string;
}

const effectIdPattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
const effectFilePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.vfx\.json$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEffectCatalog(input: unknown): EffectCatalogEntry[] {
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.effects)) {
    throw new Error("Invalid VFX effect catalog: expected schema version 1 and an effects list.");
  }

  const ids = new Set<string>();
  const files = new Set<string>();
  const entries: EffectCatalogEntry[] = [];
  for (const [index, value] of input.effects.entries()) {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      !effectIdPattern.test(value.id) ||
      typeof value.name !== "string" ||
      value.name.trim().length === 0 ||
      typeof value.category !== "string" ||
      value.category.trim().length === 0 ||
      typeof value.file !== "string" ||
      !effectFilePattern.test(value.file)
    ) {
      throw new Error(`Invalid VFX effect catalog entry at index ${index}.`);
    }

    const expectedFile = `${value.id.replace(/\./g, "-")}.vfx.json`;
    if (value.file !== expectedFile) {
      throw new Error(
        `Catalog entry "${value.id}" must use filename "${expectedFile}".`
      );
    }
    if (ids.has(value.id) || files.has(value.file)) {
      throw new Error(`The VFX effect catalog contains duplicate IDs or files.`);
    }

    ids.add(value.id);
    files.add(value.file);
    entries.push({
      id: value.id,
      name: value.name,
      category: value.category,
      file: value.file
    });
  }

  if (entries.length === 0) {
    throw new Error("The VFX effect catalog does not contain any effects.");
  }
  return entries;
}
