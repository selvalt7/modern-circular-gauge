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
    show_state?: boolean;
    show_unit?: boolean;
    needle?: boolean;
    gauge_width?: number;
    adaptive_state_color?: boolean;
    segments?: SegmentsConfig[];
    [key: string]: any;
};

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    name?: string;
    icon?: string;
    min?: number | string;
    max?: number | string;
    unit?: string;
    label?: string;
    header_position?: "top" | "bottom";
    show_state?: boolean;
    show_header?: boolean;
    show_unit?: boolean;
    show_icon?: boolean;
    needle?: boolean;
    adaptive_icon_color?: boolean;
    adaptive_state_color?: boolean;
    smooth_segments?: boolean;
    state_font_size?: number;
    header_font_size?: number;
    header_offset?: number;
    gauge_width?: number;
    state_scaling_limit?: number;
    state_scaling_multiplier?: number;
    segments?: SegmentsConfig[];
    secondary?: SecondaryEntity | string;
    secondary_entity?: SecondaryEntity; // Unused
}