import { LovelaceBadgeConfig } from "../ha/data/lovelace";
import { SegmentsConfig } from "../card/type";

export interface ModernCircularGaugeBadgeConfig extends LovelaceBadgeConfig {
  entity: string;
  name?: string;
  min?: number | string;
  max?: number | string;
  unit?: string;
  icon?: string;
  show_name?: boolean;
  show_state?: boolean;
  show_icon?: boolean;
  show_unit?: boolean;
  needle?: boolean;
  state_text?: string;
  start_from_zero?: boolean;
  smooth_segments?: boolean;
  segments?: SegmentsConfig[];
}