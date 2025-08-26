import { HomeAssistant } from "../ha/types";

export function compareHass(
  oldHass: HomeAssistant | undefined,
  newHass: HomeAssistant,
  entities: Set<string>
): boolean {
  if (!oldHass) {
    return true;
  }
  for (const entityId of entities) {
    if (oldHass.states[entityId] !== newHass.states[entityId]) {
      return true;
    }
  }
  return false;
}