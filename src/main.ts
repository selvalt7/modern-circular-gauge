import { html, LitElement, TemplateResult, css, svg, nothing } from "lit";
import { ResizeController } from "@lit-labs/observers/resize-controller.js";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { clamp, svgArc } from "./utils/gauge";
import { registerCustomCard } from "./utils/custom-cards";
import type { ModernCircularGaugeConfig } from "./type";
import { classMap } from "lit/directives/class-map.js";

const MAX_ANGLE = 270;
const ROTATE_ANGLE = 360 - MAX_ANGLE / 2 - 90;
const RADIUS = 44;

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

registerCustomCard({
  type: "modern-circular-gauge",
  name: "Modern Cicular Gauge",
  description: "Modern circular gauge",
});

@customElement("modern-circular-gauge")
export class ModernCircularGauge extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeConfig;

  private _sizeController = new ResizeController(this, {
    callback: (entries) => {
      const element = entries[0]?.target.shadowRoot?.querySelector(".container") as HTMLElement | undefined;
      const size = Math.min(element?.clientHeight || 0, element?.clientWidth || 0);
      if (size < 160) {
        return "small";
      }
      if (size < 200) {
        return "medium";
      }
      if (size < 280) {
        return "big";
      }
      return "";
    },
  });

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

    const state = Number(stateObj.state);
    const unit = this._config.unit ?? stateObj.attributes.unit_of_measurement;

    const current = this._config.needle ? undefined : this._strokeDashArc(state > 0 ? 0 : state, state > 0 ? state : 0);
    const needle = this._config.needle ? this._strokeDashArc(state, state) : undefined;

    return html`
    <ha-card class="${classMap({ "flex-column-reverse": this._config.header_position == "bottom" })}">
      <div class="header">
        <p class="name">
          ${this._config.name ?? stateObj.attributes.friendly_name ?? ''}
        </p>
      </div>
      <div class="container ${this._sizeController.value || ""}">
        <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid"
          overflow="visible"
        >
          <g transform="rotate(135)">
            <path
              class="arc clear"
              d=${path}
            />
            ${current ? svg`
              <path
                class="arc current"
                d=${path}
                stroke-dasharray="${current[0]}"
                stroke-dashoffset="${current[1]}"
              />
              ` : nothing}
            ${needle ? svg`
              <path
                d=${path}
                stroke-dasharray="${needle[0]}"
                stroke-dashoffset="${needle[1]}"
              />
              <path
                class="needle-border"
                d=${path}
                stroke-dasharray="${needle[0]}"
                stroke-dashoffset="${needle[1]}"
              />
              <path
                class="needle"
                d=${path}
                stroke-dasharray="${needle[0]}"
                stroke-dashoffset="${needle[1]}"
              />
              ` : nothing}
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
      padding: 16px;
      flex-direction: column;
      align-items: center;
    }

    .flex-column-reverse {
      flex-direction: column-reverse;
    }
    
    .header {
      display: flex;
      flex-direction: column;
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

    .container {
      position: relative;
      container-type: inline-size;
      container-name: container;
      width: 100%;
      height: 100%;
    }

    .flex-column-reverse .container {
      margin-bottom: -20px;
    }

    .value {
      font-size: 57px;
    }
    
    .small .value {
      font-size: 27px;
    }

    .medium .value {
      font-size: 37px;
    }

    .big .value {
      font-size: 47px;
    }

    .name {
      font-size: 16px;
      margin: 0;
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
      stroke: var(--primary-background-color);
    }

    .arc.current {
      stroke: var(--primary-color);
    }

    .needle {
      fill: none;
      stroke-linecap: round;
      stroke-width: 4px;
      stroke: white;
    }

    .needle-border {
      fill: none;
      stroke-linecap: round;
      stroke-width: 6px;
      stroke: var(--primary-color);
    }

    `;
  }

  public getCardSize(): Promise<number> | number {
    return 1;
  }
}
