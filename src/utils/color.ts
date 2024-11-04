
export const rgbToHex = (rgb: [number, number, number]): string => {
    if (!rgb)
        return "";

    return "#".concat(rgb.map(x => x.toString(16).padStart(2, "0")).join(""));
};

export const hexToRgb = (hex: string): [number, number, number] => {
    if (!hex.startsWith("#")) return hex as any;
    hex = hex.replace("#", "");

    return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
    ];
};