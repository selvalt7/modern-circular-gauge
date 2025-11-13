import { TemplateResult, svg } from "lit";
import { MAX_ANGLE } from "../const";
import type { SegmentsConfig } from "../card/type";
import { interpolateColor, rgbToHex } from "./color";
import { DirectiveResult } from "lit/directive";
import { styleMap, StyleMapDirective } from "lit/directives/style-map.js";
import { ClassMapDirective } from "lit/directives/class-map";
import { ifDefined } from "lit/directives/if-defined.js";
import { computeCssColor } from "../ha/common/color/compute-color";

type Vector = [number, number];
type Matrix = [Vector, Vector];

const rotateVector = ([[a, b], [c, d]]: Matrix, [x, y]: Vector): Vector => [
  a * x + b * y,
  c * x + d * y,
];
const createRotateMatrix = (x: number): Matrix => [
  [Math.cos(x), -Math.sin(x)],
  [Math.sin(x), Math.cos(x)],
];
const addVector = ([a1, a2]: Vector, [b1, b2]: Vector): Vector => [
  a1 + b1,
  a2 + b2,
];

export const toRadian = (angle: number) => (angle / 180) * Math.PI;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type ArcOptions = {
  x: number;
  y: number;
  r: number;
  start: number;
  end: number;
  rotate?: number;
};

export const svgArc = (options: ArcOptions) => {
  const { x, y, r, start, end, rotate = 0 } = options;
  const cx = x;
  const cy = y;
  const rx = r;
  const ry = r;
  const t1 = toRadian(start);
  const t2 = toRadian(end);
  const delta = (t2 - t1) % (2 * Math.PI);
  const phi = toRadian(rotate);

  const rotMatrix = createRotateMatrix(phi);
  const [sX, sY] = addVector(
    rotateVector(rotMatrix, [rx * Math.cos(t1), ry * Math.sin(t1)]),
    [cx, cy]
  );
  const [eX, eY] = addVector(
    rotateVector(rotMatrix, [
      rx * Math.cos(t1 + delta),
      ry * Math.sin(t1 + delta),
    ]),
    [cx, cy]
  );
  const fA = delta > Math.PI ? 1 : 0;
  const fS = delta > 0 ? 1 : 0;

  return [
    "M",
    sX,
    sY,
    "A",
    rx,
    ry,
    (phi / (2 * Math.PI)) * 360,
    fA,
    fS,
    eX,
    eY,
  ].join(" ");
};

export const strokeDashArc = (from: number, to: number, min: number, max: number, radius: number, maxAngle: number = MAX_ANGLE, linePadding?: number, offset?: number, invertedMode?: boolean): [string, string] => {
  const start = valueToPercentage(from, min, max, from == to ? invertedMode : false);
  const end = valueToPercentage(to, min, max, invertedMode);

  const padding = linePadding ? linePadding : 0;
  const track = (radius * 2 * Math.PI * maxAngle) / 360;
  const arc = Math.max(((end - start) * track) - padding, 0);
  const arcOffset = start * track - 0.5;

  const strokeDasharray = `${arc} ${(track - arc) + padding}`;
  const strokeDashOffset = `-${arcOffset + (offset ?? 0)}`;
  return [strokeDasharray, strokeDashOffset];
}

export const getAngle = (value: number, min: number, max: number, maxAngle: number = MAX_ANGLE, invertedMode?: boolean) => {
  return valueToPercentage(isNaN(value) ? min : value, min, max, invertedMode) * maxAngle;
}

export const valueToPercentage = (value: number, min: number, max: number, invertedMode?: boolean) => {
  if (invertedMode) {
    return 1 - ((clamp(value, min, max) - min) / (max - min));
  } else {
    return (clamp(value, min, max) - min) / (max - min);
  }
}

export const valueToPercentageUnclamped = (value: number, min: number, max: number) => {
  return (value - min) / (max - min);
}

export const currentDashArc = (value: number, min: number, max: number, radius: number, startFromZero?: boolean, maxAngle: number = MAX_ANGLE, linePadding?: number, offset?: number, invertedMode?: boolean): [string, string] => {
  if (startFromZero) {
    return strokeDashArc(value > 0 ? 0 : value, value > 0 ? value : 0, min, max, radius, maxAngle, linePadding, offset, invertedMode);
  } else {
    return strokeDashArc(min, value, min, max, radius, maxAngle, linePadding, offset, invertedMode);
  }
}

export function renderPath(pathClass: DirectiveResult<typeof ClassMapDirective>, d: string, strokeDash: [string, string] | undefined = undefined, style: DirectiveResult<typeof StyleMapDirective> | undefined = undefined): TemplateResult {
  return svg`
    <path
      class="${pathClass}"
      d=${d}
      stroke-dasharray=${ifDefined(strokeDash ? strokeDash[0] : undefined)}
      stroke-dashoffset=${ifDefined(strokeDash ? strokeDash[1] : undefined)}
      style=${ifDefined(style)}
    />`;
}

export function renderColorSegments(segments: SegmentsConfig[], min: number, max: number, radius: number, smooth_segments: boolean | undefined, maxAngle: number = MAX_ANGLE): TemplateResult[] {
  if (smooth_segments) {
    return renderSegmentsGradient(segments, min, max, maxAngle);
  } else {
    return renderSegments(segments, min, max, radius, maxAngle);
  }
}

export function renderSegmentsGradient(segments: SegmentsConfig[], min: number, max: number, maxAngle: number = MAX_ANGLE): TemplateResult[] {
  if (segments) {
    let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));
    let gradient: string = "";
    const angleOffset = maxAngle == 180 ? 0 : (maxAngle > 359 ? 0 : 45);
    const rotateAngle = maxAngle == 180 ? 180 : (maxAngle > 359 ? 90 : 45);
    if (maxAngle == 180) {
      gradient = "from 0.75turn at 50% 97%,";
    }
    sortedSegments.map((segment, index) => {
      const angle = getAngle(Number(segment.from), min, max, maxAngle) + angleOffset;
      const color = typeof segment.color === "object" ? rgbToHex(segment.color) : computeCssColor(segment.color);
      gradient += `${color} ${angle}deg${index != sortedSegments.length - 1 ? "," : ""}`;
    });
    return [svg`
      <foreignObject x="-55" y="-55" width="110%" height=${maxAngle == 180 ? "120%" : "110%"} overflow="visible" transform="rotate(${rotateAngle})">
        <div style=${styleMap({ "width": "110px", "height": maxAngle == 180 ? "60px" : "110px", "background-image": `conic-gradient(${gradient})` })}>
        </div>
      </foreignObject>
    `];
  }
  return [];
}


export function renderSegments(segments: SegmentsConfig[], min: number, max: number, radius: number, maxAngle: number = MAX_ANGLE): TemplateResult[] {
  if (segments) {
    let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));

    return [...sortedSegments].map((segment, index) => {
      let roundEnd: TemplateResult | undefined;
      const startAngle = index === 0 ? 0 : getAngle(Number(segment.from), min, max, maxAngle);
      const angle = index === sortedSegments.length - 1 ? maxAngle : getAngle(Number(sortedSegments[index + 1].from), min, max, maxAngle);
      const color = typeof segment.color === "object" ? rgbToHex(segment.color) : computeCssColor(segment.color);
      const segmentPath = svgArc({
        x: 0,
        y: 0,
        start: startAngle,
        end: angle,
        r: radius,
      });

      if (index === 0 || index === sortedSegments.length - 1) {
        const endPath = svgArc({
          x: 0,
          y: 0,
          start: index === 0 ? 0 : maxAngle,
          end: index === 0 ? 0 : maxAngle,
          r: radius,
        });
        roundEnd = renderPath("segment", endPath, undefined, styleMap({ "stroke": color, "stroke-linecap": "round" }));
      }

      return svg`${roundEnd}
        ${renderPath("segment", segmentPath, undefined, styleMap({ "stroke": color }))}
      `;
    });
  }
  return [];
}

export function computeSegments(numberState: number, segments: SegmentsConfig[] | undefined, smooth_segments: boolean | undefined, element?: Element): string | undefined {
  if (segments) {
    let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));
    
    for (let i = 0; i < sortedSegments.length; i++) {
      let segment = sortedSegments[i];
      if (segment && (numberState >= Number(segment.from) || i === 0) &&
        (i + 1 == sortedSegments?.length || numberState < Number(sortedSegments![i + 1].from))) {
          if (smooth_segments) {
            let color = typeof segment.color === "object" ? rgbToHex(segment.color) : computeCssColor(segment.color);

            if (color.includes("var(--") && element) {
              color = getComputedStyle(element).getPropertyValue(color.replace(/(var\()|(\))/g, "").trim());
            }

            const nextSegment = sortedSegments[i + 1] ? sortedSegments[i + 1] : segment;
            let nextColor = typeof nextSegment.color === "object" ? rgbToHex(nextSegment.color) : computeCssColor(nextSegment.color);

            if (nextColor.includes("var(--") && element) {
              nextColor = getComputedStyle(element).getPropertyValue(nextColor.replace(/(var\()|(\))/g, "").trim());
            }

            return interpolateColor(color, nextColor, valueToPercentage(numberState, Number(segment.from), Number(nextSegment.from)));
          } else {
            const color = typeof segment.color === "object" ? rgbToHex(segment.color) : computeCssColor(segment.color);
            return color;
          }
      }
    }
  }
  return undefined;
}
