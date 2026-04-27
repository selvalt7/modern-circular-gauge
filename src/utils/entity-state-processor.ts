import { HassEntity } from "home-assistant-js-websocket";
import { DEFAULT_MAX, DEFAULT_MIN, TIMESTAMP_STATE_DOMAINS } from "../const";
import { computeStateDomain } from "../ha/common/entity/compute_state_domain";
import { formatNumber, getNumberFormatOptions, getDefaultFormatOptions } from "./format_number";
import secondsToDuration from "./seconds_to_duration";
import { getTimerRemainingSeconds, getTimestampRemainingSeconds } from "./timer_timestamp_utils";
import { HomeAssistant } from "../ha/types";
import localize from "../localize/localize";
import { valueToPercentageUnclamped } from "./gauge";

export interface EntityStateProcessorOptions {
  entityAttribute?: string;
  stateOverride?: string;
  decimals?: number;
  showSeconds?: boolean;
  min?: number;
  max?: number;
  timeFormat?: "compact" | "minutes" | "digital";
  stateFormat?: "default" | "wind_direction" | "percentage";
}

export interface ProcessedEntityState {
  displayState: string;
  numericValue?: number;
  percentage?: string;
  isTimerOrTimestamp?: boolean;
}

const CARDINAL_DIRECTIONS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

const parseNumericValue = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? undefined : numeric;
};

export function getWindDirectionCardinal(hass: HomeAssistant, value: string | number | undefined): string | undefined {
  const numeric = parseNumericValue(value);
  if (numeric === undefined) {
    return undefined;
  }
  const normalized = ((numeric % 360) + 360) % 360;
  const index = Math.floor((normalized + 11.25) / 22.5) % CARDINAL_DIRECTIONS.length;
  const directionKey = CARDINAL_DIRECTIONS[index];
  const translated = localize(hass, `wind_direction.${directionKey}`);
  return translated === `wind_direction.${directionKey}` ? directionKey : translated;
}

export function isTimerOrTimestampEntity(stateObj?: HassEntity): boolean {
  if (!stateObj) {
    return false;
  }
  const domain = computeStateDomain(stateObj);
  return (
    stateObj.attributes?.device_class === "timestamp" ||
    TIMESTAMP_STATE_DOMAINS.includes(domain) ||
    domain === "timer"
  );
}

export function formatPercentage(value: number, min = DEFAULT_MIN, max = DEFAULT_MAX, decimals = 0): string {
  if (max === min) {
    return "0";
  }
  const percent = valueToPercentageUnclamped(value, min, max) * 100;
  const rounded = Number.isFinite(percent)
    ? Number(percent.toFixed(decimals))
    : 0;
  const clamped = Math.max(0, Math.min(100, rounded));
  return `${clamped}`;
}

export function formatTimerOrTimestampState(
  stateObj: HassEntity,
  showSeconds = true,
  timeFormat: "compact" | "minutes" | "digital" = "digital"
): { displayState: string; numericValue: number } {
  const domain = computeStateDomain(stateObj);
  const seconds =
    domain === "timer"
      ? getTimerRemainingSeconds(stateObj)
      : getTimestampRemainingSeconds(stateObj);

  const displayState = domain === "timer" ? stateObj.state !== "idle" ? formatDuration(seconds, showSeconds, timeFormat) : "idle" : formatDuration(seconds, showSeconds, timeFormat);
  return {
    displayState,
    numericValue: seconds,
  };
}

export function formatDuration(
  seconds: number,
  showSeconds = true,
  format: "compact" | "minutes" | "digital" = "digital"
): string {
  if (seconds <= 0) {
    return format === "digital" ? "00:00" : "0s";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  switch (format) {
    case "compact":
      if (hours > 0) {
        return `${hours}h ${minutes}m${showSeconds ? ` ${secs}s` : ""}`;
      } else if (minutes > 0) {
        return `${minutes}m ${showSeconds ? `${secs}s` : ""}`.trim();
      } else {
        return showSeconds ? `${secs}s` : "0m";
      }

    case "minutes":
      const totalMinutes = Math.floor(seconds / 60);
      return `${totalMinutes}m`;

    case "digital":
    default:
      return secondsToDuration(seconds, showSeconds) || "00:00";
  }
}

export function processEntityState(
  hass: HomeAssistant,
  stateObj?: HassEntity,
  options: EntityStateProcessorOptions = {}
): ProcessedEntityState {
  const {
    entityAttribute,
    stateOverride,
    decimals,
    showSeconds,
    min,
    max,
    timeFormat,
    stateFormat,
  } = options;

  const numericOverride = parseNumericValue(stateOverride);

  if (!stateObj) {
    if (stateOverride !== undefined) {
      if (numericOverride !== undefined) {
        const formatOptions = getDefaultFormatOptions(stateOverride, {
          maximumFractionDigits: decimals,
          minimumFractionDigits: decimals,
        });
        const displayState = formatNumber(stateOverride, hass?.locale, formatOptions);
        return {
          displayState,
          numericValue: numericOverride,
        };
      }
      return { displayState: stateOverride };
    }
    return { displayState: "" };
  }

  const isTimerOrTimestamp = isTimerOrTimestampEntity(stateObj);
  if (stateOverride !== undefined && isTimerOrTimestamp) {
    if (numericOverride !== undefined) {
      const formatOptions = getDefaultFormatOptions(stateOverride, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      });
      const displayState = formatNumber(stateOverride, hass?.locale, formatOptions);
      return {
        displayState,
        numericValue: numericOverride,
      };
    }
    return { displayState: stateOverride };
  }

  if (isTimerOrTimestamp) {
    const { displayState, numericValue } = formatTimerOrTimestampState(
      stateObj,
      showSeconds ?? true,
      timeFormat ?? "digital"
    );
    if (displayState === "idle") {
      return { displayState: hass.localize("component.timer.entity_component._.state.idle") };
    }
    if (stateObj.state === "paused") {
      return { displayState: `${displayState} (${hass.localize("component.timer.entity_component._.state.paused")})` };
    }
    return {
      displayState: displayState,
      numericValue,
      isTimerOrTimestamp: true,
    };
  }

  const rawState =
    stateOverride ??
    (entityAttribute ? stateObj.attributes?.[entityAttribute] : undefined) ??
    stateObj.state;
  const numericValue = parseNumericValue(rawState);

  if (stateFormat === "wind_direction") {
    const cardinal = getWindDirectionCardinal(hass, rawState);
    const displayState = cardinal ?? String(rawState);
    return {
      displayState,
      numericValue,
    };
  }

  if (stateFormat === "percentage" && numericValue !== undefined && min !== undefined && max !== undefined) {
    const percentage = formatPercentage(numericValue, min, max, decimals ?? 0);
    return {
      displayState: percentage,
      numericValue,
      percentage,
    };
  }

  if (numericValue !== undefined) {
    const formatOptions = {
      ...getNumberFormatOptions(
        { state: rawState, attributes: stateObj.attributes } as HassEntity,
        hass?.entities[stateObj.entity_id]
      ),
    };
    if (decimals !== undefined) {
      formatOptions.maximumFractionDigits = decimals;
      formatOptions.minimumFractionDigits = decimals;
    }

    const displayState = formatNumber(rawState, hass?.locale, formatOptions);

    return {
      displayState,
      numericValue,
    };
  }

  return { displayState: String(rawState) };
}
