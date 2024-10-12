import { LovelaceCardConfig } from "custom-card-helpers";

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    name?: string;
    min?: number;
    max?: number;
    unit?: string;
}