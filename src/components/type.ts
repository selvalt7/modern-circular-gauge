import { EntityNames, SegmentsConfig } from "../card/type";
import { HaFormBaseSchema } from "../ha/components/ha-form-types";

export interface HaFormMCGListSchema extends HaFormBaseSchema {
  type: "mcg-list";
  flatten?: boolean;
  title?: string;
  icon?: string;
  iconPath?: string;
  expanded?: boolean;
  schema: readonly any[];
}

export interface HaFormMCGTemplateSchema extends HaFormBaseSchema {
  type: "mcg-template";
  label?: string;
  flatten?: boolean;
  schema?: readonly any[] | any;
}

interface MCGGraphEntity {
  entity: string;
  min: number;
  max: number;
  adaptive_range?: boolean;
  segments?: SegmentsConfig[];
}

export interface MCGGraphConfig {
  entitys?: Map<EntityNames, MCGGraphEntity>;
  hours_to_show?: number;
  smooth_segments?: boolean;
}