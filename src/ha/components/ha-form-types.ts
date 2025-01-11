
export interface HaFormBaseSchema {
  name: string;
  // This value is applied if no data is submitted for this field
  default?: HaFormData;
  required?: boolean;
  disabled?: boolean;
  description?: {
    suffix?: string;
    // This value will be set initially when form is loaded
    suggested_value?: HaFormData;
  };
  context?: Record<string, string>;
}

export interface HaFormDataContainer {
  [key: string]: HaFormData;
}

export type HaFormData =
  | HaFormStringData
  | HaFormIntegerData
  | HaFormFloatData
  | HaFormBooleanData
  | HaFormSelectData
  | HaFormMultiSelectData

export type HaFormStringData = string;
export type HaFormIntegerData = number;
export type HaFormFloatData = number;
export type HaFormBooleanData = boolean;
export type HaFormSelectData = string;
export type HaFormMultiSelectData = string[];