const isTemplateRegex = /{%|{{/;
export const JSTemplateRegex = /^\s*\[\[\[([\s\S]+)\]\]\]\s*$/;
const isJSTemplateRegex = /\[\[\[/;

export const isTemplate = (value: string): boolean => isTemplateRegex.test(value) || JSTemplateRegex.test(value) || isJSTemplateRegex.test(value);
export const isJSTemplate = (value: string): boolean => isJSTemplateRegex.test(value);
