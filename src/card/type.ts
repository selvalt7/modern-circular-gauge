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
    decimals?: number;
    needle?: boolean;
    show_seconds?: boolean;
    show_gauge?: "none" | "inner" | "outter" | "outer";
    show_state?: boolean;
    show_unit?: boolean;
    show_in_graph?: boolean;
    adaptive_graph_range?: boolean;
    state_text?: string;
    state_font_size?: number;
    state_font_family?: string;
    start_from_zero?: boolean;
    inverted_mode?: boolean;
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

export type EntityNames = "primary" | "secondary" | "tertiary";

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    attribute?: string;
    name?: string;
    icon?: string;
    icon_entity?: "primary" | "secondary" | "tertiary";
    icon_size?: number;
    icon_vertical_position?: number;
    show_entity_picture?: boolean;
    min?: number | string;
    max?: number | string;
    show_seconds?: boolean;
    combine_gauges?: boolean;
    gauge_type?: GaugeType;
    rotate_gauge?: boolean;
    unit?: string;
    decimals?: number;
    label?: string;
    label_font_size?: number;
    header_position?: "top" | "bottom";
    show_state?: boolean;
    show_header?: boolean;
    show_unit?: boolean;
    show_icon?: boolean;
    show_graph?: boolean;
    show_in_graph?: boolean;
    adaptive_graph_range?: boolean;
    graph_hours_to_show?: number;
    graph_points_per_hour?: number;
    needle?: boolean;
    state_text?: string;
    adaptive_icon_color?: boolean;
    adaptive_state_color?: boolean;
    smooth_segments?: boolean;
    state_font_size?: number;
    state_font_family?: string;
    header_font_size?: number;
    header_offset?: number;
    start_from_zero?: boolean;
    inverted_mode?: boolean;
    gauge_width?: number;
    gauge_radius?: number;
    gauge_background_style?: GaugeElementConfig;
    gauge_foreground_style?: GaugeElementConfig;
    segments?: SegmentsConfig[];
    secondary?: SecondaryEntity | string;
    tertiary?: TertiaryEntity | string;
    secondary_entity?: SecondaryEntity; // Unused
}