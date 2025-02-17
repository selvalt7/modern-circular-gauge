import { html, LitElement, TemplateResult, css, svg, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ActionHandlerEvent } from "../ha/data/lovelace";
import { hasAction } from "../ha/panels/lovelace/common/has-action";
import { clamp, svgArc } from "../utils/gauge";
import { registerCustomCard } from "../utils/custom-cards";
import type { ModernCircularGaugeConfig, SecondaryEntity, SegmentsConfig } from "./type";
import { LovelaceLayoutOptions, LovelaceGridOptions } from "../ha/data/lovelace";
import { handleAction } from "../ha/handle-action";
import { HomeAssistant } from "../ha/types";
import { HassEntity, UnsubscribeFunc } from "home-assistant-js-websocket";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { actionHandler } from "../utils/action-handler-directive";
import { rgbToHex } from "../utils/color";
import { interpolateRgb } from "d3-interpolate";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS } from "../const";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/data/ws-templates";
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

  private _strokeDashArc(from: number, to: number, min: number, max: number, radius: number): [string, string] {
    const start = this._valueToPercentage(from, min, max);
    const end = this._valueToPercentage(to, min, max);

    const track = (radius * 2 * Math.PI * MAX_ANGLE) / 360;
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

    if (!stateObj && templatedState === undefined) {
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

    const numberState = Number(templatedState ?? stateObj.state);

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

    const current = this._config.needle ? undefined : this._strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0, min, max, RADIUS);
    const needle = this._config.needle ? this._strokeDashArc(numberState, numberState, min, max, RADIUS) : undefined;

    const state = templatedState ?? stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    return html`
    <ha-card
      class="${classMap({
        "flex-column-reverse": this._config.header_position == "top",
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
            <defs>
              <mask id="gradient-path">
                <path
                  class="arc"
                  stroke="white"
                  d=${path}
                />
                ${needle ? svg`
                <path
                  class="needle-border"
                  d=${path}
                  stroke-dasharray="${needle[0]}"
                  stroke-dashoffset="${needle[1]}"
                  stroke="black"
                />
                ` : nothing}
              </mask>
              <mask id="needle-mask">
                <rect x="-50" y="-50" width="100" height="100" fill="white"/>
                ${needle ? svg`
                <path
                  class="needle-border"
                  d=${path}
                  stroke-dasharray="${needle[0]}"
                  stroke-dashoffset="${needle[1]}"
                  stroke="black"
                />
                ` : nothing}
              </mask>
            </defs>
            <path
              class="arc clear"
              d=${path}
              mask=${ifDefined(needle ? "url(#needle-mask)" : undefined)}
            />
            ${current ? svg`
              <path
                class="arc current"
                style=${styleMap({ "visibility": numberState <= min && min >= 0 ? "hidden" : "visible" })}
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
              <g class="segments" mask=${ifDefined(this._config.smooth_segments ? "url(#gradient-path)" : "url(#needle-mask)")}>
                ${this._renderSegments(this._config.segments, min, max, RADIUS)}
              </g>`
              : nothing
              }
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
          <text
            x="0" y="0" 
            class="value ${classMap({"dual-state": typeof this._config.secondary != "string" && this._config.secondary?.state_size == "big"})}" 
            style=${styleMap({ "font-size": this._calcStateSize(entityState) })}
            dy=${typeof this._config.secondary != "string" && this._config.secondary?.state_size == "big" ? -14 : 0}
          >
            ${this._getSegmentLabel(numberState, this._config.segments) ? this._getSegmentLabel(numberState, this._config.segments) : svg`
              ${entityState}
              <tspan class="unit" dx="-4" dy="-6">${unit}</tspan>
            `}
          </text>
          ${typeof this._config.secondary != "string" && this._config.secondary?.state_size == "big"
            ? svg`
          <text
            class="state-label"
            dy="1"
          >
            ${this._config.label}
          </text>`
            : nothing}
          ${this._renderSecondary()}
        </svg>
      </div> 
    </ha-card>
    `;
  }

  private _calcStateSize(state: string): string {
    let initialSize = 24;
    if (typeof this._config?.secondary != "string") {
      initialSize -= this._config?.secondary?.show_gauge == "inner" ? 2 : 0;
      initialSize -= this._config?.secondary?.state_size == "big" ? 3 : 0;
    }

    if (state.length >= 7) {
      return `${initialSize - (state.length - 4)}px`
    }
    return `${initialSize}px`;
  }

  private _renderInnerGauge(): TemplateResult {
    const secondaryObj = this._config?.secondary as SecondaryEntity;
    const stateObj = this.hass.states[secondaryObj.entity || ""];
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if ((!stateObj || !secondaryObj) && templatedState === undefined) {
      return svg`
      <g class="inner">
        <path
          class="arc clear"
          d=${innerPath}
        />
      </g>
      `;
    }

    const numberState = Number(templatedState ?? stateObj.state);

    if (stateObj?.state === "unavailable" && templatedState) {
      return svg``;
    }

    if (isNaN(numberState)) {
      return svg``;
    }

    const min = Number(this._templateResults?.secondaryMin?.result ?? secondaryObj.min) || DEFAULT_MIN; 
    const max = Number(this._templateResults?.secondaryMax?.result ?? secondaryObj.max) || DEFAULT_MAX;

    const current = secondaryObj.needle ? undefined : this._strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0, min, max, INNER_RADIUS);
    const needle = secondaryObj.needle ? this._strokeDashArc(numberState, numberState, min, max, INNER_RADIUS) : undefined;

    return svg`
    <g 
      class="inner"
      style=${styleMap({ "--gauge-color": this._computeSegments(numberState, secondaryObj.segments) })}
      >
      <mask id="gradient-inner-path">
        <path
          class="arc"
          stroke="white"
          d=${innerPath}
        />
        ${needle ? svg`
        <path
          class="needle-border"
          d=${innerPath}
          stroke-dasharray="${needle[0]}"
          stroke-dashoffset="${needle[1]}"
          stroke="black"
        />
        ` : nothing}
      </mask>
      <mask id="inner-needle-mask">
        <rect x="-50" y="-50" width="100" height="100" fill="white"/>
        ${needle ? svg`
        <path
          class="needle-border"
          d=${innerPath}
          stroke-dasharray="${needle[0]}"
          stroke-dashoffset="${needle[1]}"
          stroke="black"
        />
        ` : nothing}
      </mask>
      <path
        class="arc clear"
        d=${innerPath}
        mask=${ifDefined(needle ? "url(#gradient-inner-path)" : undefined)}
      />
      ${current ? svg`
        <path
          class="arc current"
          style=${styleMap({ "visibility": numberState <= min && min >= 0 ? "hidden" : "visible" })}
          d=${innerPath}
          stroke-dasharray="${current[0]}"
          stroke-dashoffset="${current[1]}"
        />
      ` : nothing}
      ${needle ? svg`
        ${secondaryObj.segments ? svg`
        <g class="segments" mask=${ifDefined(this._config?.smooth_segments ? "url(#gradient-inner-path)" : "url(#inner-needle-mask)")}>
          ${this._renderSegments(secondaryObj.segments, min, max, INNER_RADIUS)}
        </g>`
        : nothing
        }
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

    if (!stateObj && templatedState === undefined) {
      return svg``;
    }

    const numberState = Number(templatedState ?? stateObj.state);
    const mainNumberState = Number(mainTemplatedState ?? mainStateObj.state);

    if (stateObj?.state === "unavailable" && templatedState) {
      return svg``;
    }

    if (isNaN(numberState)) {
      return svg``;
    }

    const min = Number(this._templateResults?.min?.result ?? this._config?.min) || DEFAULT_MIN; 
    const max = Number(this._templateResults?.max?.result ?? this._config?.max) || DEFAULT_MAX;

    const current = this._strokeDashArc(numberState, numberState, min, max, RADIUS);

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
      return svg`
      <text
        x="0" y="0"
        class="secondary"
        dy=19
      >
        ${this._templateResults?.secondary?.result ?? this._config?.secondary}
      </text>`;
    }

    const stateObj = this.hass.states[secondary.entity || ""];
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if (!stateObj && templatedState === undefined) {
      return svg``;
    }

    const attributes = stateObj?.attributes ?? undefined;

    const unit = secondary.unit ?? attributes?.unit_of_measurement;

    const state = templatedState ?? stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    return svg`
    <text
      @action=${this._handleAction}
      class="secondary ${classMap({"dual-state": secondary.state_size == "big"})}"
      style=${styleMap({ "font-size": secondary.state_size == "big" ? this._calcStateSize(entityState) : undefined })}
      dy=${secondary.state_size == "big" ? 14 : 20}
    >
      ${entityState}
      <tspan
        class=${classMap({"unit": secondary.state_size == "big"})}
        dx=${secondary.state_size == "big" ? -4 : 0}
        dy=${secondary.state_size == "big" ? -6 : 0}
      >
        ${unit}
      </tspan>
    </text>
    ${secondary.state_size == "big"
      ? svg`
    <text
      class="state-label"
      dy="29"
    >
      ${secondary.label}
    </text>`
      : nothing}
    `;
  }

  private _renderSegments(segments: SegmentsConfig[], min: number, max: number, radius: number): TemplateResult[] {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => a.from - b.from);

      if (this._config?.smooth_segments) {
        let gradient: string = "";
        sortedSegments.map((segment, index) => {
          const angle = this._getAngle(segment.from, min, max) + 45;
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
            if (this._config?.smooth_segments) {
              const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
              const nextSegment = sortedSegments[i + 1] ? sortedSegments[i + 1] : segment;
              const nextColor = typeof nextSegment.color === "object" ? rgbToHex(nextSegment.color) : nextSegment.color;
              return interpolateRgb(color, nextColor)(this._valueToPercentage(numberState, segment.from, nextSegment.from));
            } else {
              const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
              return color;
            }
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
    ev.stopPropagation();
    const element = ev.currentTarget as Element;
    const targetEntity = element.classList.contains("secondary")
      ? typeof this._config?.secondary != "string" ? this._config?.secondary?.entity : ""
      : this._config?.entity;
    const config = {
      ...this._config,
      entity: isTemplate(targetEntity ?? "") ? "" : targetEntity
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
      flex-direction: column-reverse;
      align-items: center;
    }

    ha-card.action {
      cursor: pointer
    }

    .flex-column-reverse {
      flex-direction: column;
    }
    
    .header {
      position: absolute;
      width: 100%;
      display: flex;
      flex-direction: column;
      text-align: center;
      padding: 0 10px;
      box-sizing: border-box;
    }

    .flex-column-reverse .header {
      position: relative;
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
      font-size: 10px;
      fill: var(--secondary-text-color);
    }

    .state-label {
      font-size: 0.49em;
      fill: var(--secondary-text-color);
    }

    .value, .secondary.dual-state {
      font-size: 21px;
      fill: var(--primary-text-color);
      dominant-baseline: middle;
    }

    .secondary.dual-state {
      fill: var(--secondary-text-color);
    }

    .secondary.dual-state .unit {
      opacity: 1;
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
      opacity: 0.45;
    }

    .needle {
      fill: none;
      stroke-linecap: round;
      stroke-width: var(--gauge-stroke-width);
      stroke: var(--gauge-color);
      transition: all 1s ease 0s;
    }

    .needle-border {
      fill: none;
      stroke-linecap: round;
      stroke-width: calc(var(--gauge-stroke-width) + 4px);
      transition: all 1s ease 0s, stroke 0.3s ease-out;
    }

    .inner {
      --gauge-color: var(--accent-color);
    }

    .dual-gauge {
      --gauge-stroke-width: 4px;
    }

    .dual-gauge .needle-border {
      stroke-width: calc(var(--gauge-stroke-width) + 3px);
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
