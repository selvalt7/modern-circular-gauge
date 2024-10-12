import { html, LitElement, TemplateResult, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { clamp, svgArc } from "./utils";
import type { ModernCircularGaugeConfig } from "./type";

const MAX_ANGLE = 270;
const ROTATE_ANGLE = 360 - MAX_ANGLE / 2 - 90;
const RADIUS = 40;

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

@customElement("modern-circular-gauge")
export class ModernCircularGauge extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeConfig;

  setConfig(config: ModernCircularGaugeConfig): void {
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

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    const stateObj = this.hass.states[this._config.entity];

    if (!stateObj) {
      return html``;
    }

    const path = svgArc({
      x: 0,
      y: 0,
      start: 0,
      end: MAX_ANGLE,
      r: RADIUS,
    });

    const state = stateObj.state;
    const unit = this._config.unit ?? stateObj.attributes.unit_of_measurement;

    const current = this._strokeDashArc(state > 0 ? 0 : state, state > 0 ? state : 0);

    return html`
    <ha-card>
      <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid">
        <g transform="rotate(135)">
          <path
            class="arc clear"
            d=${path}
          />
          <path
            class="arc current"
            style="stroke: green"
            d=${path}
            stroke-dasharray="${current[0]}"
            stroke-dashoffset="${current[1]}"
          />
        </g>
      </svg>
      <div class="state">
        <p class="value">
          ${state}
          <span class="unit">
            ${unit}
          </span>
        </p>
      </div>
      <div class="bottom">
        <p class="name">
          ${this._config.name ?? ""}
        </p>
      </div>
    </ha-card>
    `;
  }

  static get styles() {
    return css`
    ha-card {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .bottom {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      justify-content: end;
      text-align: center;
    }
    
    .state {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
    }

    .value {
      font-size: 57px;
    }

    .name {
      font-size: 16px;
    }

    .unit {
      font-size: .33em;
      opacity: 0.6;
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
      stroke-width: 6px;
    }

    .arc.clear {
      stroke: var(--clear-background-color);
    }

    .arc.current {
      stroke: var(--primary-color);
    }

    `;
  }

  public getCardSize(): Promise<number> | number {
    return 1;
  }
}

window.customCards.push({
  type: "modern-circular-gauge",
  name: "Modern Cicular Gauge",
  preview: false
});
