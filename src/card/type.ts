import { LovelaceCardConfig } from "custom-card-helpers";

export interface SegmentsConfig {
    from: number;
    color: string | [number, number, number];
    label?: string;
}

export type SecondaryEntity = {
    entity?: string;
    unit?: string;
    template?: string;
    show_gauge?: "none" | "inner" | "outter";
    min?: number | string;
    max?: number | string;
    needle?: boolean;
    segments?: SegmentsConfig[];
};

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    name?: string;
    min?: number | string;
    max?: number | string;
    unit?: string;
    header_position?: "top" | "bottom";
    show_state?: boolean;
    show_secondary?: boolean;
    needle?: boolean;
    segments?: SegmentsConfig[];
    secondary?: SecondaryEntity | string;
    secondary_entity?: SecondaryEntity; // Unused
}