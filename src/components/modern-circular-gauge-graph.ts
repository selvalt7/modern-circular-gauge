import { LitElement, TemplateResult, html, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { isComponentLoaded } from "../ha/common/config/is_component_loaded";
import { subscribeHistoryStatesTimeWindow } from "../ha/data/history";
import { MCGGraphConfig } from "./type";
import { DEFAULT_MAX, DEFAULT_MIN } from "../const";
import { EntityNames, SegmentsConfig } from "../card/type";
import { valueToPercentage, valueToPercentageUnclamped } from "../utils/gauge";
import { styleMap } from "lit/directives/style-map.js";

const DEFAULT_HOURS_TO_SHOW = 24;
const DEFAULT_POINTS_PER_HOUR = 2;

@customElement("modern-circular-gauge-graph")
export class ModernCircularGaugeGraph extends LitElement {
  @property({ attribute: false, hasChanged: () => false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public config?: MCGGraphConfig;

  @state() private _coordinates?: Map<EntityNames, [number, number][]> = new Map();

  private _subscribed?: Promise<(() => Promise<void>) | undefined>;

  private _limits?: Map<EntityNames, { min?: number, max?: number }> = new Map();

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.config) {
      this._subscribed = this._subscribeHistory();
    }
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribeHistory();
  }

  protected render(): TemplateResult {
    if (!this._coordinates) {
      return html``;
    }
    let graphs: TemplateResult[] = [];

    this._coordinates.forEach((coords, entity) => {
      if (coords.length === 0) {
        return;
      }

      const path = this._getPath(coords);
      const entityConfig = this.config?.entitys?.get(entity);
      const segmentsGradient = this._computeGradient(entityConfig?.segments ?? [], this._limits?.get(entity)?.min ?? DEFAULT_MIN, this._limits?.get(entity)?.max ?? DEFAULT_MAX);

      graphs.push(svg`
        <g class=${entity} mask="url(#gradient)">
          ${segmentsGradient.length ? svg`
            <linearGradient id=${entity.concat("-grad")} x1="0%" y1="1" x2="0%" y2="0">
              ${segmentsGradient}
            </linearGradient>
          ` : nothing}
          <mask id=${entity.concat("-line")}>
            <path
              vector-effect="non-scaling-stroke"
              class='line'
              fill="none"
              stroke="white"
              stroke-width="4"
              stroke-linecap="round"
              stroke-linejoin="round"
              d=${path}
            ></path>
          </mask>
          <rect height="16%" width="38%" style=${styleMap({ "fill": segmentsGradient.length ? `url(#${entity}-grad)`: undefined })} mask="url(#${entity.concat("-line")})"></rect>
        </g>
      `);
    });

    return html`
    <svg viewBox="-31 -18 100 100" preserveAspectRatio="xMidYMid">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="38%" y2="0%">
          <stop offset="0%" stop-color="black" />
          <stop offset="10%" stop-color="white" />
          <stop offset="90%" stop-color="white" />
          <stop offset="100%" stop-color="black" />
        </linearGradient>
        <mask id="gradient">
          <rect x="0" y="0" width="100" height="100" fill="url(#grad)"/>
        </mask>
      </defs>
      ${graphs}
    </svg>
    `;
  }

  private _computeGradient(segments: SegmentsConfig[], min: number, max: number): TemplateResult[] {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));
      const height = 16;
      const strokeWidth = 4;
      const halfStrokeWidth = strokeWidth / 2;

      return [...sortedSegments].map((segment, index) => {
        const offset = this._remapValue(valueToPercentageUnclamped(Number(segment.from), min ?? DEFAULT_MIN, max ?? DEFAULT_MAX), 0.0, 1.0, halfStrokeWidth / height, (height - halfStrokeWidth) / height) * 100;
        const color = typeof segment.color === "object" ? `rgb(${segment.color[0]},${segment.color[1]},${segment.color[2]})` : segment.color;
        let hardStop: TemplateResult | undefined;
        if (sortedSegments[index + 1] && !this.config?.smooth_segments) {
          const nextOffset = this._remapValue(valueToPercentageUnclamped(Number(sortedSegments[index + 1].from), min ?? DEFAULT_MIN, max ?? DEFAULT_MAX), 0.0, 1.0, halfStrokeWidth / height, (height - halfStrokeWidth) / height) * 100;
          hardStop = svg`<stop offset="${nextOffset}%" stop-color="${color}" />`;
        }
        return svg`<stop offset="${offset}%" stop-color="${color}" />${hardStop || ""}`;
      });
    }
    return [];
  }

  private _remapValue(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    const newRange = ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    return newRange;
  }

  private async _subscribeHistory(): Promise<() => Promise<void>> { 
    const entities = Array.from(this.config?.entitys?.values() || []).map((e) => e.entity);
    if (!isComponentLoaded(this.hass!, "history") || !this.config || !this.config?.entitys) {
      return () => Promise.resolve();
    }

    const hourToShow = this.config.hours_to_show ?? DEFAULT_HOURS_TO_SHOW;
    
    return subscribeHistoryStatesTimeWindow(
      this.hass!,
      (historyStates) => {
        if (!historyStates) {
          return undefined;
        }
        this.config?.entitys?.forEach((entity, entityName) => {
          if (!entity.entity) {
            this._coordinates?.delete(entityName);
            return;
          }
          if (!historyStates[entity.entity]) {
            this._coordinates?.delete(entityName);
            return;
          }
          const history = historyStates[entity.entity].map((item) => ({
            state: Number(item.s),
            last_changed: item.lu * 1000,
          }));

          this._coordinates?.set(entityName, this._calcCoordinates(
            entityName,
            history,
            hourToShow,
            38,
            Math.max(0, this.config?.points_per_hour ?? DEFAULT_POINTS_PER_HOUR),
            { min: entity.adaptive_range ? undefined : entity.min, max: entity.adaptive_range ? undefined : entity.max }
          ) || []);
        });
        this.requestUpdate();
      },
      hourToShow,
      entities,
      false
    );
  }

  private _unsubscribeHistory() {
    if (this._subscribed) {
      this._subscribed.then((unsub) => unsub?.());
      this._subscribed = undefined;
    }
  }

  private _calcCoordinates(entity: EntityNames, history: any, hours: number, width: number, detail: number, limits: { min?: number, max?: number }): [number, number][] | undefined {
    history = history.filter((item) => !Number.isNaN(item.state));

    const min =
      limits?.min !== undefined
        ? limits.min
        : Math.min(...history.map((item) => item.state));
    const max =
      limits?.max !== undefined
        ? limits.max
        : Math.max(...history.map((item) => item.state));

    this._limits?.set(entity, { min: min, max: max });

    const now = new Date().getTime();

    const graphStart = now - hours * 3600 * 1000;

    let initialValue: any = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].last_changed < graphStart) {
        initialValue = history[i];
        break;
      }
    }

    const totalPoints = Math.max(2, Math.ceil(hours * detail));
    const msPerBucket = (3600 * 1000) / detail;
    const buckets: any[][] = Array.from({ length: totalPoints }, () => []);

    for (const item of history) {
      const ageMs = now - item.last_changed;
      const bucketIdx = Math.floor((hours * 3600 * 1000 - ageMs) / msPerBucket);
      if (bucketIdx >= 0 && bucketIdx < totalPoints) {
        buckets[bucketIdx].push(item);
      }
    }

    if (initialValue) {
      buckets[0].unshift(initialValue);
    }

    if (!buckets.length) {
      return undefined;
    }

    return this._calcPoints(buckets, hours, width, detail, min, max);
  }

  private _average(items: any[]): number {
    if (!Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((sum, entry) => sum + parseFloat(entry.state), 0) / items.length;
  }

  private _lastValue(items: any[]): number {
    if (!Array.isArray(items) || items.length === 0) return 0;
    return parseFloat(items[items.length - 1].state) || 0;
  }

  private _calcPoints(history: any, hours: number, width: number, detail: number, min: number, max: number): [number, number][] {
    const coords = [] as [number, number][];
    const height = 12;
    const strokeWidth = 4;
    const totalPoints = Math.ceil(hours * detail);
    let yRatio = (max - min) / height;
    yRatio = yRatio !== 0 ? yRatio : height;
    let xRatio = width / Math.max(1, totalPoints - 1);
    xRatio = isFinite(xRatio) ? xRatio : width;

    const getY = (value: number): number =>
      Math.abs(valueToPercentage(value, min, max) - 1) * height + strokeWidth / 2;

    let lastValue = history.find(b => b.length)?.[0]?.state ?? min;
    for (let i = 0; i < history.length; i += 1) {
      let value;
      if (history[i].length) {
        value = this._average(history[i]);
        lastValue = value;
      } else {
        value = lastValue;
      }
      coords.push([xRatio * i, getY(value)]);
    }

    coords.push([width, getY(lastValue)]);
    return coords;
  }

  private _midPoint(
    _Ax: number,
    _Ay: number,
    _Bx: number,
    _By: number
  ): number[] {
    const zX = (_Ax - _Bx) / 2 + _Bx;
    const zY = (_Ay - _By) / 2 + _By;
    return [zX, zY];
  };

  private _getPath(coords: number[][]): string {
    if (!coords.length) {
      return "";
    }

    let next: number[];
    let Z: number[];
    const X = 0;
    const Y = 1;
    let path = "";
    let last = coords.filter(Boolean)[0];

    path += `M ${last[X]},${last[Y]}`;

    for (const coord of coords) {
      next = coord;
      Z = this._midPoint(last[X], last[Y], next[X], next[Y]);
      path += ` ${Z[X]},${Z[Y]}`;
      path += ` Q${next[X]},${next[Y]}`;
      last = next;
    }

    path += ` ${next![X]},${next![Y]}`;
    return path;
  }

  static get styles() {
    return css`
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    g {
      fill: none;
    }

    .primary rect {
      fill: var(--gauge-color);
    }
    .secondary rect {
      fill: var(--gauge-secondary-color, var(--gauge-color));
    }
    .tertiary rect {
      fill: var(--gauge-tertiary-color, var(--gauge-color));
    }
    `;
  }
}