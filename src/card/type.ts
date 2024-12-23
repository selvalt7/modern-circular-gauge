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
};

export interface ModernCircularGaugeConfig extends LovelaceCardConfig {
    entity: string;
    name?: string;
    min?: number | string;
    max?: number | string;
    unit?: string;
    header_position?: "top" | "bottom";
    needle?: boolean;
    segments?: SegmentsConfig[];
    secondary?: SecondaryEntity | string;
    secondary_entity?: SecondaryEntity;
}