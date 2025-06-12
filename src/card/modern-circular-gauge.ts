import { html, LitElement, TemplateResult, css, svg, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ActionHandlerEvent } from "../ha/data/lovelace";
import { hasAction } from "../ha/panels/lovelace/common/has-action";
import { svgArc, computeSegments, renderPath } from "../utils/gauge";
import { registerCustomCard } from "../utils/custom-cards";
import type { ModernCircularGaugeConfig, SecondaryEntity, SegmentsConfig, TertiaryEntity } from "./type";
import { LovelaceLayoutOptions, LovelaceGridOptions } from "../ha/data/lovelace";
import { handleAction } from "../ha/handle-action";
import { HomeAssistant } from "../ha/types";
import { HassEntity, UnsubscribeFunc } from "home-assistant-js-websocket";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { actionHandler } from "../utils/action-handler-directive";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS, MAX_ANGLE } from "../const";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/data/ws-templates";
import { isTemplate } from "../utils/template";
import { mdiHelp } from "@mdi/js";
import "../components/modern-circular-gauge-element"

const ROTATE_ANGLE = 360 - MAX_ANGLE / 2 - 90;
const RADIUS = 47;
const INNER_RADIUS = 42;
const TERTIARY_RADIUS = 37;

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

const TERTIARY_PATH = svgArc({
  x: 0,
  y: 0,
  start: 0,
  end: MAX_ANGLE,
  r: TERTIARY_RADIUS,
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

  @state() private _hasSecondary?: boolean = false;

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

        let secondaryGaugeForegroundStyle = (secondary as SecondaryEntity).gauge_foreground_style;
        if (!secondaryGaugeForegroundStyle) {
          if ((secondary as SecondaryEntity).gauge_width !== undefined) {
            secondaryGaugeForegroundStyle = { width: (secondary as SecondaryEntity).gauge_width };
            secondary = { ...(secondary as SecondaryEntity), gauge_foreground_style: secondaryGaugeForegroundStyle };
          }
        }
    }

    let gaugeForegroundStyle = config.gauge_foreground_style;

    if (!gaugeForegroundStyle) {
      if (config.gauge_width !== undefined) {
        gaugeForegroundStyle = { width: config.gauge_width };
        config = { ...config, gauge_foreground_style: gaugeForegroundStyle };
      }
    }

    this._config = { min: DEFAULT_MIN, max: DEFAULT_MAX, show_header: true, show_state: true, ...config, secondary: secondary, secondary_entity: undefined };
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
        return this._renderWarning();
      } else {
        return this._renderWarning(this._config.entity, "", undefined, mdiHelp);
      }
    }

    const numberState = Number(templatedState ?? stateObj.state);
    const icon = this._templateResults?.icon?.result ?? this._config.icon;

    if (stateObj?.state === "unavailable") {
      return this._renderWarning(this._templateResults?.name?.result ?? (isTemplate(String(this._config.name)) ? "" : this._config.name) ?? stateObj.attributes.friendly_name ?? '', this.hass.localize("state.default.unavailable"), stateObj, icon);
    }

    if (isNaN(numberState)) {
      return this._renderWarning(this._templateResults?.name?.result ?? (isTemplate(String(this._config.name)) ? "" : this._config.name) ?? stateObj.attributes.friendly_name ?? '', "NaN", stateObj, icon);
    }

    const attributes = stateObj?.attributes ?? undefined;

    const unit = this._config.unit ?? stateObj?.attributes.unit_of_measurement;

    const min = Number(this._templateResults?.min?.result ?? this._config.min) || DEFAULT_MIN;
    const max = Number(this._templateResults?.max?.result ?? this._config.max) || DEFAULT_MAX;

    const state = templatedState ?? stateObj.state;
    const stateOverride = this._templateResults?.stateText?.result ?? (isTemplate(String(this._config.state_text)) ? "" : this._config.state_text);
    const entityState = stateOverride ?? formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    const iconCenter = !(this._config.show_state ?? false) && (this._config.show_icon ?? true);
    const segments = (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config.segments;

    return html`
    <ha-card
      class="${classMap({
        "flex-column-reverse": this._config.header_position == "top",
        "action": this._hasCardAction(),
        "icon-center": iconCenter
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
      ${this._config.show_header ? html`
      <div class="header" style=${styleMap({ "--gauge-header-font-size": this._config.header_font_size ? `${this._config.header_font_size}px` : undefined,
        "transform": this._config.header_offset ? `translate(0, ${this._config.header_offset}px)` : undefined })}>
        <p class="name">
          ${this._templateResults?.name?.result ?? (isTemplate(String(this._config.name)) ? "" : this._config.name) ?? stateObj.attributes.friendly_name ?? ''}
        </p>
      </div>
      ` : nothing}
      <div
        class="container${classMap({ "dual-gauge": typeof this._config.secondary != "string" && this._config.secondary?.show_gauge == "inner" })}"
        style=${styleMap({"--gauge-color": this._config.gauge_foreground_style?.color && this._config.gauge_foreground_style?.color != "adaptive" ? this._config.gauge_foreground_style?.color : computeSegments(numberState, this._config.segments, this._config.smoothSegments, this)})}
      >
        <div class="gauge-container">
          <modern-circular-gauge-element
            .min=${min}
            .max=${max}
            .value=${numberState}
            .radius=${RADIUS}
            .maxAngle=${MAX_ANGLE}
            .segments=${segments}
            .smoothSegments=${this._config.smooth_segments}
            .foregroundStyle=${this._config.gauge_foreground_style}
            .backgroundStyle=${this._config.gauge_background_style}
            .needle=${this._config.needle}
            .startFromZero=${this._config.start_from_zero}
          ></modern-circular-gauge-element>
          ${typeof this._config.secondary != "string" ? 
          this._config.secondary?.show_gauge == "outter" || this._config.secondary?.show_gauge == "inner" ?
          this._renderSecondaryGauge()
          : nothing
          : nothing}
          ${typeof this._config.tertiary != "string" ? 
          this._config.tertiary?.show_gauge == "outter" || this._config.tertiary?.show_gauge == "inner" ?
          this._renderTertiaryRing()
          : nothing
          : nothing}
        </div>
        <svg class="state" overflow="visible" viewBox="-50 -50 100 100">
          ${this._config.show_state ? svg`
          <text
            x="0" y="0" 
            class="value ${classMap({"dual-state": typeof this._config.secondary != "string" && this._config.secondary?.state_size == "big", "adaptive": !!this._config.adaptive_state_color})}" 
            style=${styleMap({ "font-size": this._calcStateSize(entityState) })}
            dy=${typeof this._config.secondary != "string" && this._config.secondary?.state_size == "big" ? -14 : 0}
          >
            ${this._getSegmentLabel(numberState, segments) ? this._getSegmentLabel(numberState, segments) : svg`
              ${entityState}
              ${(this._config.show_unit ?? true) ? svg`<tspan class="unit" dx="-4" dy="-6">${unit}</tspan>` : nothing}
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
          ` : nothing}
          ${this._renderSecondary()}
          ${this._renderTertiary()}
        </svg>
        ${this._config.show_icon ?? true ? html`
        <div class="icon-container">
          <div class="icon-wrapper">
            <ha-state-icon
              class=${classMap({ "adaptive": !!this._config.adaptive_icon_color, "big": !this._hasSecondary })}
              .hass=${this.hass}
              .stateObj=${stateObj}
              .icon=${this._templateResults?.icon?.result ?? this._config.icon}
            ></ha-state-icon>
          </div>
        </div>
        ` : nothing}
      </div> 
    </ha-card>
    `;
  }

  private _renderWarning(headerText?: string, stateText?: string, stateObj?: HassEntity, icon?: string): TemplateResult {
    const iconCenter = stateText?.length == 0;
    return html`
      <ha-card
      class="${classMap({
        "flex-column-reverse": this._config?.header_position == "bottom",
        "action": this._hasCardAction() && stateObj !== undefined
      })}"
      @action=${ifDefined(stateObj ? this._handleAction : undefined)}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config?.hold_action),
        hasDoubleClick: hasAction(this._config?.double_tap_action),
      })}
      tabindex=${ifDefined(
        !this._config?.tap_action || hasAction(this._config?.tap_action)
        ? "0"
        : undefined
      )}
      >
      <div class="header" style=${styleMap({ "--gauge-header-font-size": this._config?.header_font_size ? `${this._config.header_font_size}px` : undefined,
        "transform": this._config?.header_offset ? `translate(0, ${this._config.header_offset}px)` : undefined })}>
        <p class="name">
          ${headerText}
        </p>
      </div>
      <div class=${classMap({ "icon-center": iconCenter, "container": true })}>
        <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid"
          overflow="visible"
        >
          <g transform="rotate(${ROTATE_ANGLE})">
            ${renderPath("arc clear", path)}
          </g>
        </svg>
        <svg class="state" overflow="visible" viewBox="-50 ${iconCenter ? -55 : -50} 100 100">
          <text
            x="0" y="0" 
            class="value" 
            style=${styleMap({ "font-size": this._calcStateSize(stateText ?? "") })}
          >
            ${stateText}
          </text>
        </svg>
        <div class="icon-container">
          <div class="icon-wrapper">
            ${stateObj ? html`
              <ha-state-icon
                class="big warning-icon"
                .hass=${this.hass}
                .stateObj=${stateObj}
                .icon=${icon}
              ></ha-state-icon>
              ` : html`<ha-svg-icon class="warning-icon" .path=${icon}></ha-svg-icon>`}
          </div>
        </div>
      </div>
      </ha-card>
      `;
  }

  private _calcStateSize(state: string, initialStateSize?: number): string {
    let initialSize = initialStateSize ?? this._config?.state_font_size ?? 24;
    if (typeof this._config?.secondary != "string") {
      initialSize -= this._config?.secondary?.show_gauge == "inner" ? 2 : 0;
      initialSize -= this._config?.secondary?.state_size == "big" ? 3 : 0;
    }

    if (typeof this._config?.tertiary != "string") {
      initialSize -= this._config?.tertiary?.show_gauge == "inner" ? 2 : 0;
    }

    if (state.length >= (this._config?.state_scaling_limit ?? 7)) {
      return `${initialSize - (state.length - 4) * (this._config?.state_scaling_multiplier ?? 1)}px`
    }
    return `${initialSize}px`;
  }

  private _renderTertiaryRing(): TemplateResult {
    const tertiaryObj = this._config?.tertiary as TertiaryEntity;
    const stateObj = this.hass.states[tertiaryObj.entity || ""];
    const templatedState = this._templateResults?.tertiaryEntity?.result;
    
    if (!tertiaryObj) {
      return html``;
    }

    if (tertiaryObj.show_gauge == "inner") {
      if (!stateObj && templatedState === undefined) {
        return html`
        <modern-circular-gauge-element
          class="tertiary"
          .radius=${TERTIARY_RADIUS}
          .maxAngle=${MAX_ANGLE}
        ></modern-circular-gauge-element>
        `;
      }

      const min = Number(this._templateResults?.tertiaryMin?.result ?? tertiaryObj.min) || DEFAULT_MIN;
      const max = Number(this._templateResults?.tertiaryMax?.result ?? tertiaryObj.max) || DEFAULT_MAX;
      const segments = (this._templateResults?.tertiarySegments as unknown) as SegmentsConfig[] ?? tertiaryObj.segments;
      const numberState = Number(templatedState ?? stateObj.state);

      return html`
      <modern-circular-gauge-element
        class="tertiary"
        .min=${min}
        .max=${max}
        .value=${numberState}
        .radius=${TERTIARY_RADIUS}
        .maxAngle=${MAX_ANGLE}
        .segments=${segments}
        .smoothSegments=${this._config?.smooth_segments}
        .foregroundStyle=${tertiaryObj?.gauge_foreground_style}
        .backgroundStyle=${tertiaryObj?.gauge_background_style}
        .needle=${tertiaryObj?.needle}
        .startFromZero=${tertiaryObj?.start_from_zero}
      ></modern-circular-gauge-element>
      `;
    } else {
      if (!stateObj && templatedState === undefined) {
        return html``;
      }

      const numberState = Number(templatedState ?? stateObj.state);

      if (stateObj?.state === "unavailable" && templatedState) {
        return html``;
      }
  
      if (isNaN(numberState)) {
        return html``;
      }
  
      const min = Number(this._templateResults?.min?.result ?? this._config?.min) || DEFAULT_MIN; 
      const max = Number(this._templateResults?.max?.result ?? this._config?.max) || DEFAULT_MAX;
  
      return html`
      <modern-circular-gauge-element
        class="tertiary"
        .min=${min}
        .max=${max}
        .value=${numberState}
        .radius=${RADIUS}
        .maxAngle=${MAX_ANGLE}
        .foregroundStyle=${tertiaryObj?.gauge_foreground_style}
        .backgroundStyle=${tertiaryObj?.gauge_background_style}
        .outter=${true}
      ></modern-circular-gauge-element>
      `;
    }
  }

  private _renderSecondaryGauge(): TemplateResult {
    const secondaryObj = this._config?.secondary as SecondaryEntity;
    const stateObj = this.hass.states[secondaryObj.entity || ""];
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if (!secondaryObj) {
      return html``;
    }
    
    if (secondaryObj.show_gauge == "inner") {
      if (!stateObj && templatedState === undefined) {
        return html`
        <modern-circular-gauge-element
          class="secondary"
          .radius=${INNER_RADIUS}
          .maxAngle=${MAX_ANGLE}
        ></modern-circular-gauge-element>
        `;
      }

      const min = Number(this._templateResults?.secondaryMin?.result ?? secondaryObj.min) || DEFAULT_MIN; 
      const max = Number(this._templateResults?.secondaryMax?.result ?? secondaryObj.max) || DEFAULT_MAX;
      const segments = (this._templateResults?.secondarySegments as unknown) as SegmentsConfig[] ?? secondaryObj.segments;
      const numberState = Number(templatedState ?? stateObj.state);

      return html`
      <modern-circular-gauge-element
        class="secondary"
        .min=${min}
        .max=${max}
        .value=${numberState}
        .radius=${INNER_RADIUS}
        .maxAngle=${MAX_ANGLE}
        .segments=${segments}
        .smoothSegments=${this._config?.smooth_segments}
        .foregroundStyle=${secondaryObj?.gauge_foreground_style}
        .backgroundStyle=${secondaryObj?.gauge_background_style}
        .needle=${secondaryObj?.needle}
        .startFromZero=${secondaryObj.start_from_zero}
      ></modern-circular-gauge-element>
      `;
    } else {
      if (!stateObj && templatedState === undefined) {
        return html``;
      }

      const numberState = Number(templatedState ?? stateObj.state);

      if (stateObj?.state === "unavailable" && templatedState) {
        return html``;
      }
  
      if (isNaN(numberState)) {
        return html``;
      }
  
      const min = Number(this._templateResults?.min?.result ?? this._config?.min) || DEFAULT_MIN; 
      const max = Number(this._templateResults?.max?.result ?? this._config?.max) || DEFAULT_MAX;
  
      return html`
      <modern-circular-gauge-element
        class="secondary"
        .min=${min}
        .max=${max}
        .value=${numberState}
        .radius=${RADIUS}
        .maxAngle=${MAX_ANGLE}
        .foregroundStyle=${secondaryObj?.gauge_foreground_style}
        .backgroundStyle=${secondaryObj?.gauge_background_style}
        .outter=${true}
      ></modern-circular-gauge-element>
      `;
    }
  }

  private _renderTertiary(): TemplateResult {
    const tertiary = this._config?.tertiary;
    if (!tertiary) {
      return svg``;
    }

    const iconCenter = !(this._config?.show_state ?? false) && (this._config?.show_icon ?? true);

    if (typeof tertiary === "string") {
      return svg`
      <text
        x="0" y="0"
        class="tertiary-state"
        dy=${iconCenter ? -19 : -16}
      >
        ${this._templateResults?.tertiary?.result ?? this._config?.tertiary}
      </text>
      `;
    }

    const bigState = typeof this._config?.secondary == "object" ? this._config?.secondary?.state_size == "big" : false;

    if (!(tertiary.show_state ?? true) || bigState) {
      return svg``;
    }

    const stateObj = this.hass.states[tertiary.entity || ""];
    const templatedState = this._templateResults?.tertiaryEntity?.result;

    if (!stateObj && templatedState === undefined) {
      return svg``;
    }

    const attributes = stateObj?.attributes ?? undefined;
    const unit = tertiary.unit ?? attributes?.unit_of_measurement;
    const state = templatedState ?? stateObj.state;
    const stateOverride = this._templateResults?.tertiaryStateText?.result ?? (isTemplate(String(tertiary.state_text)) ? "" : tertiary.state_text);
    const entityState = stateOverride ?? formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    let adaptiveColor;

    if (tertiary.adaptive_state_color) {
      if (tertiary.show_gauge == "outter") {
        adaptiveColor = computeSegments(Number(state), (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config?.segments, this._config?.smooth_segments, this);
      } else if (tertiary.show_gauge == "inner") {
        adaptiveColor = computeSegments(Number(state), tertiary.segments, this._config?.smooth_segments, this);
      }

      if (tertiary.gauge_foreground_style?.color && tertiary.gauge_foreground_style?.color != "adaptive") {
        adaptiveColor = tertiary.gauge_foreground_style?.color;
      }
    }

    return svg`
    <text
      @action=${this._handleTertiaryAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(tertiary.hold_action),
        hasDoubleClick: hasAction(tertiary.double_tap_action),
      })}
      class="tertiary-state ${classMap({ "adaptive": !!tertiary.adaptive_state_color })}"
      style=${styleMap({ "fill": adaptiveColor ?? undefined, "font-size": tertiary.state_font_size ? `${tertiary.state_font_size}px` : undefined })}
      dy=${iconCenter ? -19 : -16}
    >
      ${entityState}
      ${(tertiary.show_unit ?? true) ? svg`
      <tspan
        dx=0
        dy=0
      >
        ${unit}
      </tspan>
      ` : nothing}
    </text>
    `;
  }

  private _renderSecondary(): TemplateResult {
    const secondary = this._config?.secondary;
    if (!secondary) {
      return svg``;
    }

    const iconCenter = !(this._config?.show_state ?? false) && (this._config?.show_icon ?? true);

    if (typeof secondary === "string") {
      this._hasSecondary = true;
      return svg`
      <text
        x="0" y="0"
        class="secondary"
        dy=${iconCenter ? 25 : 20}
      >
        ${this._templateResults?.secondary?.result ?? this._config?.secondary}
      </text>`;
    }

    if (!(secondary.show_state ?? true)) {
      return svg``;
    }

    const stateObj = this.hass.states[secondary.entity || ""];
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if (!stateObj && templatedState === undefined) {
      return svg``;
    }

    this._hasSecondary = true;

    const attributes = stateObj?.attributes ?? undefined;

    const unit = secondary.unit ?? attributes?.unit_of_measurement;

    const state = templatedState ?? stateObj.state;
    const stateOverride = this._templateResults?.secondaryStateText?.result ?? (isTemplate(String(secondary.state_text)) ? "" : secondary.state_text);
    const entityState = stateOverride ?? formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    let secondaryColor;

    if (secondary.adaptive_state_color) {
      if (secondary.show_gauge == "outter") {
        secondaryColor = computeSegments(Number(state), (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config?.segments, this._config?.smooth_segments, this);
      } else if (secondary.show_gauge == "inner") {
        secondaryColor = computeSegments(Number(state), secondary.segments, this._config?.smooth_segments, this);
      }

      if (secondary.gauge_foreground_style?.color && secondary.gauge_foreground_style?.color != "adaptive") {
        secondaryColor = secondary.gauge_foreground_style?.color;
      }
    }

    return svg`
    <text
      @action=${this._handleSecondaryAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(secondary.hold_action),
        hasDoubleClick: hasAction(secondary.double_tap_action),
      })}
      class="secondary ${classMap({ "dual-state": secondary.state_size == "big", "adaptive": !!secondary.adaptive_state_color })}"
      style=${styleMap({ "font-size": secondary.state_size == "big" ? this._calcStateSize(entityState, secondary.state_font_size) : secondary.state_font_size ? `${secondary.state_font_size}px` : undefined,
        "fill": secondaryColor ?? undefined
       })}
      dy=${secondary.state_size == "big" ? 14 : iconCenter ? 25 : 20}
    >
      ${entityState}
      ${(secondary.show_unit ?? true) ? svg`
      <tspan
        class=${classMap({"unit": secondary.state_size == "big"})}
        dx=${secondary.state_size == "big" ? -4 : 0}
        dy=${secondary.state_size == "big" ? -6 : 0}
      >
        ${unit}
      </tspan>
      ` : nothing}
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

  private _getSegmentLabel(numberState: number, segments: SegmentsConfig[] | undefined): string {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));

      for (let i = sortedSegments.length - 1; i >= 0; i--) {
        let segment = sortedSegments[i];
        if (numberState >= Number(segment.from) || i === 0) {
          return segment.label || "";
        }
      }
    }
    return "";
  }

  private async _tryConnect(): Promise<void> {
    const templates = {
      entity: this._config?.entity,
      name: this._config?.name,
      icon: this._config?.icon,
      min: this._config?.min,
      max: this._config?.max,
      segments: this._config?.segments,
      stateText: this._config?.state_text,
      secondary: this._config?.secondary,
      tertiary: this._config?.tertiary
    };
    
    Object.entries(templates).forEach(([key, value]) => {
      if (typeof value == "string") {
        this._tryConnectKey(key, value);
      } else if (key == "segments") {
        const segmentsStringified = JSON.stringify(value);
        this._tryConnectKey(key, segmentsStringified);
      }
    });

    if (typeof this._config?.secondary != "string") {
      const secondary = this._config?.secondary;
      const secondaryTemplates = {
        secondaryMin: secondary?.min,
        secondaryMax: secondary?.max,
        secondaryEntity: secondary?.entity,
        secondaryStateText: secondary?.state_text,
        secondarySegments: secondary?.segments
      };

      Object.entries(secondaryTemplates).forEach(([key, value]) => {
        if (typeof value == "string") {
          this._tryConnectKey(key, value);
        } else if (key == "secondarySegments") {
          const segmentsStringified = JSON.stringify(value);
          this._tryConnectKey(key, segmentsStringified);
        }
      });
    }

    if (typeof this._config?.tertiary != "string") {
      const tertiary = this._config?.tertiary;
      const tertiaryTemplates = {
        tertiaryMin: tertiary?.min,
        tertiaryMax: tertiary?.max,
        tertiaryEntity: tertiary?.entity,
        tertiaryStateText: tertiary?.state_text,
        tertiarySegments: tertiary?.segments
      };

      Object.entries(tertiaryTemplates).forEach(([key, value]) => {
        if (typeof value == "string") {
          this._tryConnectKey(key, value);
        } else if (key == "tertiarySegments") {
          const segmentsStringified = JSON.stringify(value);
          this._tryConnectKey(key, segmentsStringified);
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
      name: this._config?.name,
      icon: this._config?.icon,
      min: this._config?.min,
      max: this._config?.max,
      segments: this._config?.segments,
      stateText: this._config?.state_text,
      secondary: this._config?.secondary,
      tertiary: this._config?.tertiary
    };
    
    Object.entries(templates).forEach(([key, _]) => {
      this._tryDisconnectKey(key);
    });

    if (typeof this._config?.secondary != "string") {
      const secondary = this._config?.secondary;
      const secondaryTemplates = {
        secondaryMin: secondary?.min,
        secondaryMax: secondary?.max,
        secondaryEntity: secondary?.entity,
        secondaryStateText: secondary?.state_text,
        secondarySegments: secondary?.segments
      };

      Object.entries(secondaryTemplates).forEach(([key, _]) => {
        this._tryDisconnectKey(key);
      });
    }

    if (typeof this._config?.tertiary != "string") {
      const tertiary = this._config?.tertiary;
      const tertiaryTemplates = {
        tertiaryMin: tertiary?.min,
        tertiaryMax: tertiary?.max,
        tertiaryEntity: tertiary?.entity,
        tertiaryStateText: tertiary?.state_text,
        tertiarySegments: tertiary?.segments
      };

      Object.entries(tertiaryTemplates).forEach(([key, _]) => {
        this._tryDisconnectKey(key);
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
    const targetEntity = this._config?.entity;
    const config = {
      ...this._config,
      entity: isTemplate(targetEntity ?? "") ? "" : targetEntity
    };

    handleAction(this, this.hass!, config, ev.detail.action!);
  }

  private _handleSecondaryAction(ev: ActionHandlerEvent) {
    ev.stopPropagation();
    if (typeof this._config?.secondary != "string") {
      const entity = typeof this._config?.secondary != "string" ? this._config?.secondary?.entity : "";
      const config = {
        ...this._config?.secondary,
        entity: isTemplate(entity ?? "") ? "" : entity
      }
      
      handleAction(this, this.hass!, config, ev.detail.action!);
    }
  }

  private _handleTertiaryAction(ev: ActionHandlerEvent) {
    ev.stopPropagation();
    if (typeof this._config?.tertiary != "string") {
      const entity = typeof this._config?.tertiary != "string" ? this._config?.tertiary?.entity : "";
      const config = {
        ...this._config?.tertiary,
        entity: isTemplate(entity ?? "") ? "" : entity
      }
      
      handleAction(this, this.hass!, config, ev.detail.action!);
    }
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
      --gauge-primary-color: var(--light-blue-color);
      --gauge-secondary-color: var(--orange-color);
      --gauge-tertiary-color: var(--light-green-color);

      --gauge-color: var(--gauge-primary-color);
      --gauge-stroke-width: 6px;
      --inner-gauge-stroke-width: 4px;
      --gauge-header-font-size: 14px;
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
      z-index: 2;
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

    .secondary, .tertiary-state {
      font-size: 10px;
      fill: var(--secondary-text-color);
      --gauge-color: var(--gauge-secondary-color);
    }

    .tertiary-state {
      --gauge-color: var(--gauge-tertiary-color);
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

    .icon-container {
      display: flex;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      justify-content: center;
      align-items: center;
      z-index: 1;
    }

    .icon-wrapper {
      position: relative;
      display: flex;
      width: 100%;
      height: auto;
      max-height: 100%;
      padding: 0;
      margin: 0;
      overflow: hidden;
    }

    .icon-center .icon-wrapper {
      justify-content: center;
      align-items: center;
    }

    .icon-wrapper:before {
      display: block;
      content: "";
      padding-top: 100%;
    }

    ha-state-icon, .warning-icon {
      position: absolute;
      bottom: 14%;
      left: 50%;
      transform: translate(-50%, 0);
      --mdc-icon-size: auto;
      color: var(--primary-color);
      height: 12%;
      width: 12%;
      --ha-icon-display: flex;
    }

    .icon-center ha-state-icon, .icon-center ha-state-icon.big, .icon-center .warning-icon {
      position: static;
      transform: unset;
      height: 30%;
      width: 30%;
    }

    ha-state-icon.big, .warning-icon {
      height: 18%;
      width: 18%;
    }

    .warning-icon {
      color: var(--state-unavailable-color);
    }

    .adaptive {
      color: var(--gauge-color);
    }

    .value.adaptive, .secondary.adaptive, .tertiary-state.adaptive {
      fill: var(--gauge-color);
    }

    ha-icon {
      display: flex;
      justify-content: center;
    }

    .name {
      width: 100%;
      font-size: var(--gauge-header-font-size);
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

    .gauge-container {
      height: 100%;
      width: 100%;
      display: block;
    }

    modern-circular-gauge-element.secondary, modern-circular-gauge-element.tertiary {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
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
      opacity: 0.35;
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
      stroke-width: calc(var(--gauge-stroke-width) + 2px);
      stroke: var(--card-background-color);
      transition: all 1s ease 0s, stroke 0.3s ease-out;
    }

    .inner {
      --gauge-color: var(--gauge-secondary-color);
      --gauge-stroke-width: var(--inner-gauge-stroke-width);
    }

    .tertiary {
      --gauge-color: var(--gauge-tertiary-color);
    }

    .dual-gauge modern-circular-gauge-element {
      --gauge-stroke-width: 4px;
    }

    .dot {
      fill: none;
      stroke-linecap: round;
      stroke-width: calc(var(--gauge-stroke-width) / 2);
      stroke: var(--primary-text-color);
      transition: all 1s ease 0s;
    }

    .dot.border {
      stroke: var(--gauge-color);
      stroke-width: var(--gauge-stroke-width);
    }
    `;
  }
}
