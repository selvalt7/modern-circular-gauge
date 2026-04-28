import { HassEntity } from "home-assistant-js-websocket";
import { HomeAssistant } from "../ha/types";
import { processEntityState, EntityStateProcessorOptions } from "./entity-state-processor";

export function computeState(
  hass: HomeAssistant,
  stateObj: HassEntity | undefined,
  options: EntityStateProcessorOptions = {}
): string {
  return processEntityState(hass, stateObj, options).displayState;
}