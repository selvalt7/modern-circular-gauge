import { LovelaceBadgeConfig } from "../ha/lovelace";
import { SegmentsConfig } from "../card/type";

export interface ModernCircularGaugeBadgeConfig extends LovelaceBadgeConfig {
  entity: string;
  name?: string;
  min?: number;
  max?: number;
  unit?: string;
  show_name?: boolean;
  show_state?: boolean;
  segments?: SegmentsConfig[];
}