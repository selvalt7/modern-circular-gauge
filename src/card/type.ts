import { LovelaceCardConfig } from "../ha/data/lovelace";

export interface SegmentsConfig {
    from: number;
    color: string | [number, number, number];
    label?: string;
}

export interface BaseEntityConfig {
    entity?: string;
    unit?: string;
    label?: string;
    min?: number | string;
    max?: number | string;
    needle?: boolean;
    show_state?: boolean;
    show_unit?: boolean;
    state_text?: string;
    start_from_zero?: boolean;
    gauge_background_style?: GaugeElementConfig;
    gauge_foreground_style?: GaugeElementConfig;
    adaptive_state_color?: boolean;
    segments?: SegmentsConfig[];
}

export interface SecondaryEntity extends BaseEntityConfig {
    template?: string;
    show_gauge?: "none" | "inner" | "outter";
    state_size?: "small" | "big";
    gauge_width?: number;
    [key: string]: any;
};

export interface TertiaryEntity extends BaseEntityConfig {
    show_gauge?: boolean;
    [key: string]: any;
}

export interface GaugeElementConfig {
    width?: number;
    color?: string | "adaptive";
    opacity?: number;
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
    state_text?: string;
    adaptive_icon_color?: boolean;
    adaptive_state_color?: boolean;
    smooth_segments?: boolean;
    state_font_size?: number;
    header_font_size?: number;
    header_offset?: number;
    start_from_zero?: boolean;
    gauge_width?: number;
    gauge_background_style?: GaugeElementConfig;
    gauge_foreground_style?: GaugeElementConfig;
    state_scaling_limit?: number;
    state_scaling_multiplier?: number;
    segments?: SegmentsConfig[];
    secondary?: SecondaryEntity | string;
    tertiary?: TertiaryEntity | string;
    secondary_entity?: SecondaryEntity; // Unused
}