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
import { ActionHandlerEvent, hasAction } from "custom-card-helpers";
import { handleAction } from "../ha/handle-action";
import { actionHandler } from "../utils/action-handler-directive";
import { mdiAlertCircle } from "@mdi/js";
import { rgbToHex } from "../utils/color";

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

  public static async getConfigElement(): Promise<HTMLElement> {
    await import("./gauge-badge-editor");
    return document.createElement("modern-circular-gauge-badge-editor");
  }

  setConfig(config: ModernCircularGaugeBadgeConfig): void {
    if (!config.entity) {
      throw new Error("Entity must be specified");
    }

    this._config = { min: DEFAULT_MIN, max: DEFAULT_MAX, show_state: true, ...config };
  }

  get hasAction() {
    return (
      !this._config?.tap_action ||
      hasAction(this._config?.tap_action) ||
      hasAction(this._config?.hold_action) ||
      hasAction(this._config?.double_tap_action)
    );
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

    if (!stateObj) {
      return html`
        <ha-badge .label=${this._config.entity} class="error">
          <ha-svg-icon
            slot="icon"
            .hass=${this.hass}
            .path=${mdiAlertCircle}
          ></ha-svg-icon>
          ${this.hass.localize("ui.badge.entity.not_found")}
        </ha-badge>
      `;
    }

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
      .type=${this.hasAction ? "button" : "badge"}
      @action=${this._handleAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config.hold_action),
        hasDoubleClick: hasAction(this._config.double_tap_action),
      })}
      .iconOnly=${!this._config.show_name}
      style=${styleMap({ "--gauge-color": this._computeSegments(numberState) })}
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

  private _computeSegments(numberState: number): string | undefined {
    let segments = this._config?.segments;
    if (segments) {
      segments = [...segments].sort((a, b) => a.from - b.from);

      for (let i = 0; i < segments.length; i++) {
        let segment = segments[i];
        if (segment && (numberState >= segment.from || i === 0) &&
          (i + 1 == segments?.length || numberState < segments![i + 1].from)) {
            const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
            return color;
        }
      }
    }
    return undefined;
  }

  private _calcStateSize(state: string): string {
    const initialSize = 25;
    if (state.length >= 4) {
      return `${initialSize - (state.length - 3)}px`
    }
    return `${initialSize}px`;
  }

  private _handleAction(ev: ActionHandlerEvent) {
    handleAction(this, this.hass!, this._config!, ev.detail.action!);
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
      width: calc(var(--ha-badge-size, 36px) - 2px);
      height: var(--ha-badge-size, 36px);
      margin-left: -12px;
      margin-inline-start: -12px;
      pointer-events: none;
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
      --badge-color: var(--gauge-color)
    }

    ha-badge.error {
      --badge-color: var(--red-color);
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