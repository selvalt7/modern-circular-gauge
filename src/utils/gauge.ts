import { TemplateResult, svg } from "lit";
import { MAX_ANGLE } from "../const";
import type { SegmentsConfig } from "../card/type";
import { rgbToHex } from "./color";
import { interpolateRgb } from "d3-interpolate";

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

export function renderSegments(segments: SegmentsConfig[], min: number, max: number, radius: number, smooth_segments: boolean | undefined): TemplateResult[] {
  if (segments) {
    let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));

    if (smooth_segments) {
      let gradient: string = "";
      sortedSegments.map((segment, index) => {
        const angle = getAngle(Number(segment.from), min, max) + 45;
        const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
        gradient += `${color} ${angle}deg${index != sortedSegments.length - 1 ? "," : ""}`;
      });
      return [svg`
        <foreignObject x="-50" y="-50" width="100%" height="100%" transform="rotate(45)">
          <div style="width: 100px; height: 100px; background-image: conic-gradient(${gradient})">
          </div>
        </foreignObject>
      `];
    } else {
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
          roundEnd = svg`
          <path
            class="segment"
            stroke=${color}
            d=${endPath}
            stroke-linecap="round"
          />`;
        }

        return svg`${roundEnd}
          <path
            class="segment"
            stroke=${color}
            d=${segmentPath}
          />`;
      });
    }
  }
  return [];
}

export function computeSegments(numberState: number, segments: SegmentsConfig[] | undefined, smooth_segments: boolean | undefined): string | undefined {
  if (segments) {
    let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));
    
    for (let i = 0; i < sortedSegments.length; i++) {
      let segment = sortedSegments[i];
      if (segment && (numberState >= Number(segment.from) || i === 0) &&
        (i + 1 == sortedSegments?.length || numberState < Number(sortedSegments![i + 1].from))) {
          if (smooth_segments) {
            const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
            const nextSegment = sortedSegments[i + 1] ? sortedSegments[i + 1] : segment;
            const nextColor = typeof nextSegment.color === "object" ? rgbToHex(nextSegment.color) : nextSegment.color;
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
