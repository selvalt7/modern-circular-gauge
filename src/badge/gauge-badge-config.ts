import { LovelaceBadgeConfig } from "../ha/lovelace";

export interface ModernCircularGaugeBadgeConfig extends LovelaceBadgeConfig {
  entity: string;
  min?: number;
  max?: number;
}