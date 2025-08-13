import type { HassEntity } from "home-assistant-js-websocket";
import { computeDomain } from "./compute_domain";

export const computeStateDomain = (stateObj: HassEntity) => {
  if (!stateObj || !stateObj.entity_id) {
    return "";
  }
  return computeDomain(stateObj.entity_id);
};
