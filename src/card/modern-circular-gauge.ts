import { html, LitElement, TemplateResult, css, svg, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ActionHandlerEvent, hasAction } from "custom-card-helpers";
import { clamp, svgArc } from "../utils/gauge";
import { registerCustomCard } from "../utils/custom-cards";
import type { ModernCircularGaugeConfig } from "./type";
import { LovelaceLayoutOptions, LovelaceGridOptions } from "../ha/lovelace";
import { handleAction } from "../ha/handle-action";
import { HomeAssistant } from "../ha/types";
import { HassEntity, UnsubscribeFunc } from "home-assistant-js-websocket";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { actionHandler } from "../utils/action-handler-directive";
import { rgbToHex } from "../utils/color";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS } from "../const";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/ws-templates";
import { isTemplate } from "../utils/template";

const MAX_ANGLE = 270;
const ROTATE_ANGLE = 360 - MAX_ANGLE / 2 - 90;
const RADIUS = 44;

registerCustomCard({
  type: "modern-circular-gauge",
  name: "Modern Cicular Gauge",
  description: "Modern circular gauge",
});

export const TEMPLATE_KEYS = ["min", "max", "secondary"];

@customElement("modern-circular-gauge")
export class ModernCircularGauge extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeConfig;

  @state() private _templateResults?: Partial<Record<string, RenderTemplateResult | undefined>> = {};

  @state() private _unsubRenderTemplates?: Map<string, Promise<UnsubscribeFunc>> = new Map();

  public static async getConfigElement(): Promise<HTMLElement> {
    await import("./mcg-editor");
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

    TEMPLATE_KEYS.forEach((key) => {
      if (this._config?.[key] !== config[key]) {
        this._tryDisconnectKey(key);
      }
    });
    
    let secondary = config.secondary;

    if (secondary === undefined && config.secondary_entity !== undefined) {
        secondary = config.secondary_entity;
    }
    
    if (typeof secondary === "object") {
        const template = secondary.template || "";
        if (template.length > 0) {
            secondary = template;
        }
    }

    this._config = { min: DEFAULT_MIN, max: DEFAULT_MAX, ...config, secondary: secondary, secondary_entity: undefined };
  }

  public connectedCallback() {
    super.connectedCallback();
    this._tryConnect();
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
    this._tryDisconnect();
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this.hass) {
      return;
    }

    this._tryConnect();
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
    const min = Number(this._getValue("min")) ?? DEFAULT_MIN;
    const max = Number(this._getValue("max")) ?? DEFAULT_MAX;
    return (clamp(value, min, max) - min) / (max - min);
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
      <div class="container">
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
        <svg class="state" viewBox="-50 -50 100 100">
          <text x="0" y="0" class="value" style=${styleMap({ "font-size": this._calcStateSize(entityState) })}>
            ${this._getSegmentLabel(numberState) ? this._getSegmentLabel(numberState) : svg`
              ${entityState}
              <tspan class="unit" dx="-4" dy="-6">${unit}</tspan>
            `}
          </text>
          <text class="secondary" dy="18">
            ${this._renderSecondary()}
          </text>
        </svg>
      </div> 
    </ha-card>
    `;
  }

  private _calcStateSize(state: string): string {
    const initialSize = 21;
    if (state.length >= 7) {
      return `${initialSize - (state.length - 5)}px`
    }
    return `${initialSize}px`;
  }

  private _renderSecondary(): TemplateResult {
    const secondary = this._config?.secondary;
    if (!secondary) {
      return svg``;
    }

    if (typeof secondary === "string") {
      return svg`${this._getValue("secondary")}`;
    }

    const stateObj = this.hass.states[secondary.entity || ""];

    if (!stateObj) {
      return svg``;
    }

    const attributes = stateObj.attributes;

    const unit = secondary.unit ?? attributes.unit_of_measurement;

    const state = stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj.entity_id]));

    return svg`
    ${entityState}
    <tspan>
    ${unit}
    </tspan>
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

  private async _tryConnect(): Promise<void> {
    TEMPLATE_KEYS.forEach((key) => {
      this._tryConnectKey(key);
    });
  }

  private async _tryConnectKey(key: string): Promise<void> {
    if (
      this._unsubRenderTemplates?.get(key) !== undefined ||
      !this.hass ||
      !this._config ||
      !isTemplate(this._config?.[key])
    ) {
      return;
    }

    try {
      const sub = subscribeRenderTemplate(
        this.hass.connection,
        (result) => {
          if ("error" in result) {
            return;
          }
          this._templateResults = {
            ...this._templateResults,
            [key]: result,
          };
        },
        {
          template: this._config[key] as string || "",
          variables: {
            config: this._config,
            user: this.hass.user!.name,
          },
          strict: true,
        }
      );
      this._unsubRenderTemplates?.set(key, sub);
      await sub;
    } catch (e: any) {
      const result = {
        result: this._config[key] as string || "",
        listeners: { all: false, domains: [], entities: [], time: false },
      };
      this._templateResults = {
        ...this._templateResults,
        [key]: result,
      };
      this._unsubRenderTemplates?.delete(key);
    }
  }

  private async _tryDisconnect(): Promise<void> {
    TEMPLATE_KEYS.forEach((key) => {
      this._tryDisconnectKey(key);
    });
  }

  private async _tryDisconnectKey(key: string): Promise<void> {
    const unsubRenderTemplate = this._unsubRenderTemplates?.get(key);
    if (!unsubRenderTemplate) {
      return;
    }

    try {
      const unsub = await unsubRenderTemplate;
      unsub();
      this._unsubRenderTemplates?.delete(key);
    } catch (e: any) {
      if (e.code === "not_found" || e.code === "template_error") {

      } else {
        throw e;
      }
    }
  }

  private _handleAction(ev: ActionHandlerEvent) {
    handleAction(this, this.hass!, this._config!, ev.detail.action!);
  }

  private _getValue(key: string) {
    return isTemplate(this._config?.[key])
      ? this._templateResults?.[key]?.result?.toString()
      : this._config?.[key];
  }

  public getGridOptions(): LovelaceGridOptions {
    return {
      columns: 6,
      rows: 4,
      min_rows: 3,
      min_columns: 4
    };
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
      text-anchor: middle;
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

    .secondary {
      font-size: 7px;
      fill: var(--secondary-text-color);
    }

    .value {
      font-size: 21px;
      fill: var(--primary-text-color);
      dominant-baseline: middle;
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
