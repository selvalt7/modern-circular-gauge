import { LovelaceBadgeConfig } from "../ha/lovelace";
import { SegmentsConfig } from "../card/type";

export interface ModernCircularGaugeBadgeConfig extends LovelaceBadgeConfig {
  entity: string;
  name?: string;
  min?: number | string;
  max?: number | string;
  unit?: string;
  show_name?: boolean;
  show_state?: boolean;
  segments?: SegmentsConfig[];
}