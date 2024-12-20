const isTemplateRegex = /{%|{{/;

export const isTemplate = (value: string): boolean => isTemplateRegex.test(value);
