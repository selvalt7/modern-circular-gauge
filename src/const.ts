export const DEFAULT_MIN = 0;
export const DEFAULT_MAX = 100;
export const MAX_ANGLE = 270; // Standard gauge angle
export const HALF_ANGLE = 180; // Half gauge
export const FULL_ANGLE = 359; // Full gauge

export const GAUGE_TYPE_ANGLES: Record<string, number> = {
  standard: MAX_ANGLE,
  half: HALF_ANGLE,
  full: FULL_ANGLE,
};

export const RADIUS = 47;
export const INNER_RADIUS = 42;
export const TERTIARY_RADIUS = 37;

export const NUMBER_ENTITY_DOMAINS = ["sensor", "number", "counter", "input_number", "timer"];
export const TIMESTAMP_STATE_DOMAINS = ["button", "input_button", "scene"];

export const NON_NUMERIC_ATTRIBUTES = [
  "access_token",
  "auto_update",
  "available_modes",
  "away_mode",
  "changed_by",
  "code_format",
  "color_modes",
  "current_activity",
  "device_class",
  "editable",
  "effect_list",
  "effect",
  "entity_picture",
  "event_type",
  "event_types",
  "fan_mode",
  "fan_modes",
  "fan_speed_list",
  "forecast",
  "friendly_name",
  "frontend_stream_type",
  "has_date",
  "has_time",
  "hs_color",
  "hvac_mode",
  "hvac_modes",
  "icon",
  "media_album_name",
  "media_artist",
  "media_content_type",
  "media_position_updated_at",
  "media_title",
  "next_dawn",
  "next_dusk",
  "next_midnight",
  "next_noon",
  "next_rising",
  "next_setting",
  "operation_list",
  "operation_mode",
  "options",
  "preset_mode",
  "preset_modes",
  "release_notes",
  "release_summary",
  "release_url",
  "restored",
  "rgb_color",
  "rgbw_color",
  "shuffle",
  "sound_mode_list",
  "sound_mode",
  "source_list",
  "source_type",
  "source",
  "state_class",
  "supported_features",
  "swing_mode",
  "swing_mode",
  "swing_modes",
  "title",
  "token",
  "unit_of_measurement",
  "xy_color",
];