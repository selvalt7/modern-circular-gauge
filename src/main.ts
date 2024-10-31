import { html, LitElement, TemplateResult, css, svg, nothing } from "lit";
import { ResizeController } from "@lit-labs/observers/resize-controller.js";
import { customElement, property, state } from "lit/decorators.js";
import { ActionHandlerEvent, formatNumber, hasAction } from "custom-card-helpers";
import { clamp, svgArc } from "./utils/gauge";
import { registerCustomCard } from "./utils/custom-cards";
import type { ModernCircularGaugeConfig } from "./type";
import { LovelaceLayoutOptions } from "./ha/lovelace";
import { handleAction } from "./ha/handle-action";
import { HomeAssistant } from "./ha/types";
import { HassEntity } from "home-assistant-js-websocket";
import { getNumberFormatOptions } from "./utils/format_number";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { actionHandler } from "./utils/action-handler-directive";
import { rgbToHex } from "./utils/color";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS } from "./const";

const MAX_ANGLE = 270;
const ROTATE_ANGLE = 360 - MAX_ANGLE / 2 - 90;
const RADIUS = 44;

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

  public static async getConfigElement(): Promise<HTMLElement> {
    await import("./editor");
    return document.createElement("modern-circular-gauge-editor");
  }

  public static async getStubConfig(hass: HomeAssistant): Promise<ModernCircularGaugeConfig> {
    const entities = Object.keys(hass.states);
    const numbers = entities.filter((e) =>
      NUMBER_ENTITY_DOMAINS.includes(e.split(".")[0])
    );
    return {
      type: "custom:modern-circular-gauge",
      entity: numbers[0],
    };
  }

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

  private _getAngle(value: number) {
    return this._valueToPercentage(value) * MAX_ANGLE;
  }

  private _hasCardAction() {
    return (!this._config?.tap_action ||
      hasAction(this._config?.tap_action) ||
      hasAction(this._config?.hold_action) ||
      hasAction(this._config?.double_tap_action)
    );
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    const stateObj = this.hass.states[this._config.entity];

    if (!stateObj) {
      return html`
      <hui-warning>
        ${this.hass.localize("ui.panel.lovelace.warning.entity_not_found", { entity: this._config.entity || "[empty]" })}
      </hui-warning>
      `;
    }

    const numberState = Number(stateObj.state);

    if (stateObj.state === "unavailable") {
      return html`
      <hui-warning>
        ${this.hass.localize("ui.panel.lovelace.warning.entity_unavailable", { entity: this._config.entity })}
      </hui-warning>
      `;
    }

    if (isNaN(numberState)) {
      return html`
      <hui-warning>
        ${this.hass.localize("ui.panel.lovelace.warning.entity_non_numeric", { entity: this._config.entity })}
      </hui-warning>
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

    const unit = this._config.unit ?? stateObj.attributes.unit_of_measurement;

    const current = this._config.needle ? undefined : this._strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0);
    const needle = this._config.needle ? this._strokeDashArc(numberState, numberState) : undefined;

    const state = stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj.entity_id]));

    return html`
    <ha-card
      class="${classMap({
        "flex-column-reverse": this._config.header_position == "bottom",
        "action": this._hasCardAction()
       })}"
      @action=${this._handleAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config.hold_action),
        hasDoubleClick: hasAction(this._config.double_tap_action),
      })}
      tabindex=${ifDefined(
        !this._config.tap_action || hasAction(this._config.tap_action)
        ? "0"
        : undefined
      )}
    >
      <div class="header">
        <p class="name">
          ${this._config.name ?? stateObj.attributes.friendly_name ?? ''}
        </p>
      </div>
      <div class="container ${this._sizeController.value || ""}">
        <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid"
          overflow="visible"
          style=${styleMap({ "--gauge-color": this._computeSegments(numberState) })}
        >
          <g transform="rotate(${ROTATE_ANGLE})">
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
              ${this._config.segments ? svg`
              <g class="segments">
                ${this._renderSegments()}
              </g>`
              : nothing
              }
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
          ${this._getSegmentLabel(numberState) ? this._getSegmentLabel(numberState) : html`
            ${entityState}
            <span class="unit">
              ${unit}
            </span>
            `}
          </p>
        </div>
      </div> 
    </ha-card>
    `;
  }

  private _renderSegments(): TemplateResult[] {
    if (this._config?.segments) {
      let segments = [...this._config.segments].sort((a, b) => a.from - b.from);

      return [...segments].map((segment, index) => {
        let roundEnd: TemplateResult | undefined;
        const startAngle = index === 0 ? 0 : this._getAngle(segment.from);
        const angle = index === segments.length - 1 ? MAX_ANGLE : this._getAngle(segments[index + 1].from);
        const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
        const path = svgArc({
          x: 0,
          y: 0,
          start: startAngle,
          end: angle,
          r: RADIUS,
        });

        if (index === 0 || index === segments.length - 1) {
          const path = svgArc({
            x: 0,
            y: 0,
            start: index === 0 ? 0 : MAX_ANGLE,
            end: index === 0 ? 0 : MAX_ANGLE,
            r: RADIUS,
          });
          roundEnd = svg`
          <path
            class="segment"
            stroke=${color}
            d=${path}
            stroke-linecap="round"
          />`;
        }

        return svg`${roundEnd}
          <path
            class="segment"
            stroke=${color}
            d=${path}
          />`;
      });
    }
    return [];
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

  private _getSegmentLabel(numberState: number): string {
    if (this._config?.segments) {
      let segments = [...this._config.segments].sort((a, b) => a.from - b.from);

      for (let i = segments.length - 1; i >= 0; i--) {
        let segment = segments[i];
        if (numberState >= segment.from || i === 0) {
          return segment.label || "";
        }
      }
    }
    return "";
  }

  private _handleAction(ev: ActionHandlerEvent) {
    handleAction(this, this.hass!, this._config!, ev.detail.action!);
  }

  public getLayoutOptions(): LovelaceLayoutOptions {
    return {
      grid_columns: 2,
      grid_rows: 3,
      grid_min_rows: 3,
      grid_min_columns: 2
    };
  }

  public getCardSize(): Promise<number> | number {
    return 4;
  }

  static get styles() {
    return css`
    :host {
      --gauge-color: var(--primary-color);
      --gauge-stroke-width: 6px;
    }

    ha-card {
      width: 100%;
      height: 100%;
      display: flex;
      padding: 16px;
      flex-direction: column;
      align-items: center;
    }

    ha-card.action {
      cursor: pointer
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
      stroke-width: var(--gauge-stroke-width);
    }

    .arc.clear {
      stroke: var(--primary-background-color);
    }

    .arc.current {
      stroke: var(--gauge-color);
      transition: all 1s ease 0s;
    }

    .segment {
      fill: none;
      stroke-width: var(--gauge-stroke-width);
      filter: brightness(100%);
    }

    .segments {
      opacity: 0.3;
      filter: contrast(0.8);
    }

    .needle {
      fill: none;
      stroke-linecap: round;
      stroke-width: 3px;
      stroke: white;
      transition: all 1s ease 0s;
    }

    .needle-border {
      fill: none;
      stroke-linecap: round;
      stroke-width: var(--gauge-stroke-width);
      stroke: var(--gauge-color);
      transition: all 1s ease 0s;
    }

    `;
  }
}
