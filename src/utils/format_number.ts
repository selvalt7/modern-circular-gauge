import { HassEntity } from "home-assistant-js-websocket";
import { EntityRegistryDisplayEntry } from "../ha/types";

export const getNumberFormatOptions = (
  entityState?: HassEntity,
  entity?: EntityRegistryDisplayEntry
): Intl.NumberFormatOptions | undefined => {
  const precision = entity?.display_precision;
  if (precision != null) {
    return {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
    };
  }
  if (
    Number.isInteger(Number(entityState?.attributes?.step)) &&
    Number.isInteger(Number(entityState?.state))
  ) {
    return { maximumFractionDigits: 0 };
  }
  return undefined;
};