import { LovelaceCardConfig } from "custom-card-helpers";

export interface SegmentsConfig {
    from: number;
    color: string | [number, number, number];
    label?: string;
}

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    name?: string;
    min?: number;
    max?: number;
    unit?: string;
    header_position?: "top" | "bottom";
    needle?: boolean;
    segments?: SegmentsConfig[];
}