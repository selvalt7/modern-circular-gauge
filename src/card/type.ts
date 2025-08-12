import { LovelaceCardConfig } from "../ha/data/lovelace";

export interface SegmentsConfig {
    from: number;
    color: string | [number, number, number];
    label?: string;
}

export interface BaseEntityConfig {
    entity?: string;
    attribute?: string;
    unit?: string;
    label?: string;
    label_font_size?: number;
    min?: number | string;
    max?: number | string;
    needle?: boolean;
    show_seconds?: boolean;
    show_gauge?: "none" | "inner" | "outter" | "outer";
    show_state?: boolean;
    show_unit?: boolean;
    state_text?: string;
    state_font_size?: number;
    start_from_zero?: boolean;
    gauge_radius?: number;
    gauge_background_style?: GaugeElementConfig;
    gauge_foreground_style?: GaugeElementConfig;
    adaptive_state_color?: boolean;
    segments?: SegmentsConfig[];
}

export interface SecondaryEntity extends BaseEntityConfig {
    template?: string;
    state_size?: "small" | "big";
    gauge_width?: number;
    [key: string]: any;
};

export interface TertiaryEntity extends BaseEntityConfig {
    [key: string]: any;
}

export interface GaugeElementConfig {
    width?: number;
    color?: string | "adaptive";
    opacity?: number;
};

export type GaugeType = "standard" | "half" | "full";

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    attribute?: string;
    name?: string;
    icon?: string;
    icon_entity?: "primary" | "secondary" | "tertiary";
    icon_size?: number;
    icon_vertical_position?: number;
    min?: number | string;
    max?: number | string;
    show_seconds?: boolean;
    gauge_type?: GaugeType;
    unit?: string;
    label?: string;
    label_font_size?: number;
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
    gauge_radius?: number;
    gauge_background_style?: GaugeElementConfig;
    gauge_foreground_style?: GaugeElementConfig;
    segments?: SegmentsConfig[];
    secondary?: SecondaryEntity | string;
    tertiary?: TertiaryEntity | string;
    secondary_entity?: SecondaryEntity; // Unused
}