import { LitElement, TemplateResult, html, css, nothing } from "lit";
import { HomeAssistant } from "../ha/types";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { customElement, property, state } from "lit/decorators.js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX } from "../const";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { registerCustomBadge } from "../utils/custom-badges";
import { HassEntity } from "home-assistant-js-websocket";
import { styleMap } from "lit/directives/style-map.js";
import { svgArc, clamp } from "../utils/gauge";
import { classMap } from "lit/directives/class-map.js";

const MAX_ANGLE = 270;
const ROTATE_ANGLE = 360 - MAX_ANGLE / 2 - 90;
const RADIUS = 42;

registerCustomBadge({
  type: "modern-circular-gauge-badge",
  name: "Modern Circular Gauge Badge",
  description: "Modern circular gauge badge",
});

@customElement("modern-circular-gauge-badge")
export class ModernCircularGaugeBadge extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeBadgeConfig;

  public static async getStubConfig(hass: HomeAssistant): Promise<ModernCircularGaugeBadgeConfig> {
    const entities = Object.keys(hass.states);
    const numbers = entities.filter((e) =>
      NUMBER_ENTITY_DOMAINS.includes(e.split(".")[0])
    );
    return {
      type: "custom:modern-circular-gauge-badge",
      entity: numbers[0],
    };
  }

  setConfig(config: ModernCircularGaugeBadgeConfig): void {
    if (!config.entity) {
      throw new Error("Entity must be specified");
    }

    this._config = { min: DEFAULT_MIN, max: DEFAULT_MAX, ...config };
  }

  private _strokeDashArc(from: number, to: number): [string, string] {
    const start = this._valueToPercentage(from);
    const end = this._valueToPercentage(to);

    const track = (RADIUS * 2 * Math.PI * MAX_ANGLE) / 360;
    const arc = Math.max((end - start) * track, 0);
    const arcOffset = start * track - 0.5;

    const strokeDasharray = `${arc} ${track - arc}`;
    const strokeDashOffset = `-${arcOffset}`;
    return [strokeDasharray, strokeDashOffset];
  }

  private _valueToPercentage(value: number) {
    return (clamp(value, this._config?.min ?? DEFAULT_MIN, this._config?.max ?? DEFAULT_MAX) - (this._config?.min ?? DEFAULT_MIN))
    / ((this._config?.max ?? DEFAULT_MAX) - (this._config?.min ?? DEFAULT_MIN));
  }

  private _getAngle(value: number) {
    return this._valueToPercentage(value) * MAX_ANGLE;
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    const stateObj = this.hass.states[this._config.entity];

    const path = svgArc({
      x: 0,
      y: 0,
      start: 0,
      end: MAX_ANGLE,
      r: RADIUS,
    });

    const attributes = stateObj.attributes;

    const numberState = Number(stateObj.state);

    const unit = this._config.unit ?? stateObj.attributes.unit_of_measurement;

    const current = this._strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0);
    const state = stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj.entity_id]));

    const name = this._config.name || stateObj.attributes.friendly_name;
    const label = this._config.show_name ? name : undefined;

    return html`
    <ha-badge
      .iconOnly=${!this._config.show_name}
    >
      <div class=${classMap({ "container": true, "icon-only": !this._config.show_name })} slot="icon">
        <svg class="gauge" viewBox="-50 -50 100 100">
          <g transform="rotate(${ROTATE_ANGLE})">
            <path
              class="arc clear"
              d=${path}
            />
            <path
              class="arc current"
              d=${path}
              stroke-dasharray="${current[0]}"
              stroke-dashoffset="${current[1]}"
            />
          </g>
        </svg>
        ${this._config.show_state ? html`
          <svg class="state" viewBox="-50 -50 100 100">
          <text class="value" style=${styleMap({ "font-size": this._calcStateSize(entityState) })}>
            ${entityState}
            <tspan class="unit" baseline-shift="super" dx="-4">${unit}</tspan>
          </text>
        </svg>
          ` : nothing}
      </div>
      ${label}
    </ha-badge>
    `;
  }

  private _calcStateSize(state: string): string {
    const initialSize = 25;
    if (state.length >= 7) {
      return `${initialSize - (state.length - 5)}px`
    }
    return `${initialSize}px`;
  }

  static get styles() {
    return css`
    :host {
      --gauge-color: var(--primary-color);
      --gauge-stroke-width: 14px;
    }

    .badge::slotted([slot=icon]) {
      margin-left: 0;
      margin-right: 0;
      margin-inline-start: 0;
      margin-inline-end: 0;
    }

    .state {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      text-anchor: middle;
    }

    .value {
      font-size: 21px;
      fill: var(--primary-text-color);
      alignment-baseline: middle;
    }

    .unit {
      font-size: .43em;
      opacity: 0.6;
    }

    .container {
      position: relative;
      container-type: normal;
      container-name: container;
      width: var(--ha-badge-size, 36px);
      height: var(--ha-badge-size, 36px);
      margin-left: -12px;
      margin-inline-start: -12px;
    }

    .container.icon-only {
      margin-left: 0;
      margin-inline-start: 0;
    }

    ha-badge {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    g {
      fill: none;
    }
    .arc {
      fill: none;
      stroke-linecap: round;
      stroke-width: var(--gauge-stroke-width);
    }

    .arc.clear {
      stroke: var(--primary-background-color);
    }

    .arc.current {
      stroke: var(--gauge-color);
      transition: all 1s ease 0s;
    }
    `
  }
}