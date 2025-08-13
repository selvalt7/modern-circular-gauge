import { LovelaceBadgeConfig } from "../ha/data/lovelace";
import { GaugeElementConfig, SegmentsConfig } from "../card/type";

export interface ModernCircularGaugeBadgeConfig extends LovelaceBadgeConfig {
  entity: string;
  attribute?: string;
  name?: string;
  min?: number | string;
  max?: number | string;
  decimals?: number;
  unit?: string;
  icon?: string;
  show_entity_picture?: boolean;
  show_name?: boolean;
  show_state?: boolean;
  show_icon?: boolean;
  show_unit?: boolean;
  needle?: boolean;
  state_text?: string;
  start_from_zero?: boolean;
  gauge_foreground_style?: GaugeElementConfig;
  gauge_background_style?: GaugeElementConfig;
  smooth_segments?: boolean;
  segments?: SegmentsConfig[];
}