import type { ActionConfig } from "../../../handle-action";

export function hasAction(config?: ActionConfig): boolean {
  return config !== undefined && config.action !== "none";
}