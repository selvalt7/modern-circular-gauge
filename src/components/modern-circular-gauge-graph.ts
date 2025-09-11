import { LitElement, TemplateResult, html, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { isComponentLoaded } from "../ha/common/config/is_component_loaded";
import { subscribeHistoryStatesTimeWindow } from "../ha/data/history";
import { MCGGraphConfig } from "./type";
import { DEFAULT_MAX, DEFAULT_MIN } from "../const";
import { EntityNames, SegmentsConfig } from "../card/type";
import { valueToPercentage } from "../utils/gauge";
import { ifDefined } from "lit/directives/if-defined.js";

const DEFAULT_HOURS_TO_SHOW = 24;

@customElement("modern-circular-gauge-graph")
export class ModernCircularGaugeGraph extends LitElement {
  @property({ attribute: false, hasChanged: () => false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public config?: MCGGraphConfig;

  @state() private _coordinates?: Map<EntityNames, [number, number][]> = new Map();

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.config) {
      this._subscribeHistory();
    }
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
      const segmentsGradient = this._computeGradient(entityConfig?.segments ?? [], entityConfig?.min ?? DEFAULT_MIN, entityConfig?.max ?? DEFAULT_MAX);

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
          <rect height="16%" width="38%" fill=${ifDefined(segmentsGradient.length ? `url(#${entity}-grad)`: undefined)} mask="url(#${entity.concat("-line")})"></rect>
        </g>
      `);
    });

    return html`
    <svg viewBox="-31 -18 100 100" preserveAspectRatio="xMidYMid">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="38%" y2="0%">
          <stop offset="0%" stop-color="black" />
          <stop offset="20%" stop-color="white" />
          <stop offset="80%" stop-color="white" />
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

       return [...sortedSegments].map((segment, index) => {
        const offset = valueToPercentage(Number(segment.from), min ?? DEFAULT_MIN, max ?? DEFAULT_MAX) * 100;
        const color = typeof segment.color === "object" ? `rgb(${segment.color[0]},${segment.color[1]},${segment.color[2]})` : segment.color;
        let hardStop: TemplateResult | undefined;
        if (sortedSegments[index + 1] && !this.config?.smooth_segments) {
          const nextOffset = valueToPercentage(Number(sortedSegments[index + 1].from), min ?? DEFAULT_MIN, max ?? DEFAULT_MAX) * 100;
          hardStop = svg`<stop offset="${nextOffset}%" stop-color="${color}" />`;
        }
        return svg`<stop offset="${offset}%" stop-color="${color}" />${hardStop || ""}`;
      });
    }
    return [];
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
            history,
            hourToShow,
            38,
            2,
            { min: entity.min, max: entity.max }
          ) || []);
        });
        this.requestUpdate();
      },
      hourToShow,
      entities,
      false
    );
  }

  private _calcCoordinates(history: any, hours: number, width: number, detail: number, limits: { min?: number, max?: number }): [number, number][] | undefined {
    history = history.filter((item) => !Number.isNaN(item.state));

    const min =
      limits?.min !== undefined
        ? limits.min
        : Math.min(...history.map((item) => item.state));
    const max =
      limits?.max !== undefined
        ? limits.max
        : Math.max(...history.map((item) => item.state));
    const now = new Date().getTime();

    const reduce = (res, item, point) => {
      const age = now - new Date(item.last_changed).getTime();

      let key = Math.abs(age / (1000 * 3600) - hours);
      if (point) {
        key = (key - Math.floor(key)) * 60;
        key = Number((Math.round(key / 10) * 10).toString()[0]);
      } else {
        key = Math.floor(key);
      }
      if (!res[key]) {
        res[key] = [];
      }
      res[key].push(item);
      return res;
    };

    history = history.reduce((res, item) => reduce(res, item, false), []);
    if (detail > 1) {
      history = history.map((entry) =>
        entry.reduce((res, item) => reduce(res, item, true), [])
      );
    }

    if (!history.length) {
      return undefined;
    }

    return this._calcPoints(history, hours, width, detail, min, max);
  }

  private _average(items: any[]): number {
    return items.reduce((sum, entry) => sum + parseFloat(entry.state), 0) / items.length;
  }

  private _lastValue(items: any[]): number {
    return parseFloat(items[items.length - 1].state) || 0;
  }

  private _calcPoints(history: any, hours: number, width: number, detail: number, min: number, max: number): [number, number][] {
    const coords = [] as [number, number][];
    const height = 14;
    const strokeWidth = 4;
    let yRatio = (max - min) / height;
    yRatio = yRatio !== 0 ? yRatio : height;
    let xRatio = width / (hours - (detail === 1 ? 1 : 0));
    xRatio = isFinite(xRatio) ? xRatio : width;

    let first = history.filter(Boolean)[0];
    if (detail > 1) {
      first = first.filter(Boolean)[0];
    }
    let last = [this._average(first), this._lastValue(first)];

    const getY = (value: number): number =>
      height + strokeWidth / 2 - (value - min) / yRatio;

    const getCoords = (item: any[], i: number, offset = 0, depth = 1) => {
      if (depth > 1 && item) {
        return item.forEach((subItem, index) =>
          getCoords(subItem, i, index, depth - 1)
        );
      }

      const x = xRatio * (i + offset / 6);

      if (item) {
        last = [this._average(item), this._lastValue(item)];
      }
      const y = getY(item ? last[0] : last[1]);
      return coords.push([x, y]);
    };

    for (let i = 0; i < history.length; i += 1) {
      getCoords(history[i], i, 0, detail);
    }

    coords.push([width, getY(last[1])]);
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
      /* fill: var(--gauge-color); */
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