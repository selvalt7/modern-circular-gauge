export const DEFAULT_MIN = 0;
export const DEFAULT_MAX = 100;
export const MAX_ANGLE = 270; // Standard gauge angle
export const HALF_ANGLE = 180; // Half gauge
export const FULL_ANGLE = 359.99; // Full gauge

export const GAUGE_TYPE_ANGLES: Record<string, number> = {
  standard: MAX_ANGLE,
  half: HALF_ANGLE,
  full: FULL_ANGLE,
};

export const RADIUS = 47;
export const INNER_RADIUS = 42;
export const TERTIARY_RADIUS = 37;

export const NUMBER_ENTITY_DOMAINS = ["sensor", "number", "counter", "input_number"];