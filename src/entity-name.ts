import { EntityNameItem } from "./ha/data/entity_name";
import { HomeAssistant } from "./ha/types";
import { HassEntity } from "home-assistant-js-websocket";

export const supportsEntityNamesVersion = (hass?: HomeAssistant): boolean => {
  const [major, minor] = (hass?.config?.version ?? "").split(".", 2);
  return Number(major) > 2026 || (Number(major) === 2026 && Number(minor) >= 4);
};

/**
 * `hass.formatEntityName` only resolves an entity's name from its registry
 * context from HA 2026.4. Earlier versions expose the same helper with an
 * incompatible signature, so a version check is needed - and a hass can report a
 * recent version without carrying the helper at all (a test harness, or one that
 * has not finished initialising), so both conditions are checked.
 */
const supportsEntityNames = (hass?: HomeAssistant): boolean => {
  if (typeof (hass as { formatEntityName?: unknown } | undefined)?.formatEntityName !== "function") {
    return false;
  }
  const [major, minor] = (hass?.config?.version ?? "").split(".", 2);
  return Number(major) > 2026 || (Number(major) === 2026 && Number(minor) >= 4);
};

/**
 * Resolves an entity's display name from its registry context (entity, device,
 * area, floor), so it matches what the built-in cards show. Falls back to the
 * friendly name on Home Assistant versions without that support.
 */
export const computeEntityName = (
  hass: HomeAssistant | undefined,
  stateObj: HassEntity | undefined,
  name: string | EntityNameItem | EntityNameItem[] | undefined
): string => {
  if (!stateObj) return "";
  if (supportsEntityNames(hass)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (hass as any).formatEntityName(stateObj, name) || "";
  }
  if (typeof name === "string") {
    return name;
  }
  return stateObj.attributes?.friendly_name ?? "";
};

/**
 * `formatEntityName` resolves against the entity/device/area/floor registries,
 * and HA swaps the real formatter in asynchronously once translations load.
 * Neither shows up as an entity state change, so without this a rename (or that
 * swap) leaves rendered names stale until an unrelated update forces a render.
 */
const NAME_SOURCES = ["formatEntityName", "entities", "devices", "areas", "floors"] as const;

export const entityNamesChanged = (oldHass?: HomeAssistant, newHass?: HomeAssistant): boolean => {
  if (!oldHass || !newHass) return false;
  const before = oldHass as unknown as Record<string, unknown>;
  const after = newHass as unknown as Record<string, unknown>;
  return NAME_SOURCES.some((key) => before[key] !== after[key]);
};
