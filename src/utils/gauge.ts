import { TemplateResult, svg } from "lit";
import { MAX_ANGLE } from "../const";
import type { SegmentsConfig } from "../card/type";
import { rgbToHex } from "./color";
import { interpolateRgb } from "d3-interpolate";
import { DirectiveResult } from "lit/directive";
import { styleMap, StyleMapDirective } from "lit/directives/style-map.js";
import { ClassMapDirective } from "lit/directives/class-map";
import { ifDefined } from "lit/directives/if-defined.js";

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

export const strokeDashArc = (from: number, to: number, min: number, max: number, radius: number): [string, string] => {
  const start = valueToPercentage(from, min, max);
  const end = valueToPercentage(to, min, max);

  const track = (radius * 2 * Math.PI * MAX_ANGLE) / 360;
  const arc = Math.max((end - start) * track, 0);
  const arcOffset = start * track - 0.5;

  const strokeDasharray = `${arc} ${track - arc}`;
  const strokeDashOffset = `-${arcOffset}`;
  return [strokeDasharray, strokeDashOffset];
}

export const getAngle = (value: number, min: number, max: number) => {
  return valueToPercentage(isNaN(value) ? min : value, min, max) * MAX_ANGLE;
}

export const valueToPercentage = (value: number, min: number, max: number) => {
  return (clamp(value, min, max) - min) / (max - min);
}

export const currentDashArc = (value: number, min: number, max: number, radius: number, startFromZero?: boolean): [string, string] => {
  if (startFromZero) {
    return strokeDashArc(value > 0 ? 0 : value, value > 0 ? value : 0, min, max, radius);
  } else {
    return strokeDashArc(min, value, min, max, radius);
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

export function renderColorSegments(segments: SegmentsConfig[], min: number, max: number, radius: number, smooth_segments: boolean | undefined): TemplateResult[] {
  if (smooth_segments) {
    return renderSegmentsGradient(segments, min, max);
  } else {
    return renderSegments(segments, min, max, radius);
  }
}

export function renderSegmentsGradient(segments: SegmentsConfig[], min: number, max: number): TemplateResult[] {
  if (segments) {
    let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));
    let gradient: string = "";
    sortedSegments.map((segment, index) => {
      const angle = getAngle(Number(segment.from), min, max) + 45;
      const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
      gradient += `${color} ${angle}deg${index != sortedSegments.length - 1 ? "," : ""}`;
    });
    return [svg`
      <foreignObject x="-50" y="-50" width="100%" height="100%" overflow="visible" transform="rotate(45)">
        <div style="width: 110px; height: 110px; margin-left: -5px; margin-top: -5px; background-image: conic-gradient(${gradient})">
        </div>
      </foreignObject>
    `];
  }
  return [];
}


export function renderSegments(segments: SegmentsConfig[], min: number, max: number, radius: number): TemplateResult[] {
  if (segments) {
    let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));

    return [...sortedSegments].map((segment, index) => {
      let roundEnd: TemplateResult | undefined;
      const startAngle = index === 0 ? 0 : getAngle(Number(segment.from), min, max);
      const angle = index === sortedSegments.length - 1 ? MAX_ANGLE : getAngle(Number(sortedSegments[index + 1].from), min, max);
      const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
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
          start: index === 0 ? 0 : MAX_ANGLE,
          end: index === 0 ? 0 : MAX_ANGLE,
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
            let color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;

            if (color.includes("var(--") && element) {
              color = getComputedStyle(element).getPropertyValue(color.replace(/(var\()|(\))/g, "").trim());
            }

            const nextSegment = sortedSegments[i + 1] ? sortedSegments[i + 1] : segment;
            let nextColor = typeof nextSegment.color === "object" ? rgbToHex(nextSegment.color) : nextSegment.color;

            if (nextColor.includes("var(--") && element) {
              nextColor = getComputedStyle(element).getPropertyValue(nextColor.replace(/(var\()|(\))/g, "").trim());
            }

            return interpolateRgb(color, nextColor)(valueToPercentage(numberState, Number(segment.from), Number(nextSegment.from)));
          } else {
            const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
            return color;
          }
      }
    }
  }
  return undefined;
}
