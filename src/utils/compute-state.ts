import { HassEntity } from "home-assistant-js-websocket";
import { TIMESTAMP_STATE_DOMAINS } from "../const";
import { computeStateDomain } from "../ha/common/entity/compute_state_domain";
import { formatNumber, getNumberFormatOptions, getDefaultFormatOptions } from "./format_number";
import secondsToDuration from "./seconds_to_duration";
import { HomeAssistant } from "../ha/types";

export function computeState(hass: HomeAssistant, stateObj: HassEntity, entityAttribute: string, stateOverride: string, decimals: number | undefined, showSeconds: boolean | undefined): string {
  if (!stateObj && stateOverride !== undefined) {
    if (!Number.isNaN(Number(stateOverride))) {
      const formatOptions = getDefaultFormatOptions(stateOverride, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
      return formatNumber(stateOverride, hass?.locale, formatOptions);
    }
    return stateOverride;
  }

  if (stateObj) {
    const domain = computeStateDomain(stateObj);
    let secondsUntil: number | undefined;

    if (stateObj?.attributes?.device_class === "timestamp" ||
      TIMESTAMP_STATE_DOMAINS.includes(domain)
    ) {
      const timestamp = new Date(stateObj.state);
      secondsUntil = Math.round(Math.abs(timestamp.getTime() - Date.now()) / 1000);
      return secondsToDuration(secondsUntil, showSeconds ?? true) || "0";
    }

    if (domain === "timer") {
      secondsUntil = 0;
      if (stateObj.state === "active") {
        const timestamp = new Date(stateObj.attributes?.finishes_at);
        secondsUntil = Math.round(Math.abs(timestamp.getTime() - Date.now()) / 1000);
        return secondsToDuration(secondsUntil, showSeconds ?? true) || "0";
      }
    }

    const state = stateOverride ?? stateObj.attributes[entityAttribute!] ?? stateObj.state;
    const attributes = stateObj.attributes ?? undefined;
    const formatOptions = { ...getNumberFormatOptions({ state, attributes } as HassEntity, hass?.entities[stateObj?.entity_id]) };
    if (decimals !== undefined) {
      formatOptions.maximumFractionDigits = decimals;
      formatOptions.minimumFractionDigits = decimals;
    }
    const entityState = Number.isNaN(state) ? state
      : formatNumber(state, hass?.locale, formatOptions);
    return entityState;
  }

  return "";
}