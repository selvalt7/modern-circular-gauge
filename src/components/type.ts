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