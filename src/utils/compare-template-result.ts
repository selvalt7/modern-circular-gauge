import { RenderTemplateResult } from "../ha/data/ws-templates";

export function compareTemplateResult(
  oldResult: Record<string, RenderTemplateResult | undefined> | undefined,
  newResult: Record<string, RenderTemplateResult | undefined> | undefined
): boolean {
  console.log("Comparing template results", oldResult, newResult);
  if (!oldResult || !newResult) {
    return true;
  }
  const keys = Object.keys(newResult);
  for (const key of keys) {
    if (oldResult[key] !== newResult[key]) {
      return true;
    }

    const oldValue = oldResult[key]?.result;
    const newValue = newResult[key]?.result;
    if (oldValue !== newValue) {
      return true;
    }
  }
  return false;
}