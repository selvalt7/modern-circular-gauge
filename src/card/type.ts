import { LovelaceCardConfig } from "../ha/data/lovelace";

export interface SegmentsConfig {
    from: number;
    color: string | [number, number, number];
    label?: string;
}

export type SecondaryEntity = {
    entity?: string;
    unit?: string;
    label?: string;
    template?: string;
    show_gauge?: "none" | "inner" | "outter";
    min?: number | string;
    max?: number | string;
    state_size?: "small" | "big";
    needle?: boolean;
    segments?: SegmentsConfig[];
};

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    name?: string;
    min?: number | string;
    max?: number | string;
    unit?: string;
    label?: string;
    header_position?: "top" | "bottom";
    show_state?: boolean;
    show_secondary_state?: boolean;
    show_header?: boolean;
    needle?: boolean;
    smooth_segments?: boolean;
    segments?: SegmentsConfig[];
    secondary?: SecondaryEntity | string;
    secondary_entity?: SecondaryEntity; // Unused
}