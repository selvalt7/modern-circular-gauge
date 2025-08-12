import { HassEntity } from "home-assistant-js-websocket";
import durationToSeconds from "../ha/common/datetime/duration_to_seconds";

export function getTimerRemainingSeconds(stateObj: HassEntity): number {
  let durationSeconds = 0;
  if (stateObj.state === "active") {
    const timestamp = new Date(stateObj.attributes?.finishes_at);
    durationSeconds = Math.round(Math.abs(timestamp.getTime() - Date.now()) / 1000);
  }
  if (stateObj.state === "paused") {
    durationSeconds = durationToSeconds(stateObj.attributes?.remaining ?? "00:00");
  }
  return durationSeconds;
}

export function getTimestampRemainingSeconds(stateObj: HassEntity): number {
  const timestamp = new Date(stateObj.state);
  return Math.round(Math.abs(timestamp.getTime() - Date.now()) / 1000);
}
