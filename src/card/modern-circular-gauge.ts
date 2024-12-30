import { html, LitElement, TemplateResult, css, svg, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ActionHandlerEvent, hasAction } from "custom-card-helpers";
import { clamp, svgArc } from "../utils/gauge";
import { registerCustomCard } from "../utils/custom-cards";
import type { ModernCircularGaugeConfig, SecondaryEntity, SegmentsConfig } from "./type";
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
const RADIUS = 47;
const INNER_RADIUS = 42;

const path = svgArc({
  x: 0,
  y: 0,
  start: 0,
  end: MAX_ANGLE,
  r: RADIUS,
});

const innerPath = svgArc({
  x: 0,
  y: 0,
  start: 0,
  end: MAX_ANGLE,
  r: INNER_RADIUS,
});

registerCustomCard({
  type: "modern-circular-gauge",
  name: "Modern Cicular Gauge",
  description: "Modern circular gauge",
});

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

  private _strokeDashArc(from: number, to: number, min: number, max: number): [string, string] {
    const start = this._valueToPercentage(from, min, max);
    const end = this._valueToPercentage(to, min, max);

    const track = (RADIUS * 2 * Math.PI * MAX_ANGLE) / 360;
    const arc = Math.max((end - start) * track, 0);
    const arcOffset = start * track - 0.5;

    const strokeDasharray = `${arc} ${track - arc}`;
    const strokeDashOffset = `-${arcOffset}`;
    return [strokeDasharray, strokeDashOffset];
  }

  private _valueToPercentage(value: number, min: number, max: number) {
    return (clamp(value, min, max) - min) / (max - min);
  }

  private _getAngle(value: number, min: number, max: number) {
    return this._valueToPercentage(value, min, max) * MAX_ANGLE;
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
    const templatedState = this._templateResults?.entity?.result;

    if (!stateObj && !templatedState) {
      if (isTemplate(this._config.entity)) {
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
          </p>
        </div>
        <div class="container">
          <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid"
            overflow="visible"
            class=${classMap({ "dual-gauge": typeof this._config.secondary != "string" && this._config.secondary?.show_gauge == "inner" })}
          >
            <g transform="rotate(${ROTATE_ANGLE})">
              <path
                class="arc clear"
                d=${path}
              />
            </g>
          </svg>
        </ha-card>
        `;
      } else {
        return html`
        <hui-warning>
          ${this.hass.localize("ui.panel.lovelace.warning.entity_not_found", { entity: this._config.entity || "[empty]" })}
        </hui-warning>
        `;
      }
    }

    const numberState = Number(stateObj?.state) || Number(templatedState);

    if (stateObj?.state === "unavailable") {
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

    const attributes = stateObj?.attributes ?? undefined;

    const unit = this._config.unit ?? stateObj?.attributes.unit_of_measurement;

    const min = Number(this._templateResults?.min?.result ?? this._config.min) || DEFAULT_MIN;
    const max = Number(this._templateResults?.max?.result ?? this._config.max) || DEFAULT_MAX;

    const current = this._config.needle ? undefined : this._strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0, min, max);
    const needle = this._config.needle ? this._strokeDashArc(numberState, numberState, min, max) : undefined;

    const state = templatedState ?? stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

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
          style=${styleMap({ "--gauge-color": this._computeSegments(numberState, this._config.segments) })}
          class=${classMap({ "dual-gauge": typeof this._config.secondary != "string" && this._config.secondary?.show_gauge == "inner" })}
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
            ${typeof this._config.secondary != "string" ? 
              this._config.secondary?.show_gauge == "outter" ? this._renderOutterSecondary()
              : this._config.secondary?.show_gauge == "inner" ? this._renderInnerGauge()
              : nothing
              : nothing}
            ${needle ? svg`
              ${this._config.segments ? svg`
              <g class="segments">
                ${this._renderSegments(this._config.segments, min, max, RADIUS)}
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
            ${this._getSegmentLabel(numberState, this._config.segments) ? this._getSegmentLabel(numberState, this._config.segments) : svg`
              ${entityState}
              <tspan class="unit" dx="-4" dy="-6">${unit}</tspan>
            `}
          </text>
          <text class="secondary" dy="19">
            ${this._renderSecondary()}
          </text>
        </svg>
      </div> 
    </ha-card>
    `;
  }

  private _calcStateSize(state: string): string {
    const initialSize = typeof this._config?.secondary != "string" && this._config?.secondary?.show_gauge == "inner" ? 
      22 : 24;
    if (state.length >= 7) {
      return `${initialSize - (state.length - 4)}px`
    }
    return `${initialSize}px`;
  }

  private _renderInnerGauge(): TemplateResult {
    const secondaryObj = this._config?.secondary as SecondaryEntity;
    const stateObj = this.hass.states[secondaryObj.entity || ""];
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if ((!stateObj || !secondaryObj) && !templatedState) {
      return svg`
      <g class="inner">
        <path
          class="arc clear"
          d=${innerPath}
        />
      </g>
      `;
    }

    const numberState = Number(stateObj?.state) || Number(templatedState);

    if (stateObj?.state === "unavailable" && templatedState) {
      return svg``;
    }

    if (isNaN(numberState)) {
      return svg``;
    }

    const min = Number(this._templateResults?.secondaryMin?.result ?? secondaryObj.min) || DEFAULT_MIN; 
    const max = Number(this._templateResults?.secondaryMax?.result ?? secondaryObj.max) || DEFAULT_MAX;

    const current = secondaryObj.needle ? undefined : this._strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0, min, max);
    const needle = secondaryObj.needle ? this._strokeDashArc(numberState, numberState, min, max) : undefined;

    return svg`
    <g 
      class="inner"
      style=${styleMap({ "--gauge-color": this._computeSegments(numberState, secondaryObj.segments) })}
      >
      <path
        class="arc clear"
        d=${innerPath}
      />
      ${current ? svg`
        <path
          class="arc current"
          d=${innerPath}
          stroke-dasharray="${current[0]}"
          stroke-dashoffset="${current[1]}"
        />
      ` : nothing}
      ${needle ? svg`
        ${secondaryObj.segments ? svg`
        <g class="segments">
          ${this._renderSegments(secondaryObj.segments, min, max, INNER_RADIUS)}
        </g>`
        : nothing
        }
        <path
          d=${innerPath}
          stroke-dasharray="${needle[0]}"
          stroke-dashoffset="${needle[1]}"
        />
        <path
          class="needle-border"
          d=${innerPath}
          stroke-dasharray="${needle[0]}"
          stroke-dashoffset="${needle[1]}"
        />
        <path
          class="needle"
          d=${innerPath}
          stroke-dasharray="${needle[0]}"
          stroke-dashoffset="${needle[1]}"
        />
      ` : nothing}
    </g>
    `;
  }

  private _renderOutterSecondary(): TemplateResult {
    const secondaryObj = this._config?.secondary as SecondaryEntity;
    const stateObj = this.hass.states[secondaryObj.entity || ""];
    const mainStateObj = this.hass.states[this._config?.entity || ""];
    const mainTemplatedState = this._templateResults?.entity?.result;
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if (!stateObj && !templatedState) {
      return svg``;
    }

    const numberState = Number(stateObj?.state) || Number(templatedState);
    const mainNumberState = Number(mainStateObj?.state) || Number(mainTemplatedState);

    if (stateObj?.state === "unavailable" && templatedState) {
      return svg``;
    }

    if (isNaN(numberState)) {
      return svg``;
    }

    const min = Number(this._templateResults?.min?.result ?? this._config?.min) || DEFAULT_MIN; 
    const max = Number(this._templateResults?.max?.result ?? this._config?.max) || DEFAULT_MAX;

    const current = this._strokeDashArc(numberState, numberState, min, max);

    return svg`
    <path
      class="dot"
      d=${path}
      style=${styleMap({ "opacity": numberState <= mainNumberState ? 0.8 : 0.5 })}
      stroke-dasharray="${current[0]}"
      stroke-dashoffset="${current[1]}"
    />
    `;
  }

  private _renderSecondary(): TemplateResult {
    const secondary = this._config?.secondary;
    if (!secondary) {
      return svg``;
    }

    if (typeof secondary === "string") {
      return svg`${this._templateResults?.secondary?.result ?? this._config?.secondary}`;
    }

    const stateObj = this.hass.states[secondary.entity || ""];
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if (!stateObj && !templatedState) {
      return svg``;
    }

    const attributes = stateObj?.attributes ?? undefined;

    const unit = secondary.unit ?? attributes?.unit_of_measurement;

    const state = templatedState ?? stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    return svg`
    ${entityState}
    <tspan>
    ${unit}
    </tspan>
    `;
  }

  private _renderSegments(segments: SegmentsConfig[], min: number, max: number, radius: number): TemplateResult[] {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => a.from - b.from);

      return [...sortedSegments].map((segment, index) => {
        let roundEnd: TemplateResult | undefined;
        const startAngle = index === 0 ? 0 : this._getAngle(segment.from, min, max);
        const angle = index === sortedSegments.length - 1 ? MAX_ANGLE : this._getAngle(sortedSegments[index + 1].from, min, max);
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
    return [];
  }

  private _computeSegments(numberState: number, segments: SegmentsConfig[] | undefined): string | undefined {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => a.from - b.from);

      for (let i = 0; i < sortedSegments.length; i++) {
        let segment = sortedSegments[i];
        if (segment && (numberState >= segment.from || i === 0) &&
          (i + 1 == sortedSegments?.length || numberState < sortedSegments![i + 1].from)) {
            const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
            return color;
        }
      }
    }
    return undefined;
  }

  private _getSegmentLabel(numberState: number, segments: SegmentsConfig[] | undefined): string {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => a.from - b.from);

      for (let i = sortedSegments.length - 1; i >= 0; i--) {
        let segment = sortedSegments[i];
        if (numberState >= segment.from || i === 0) {
          return segment.label || "";
        }
      }
    }
    return "";
  }

  private async _tryConnect(): Promise<void> {
    const templates = {
      entity: this._config?.entity,
      min: this._config?.min,
      max: this._config?.max,
      secondary: this._config?.secondary
    };
    
    Object.entries(templates).forEach(([key, value]) => {
      if (typeof value == "string") {
        this._tryConnectKey(key, value);
      }
    });

    if (typeof this._config?.secondary != "string") {
      const secondary = this._config?.secondary;
      const secondaryTemplates = {
        secondaryMin: secondary?.min,
        secondaryMax: secondary?.max,
        secondaryEntity: secondary?.entity
      };

      Object.entries(secondaryTemplates).forEach(([key, value]) => {
        if (typeof value == "string") {
          this._tryConnectKey(key, value);
        }
      });
    }
  }

  private async _tryConnectKey(key: string, templateValue: string): Promise<void> {
    if (
      this._unsubRenderTemplates?.get(key) !== undefined ||
      !this.hass ||
      !this._config ||
      !isTemplate(templateValue)
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
          template: templateValue as string || "",
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
        result: templateValue as string || "",
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
    const templates = {
      entity: this._config?.entity,
      min: this._config?.min,
      max: this._config?.max,
      secondary: this._config?.secondary
    };
    
    Object.entries(templates).forEach(([key, value]) => {
      if (typeof value == "string") {
        this._tryDisconnectKey(key);
      }
    });

    if (typeof this._config?.secondary != "string") {
      const secondary = this._config?.secondary;
      const secondaryTemplates = {
        secondaryMin: secondary?.min,
        secondaryMax: secondary?.max,
        secondaryEntity: secondary?.entity
      };

      Object.entries(secondaryTemplates).forEach(([key, value]) => {
        if (typeof value == "string") {
          this._tryDisconnectKey(key);
        }
      });
    }
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
    const config = {
      ...this._config,
      entity: isTemplate(this._config?.entity ?? "") ? "" : this._config?.entity
    };

    handleAction(this, this.hass!, config, ev.detail.action!);
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
      padding: 10px;
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
      width: 100%;
      display: flex;
      flex-direction: column;
      text-align: center;
      padding: 0 10px;
      box-sizing: border-box;
    }

    .flex-column-reverse .header {
      position: absolute;
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
      margin-bottom: 0px;
    }

    .secondary {
      font-size: 8px;
      fill: var(--secondary-text-color);
    }

    .value {
      font-size: 21px;
      fill: var(--primary-text-color);
      dominant-baseline: middle;
    }

    .name {
      width: 100%;
      font-size: 14px;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      line-height: 20px;
      letter-spacing: .1px;
      color: var(--primary-text-color);
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

    .inner {
      --gauge-color: var(--accent-color);
    }

    .dual-gauge {
      --gauge-stroke-width: 4px;
    }

    .dual-gauge .needle {
      stroke-width: 2px;
    }

    .dot {
      fill: none;
      stroke-linecap: round;
      stroke-width: 3px;
      stroke: var(--primary-text-color);
      transition: all 1s ease 0s;
      opacity: 0.5;
    }
    `;
  }
}
