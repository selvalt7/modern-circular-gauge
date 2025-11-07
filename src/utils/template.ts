const isTemplateRegex = /{%|{{/;
export const isJSTemplateRegex = /^\s*\[\[\[([\s\S]+)\]\]\]\s*$/;

export const isTemplate = (value: string): boolean => isTemplateRegex.test(value) || isJSTemplateRegex.test(value);
export const isJSTemplate = (value: string): boolean => isJSTemplateRegex.test(value);
