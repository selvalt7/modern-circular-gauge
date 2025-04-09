import { html, LitElement, TemplateResult, css, svg, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ActionHandlerEvent } from "../ha/data/lovelace";
import { hasAction } from "../ha/panels/lovelace/common/has-action";
import { svgArc, strokeDashArc, renderColorSegments, computeSegments, renderPath } from "../utils/gauge";
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
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS, MAX_ANGLE } from "../const";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/data/ws-templates";
import { isTemplate } from "../utils/template";

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
              ${renderPath("arc", path)}
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

    const current = this._config.needle ? undefined : strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0, min, max, RADIUS);
    const needle = this._config.needle ? strokeDashArc(numberState, numberState, min, max, RADIUS) : undefined;

    const state = templatedState ?? stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    const iconCenter = !(this._config.show_state ?? false) && (this._config.show_icon ?? true);
    const segments = (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config.segments;

    const gaugeBackgroundColor = this._config.gauge_background_style?.color;
    const gaugeForegroundColor = this._config.gauge_foreground_style?.color;

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
          ${this._templateResults?.name?.result ?? this._config.name ?? stateObj.attributes.friendly_name ?? ''}
        </p>
      </div>
      ` : nothing}
      <div class="container"
        style=${styleMap({ "--gauge-color": gaugeForegroundColor && gaugeForegroundColor != "adaptive" ? gaugeForegroundColor : computeSegments(numberState, segments, this._config.smooth_segments) })}
      >
        <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid"
          overflow="visible"
          style=${styleMap({ "--gauge-stroke-width": this._config.gauge_foreground_style?.width ? `${this._config.gauge_foreground_style?.width}px` : undefined,
            "--inner-gauge-stroke-width": typeof this._config.secondary == "object" ? this._config.secondary?.gauge_foreground_style?.width ? `${this._config.secondary?.gauge_foreground_style?.width}px` : undefined : undefined })}
           })}
          class=${classMap({ "dual-gauge": typeof this._config.secondary != "string" && this._config.secondary?.show_gauge == "inner" })}
        >
          <g transform="rotate(${ROTATE_ANGLE})">
            <defs>
              <mask id="gradient-path">
                ${renderPath("arc", path, undefined, styleMap({ "stroke": "white", "stroke-width": this._config.gauge_background_style?.width ? `${this._config.gauge_background_style?.width}px` : undefined }))}
              </mask>
              <mask id="gradient-current-path">
                ${current ? renderPath("arc current", path, current, styleMap({ "stroke": "white", "visibility": numberState <= min && min >= 0 ? "hidden" : "visible" })) : nothing}
              </mask>
              <mask id="gradient-inner-path">
                ${renderPath("arc", innerPath, undefined, styleMap({ "stroke": "white", "stroke-width": typeof this._config.secondary == "object" ? this._config.secondary?.gauge_background_style?.width ? `${this._config.secondary?.gauge_background_style?.width}px` 
                  : 'var(--inner-gauge-stroke-width)' : 'var(--inner-gauge-stroke-width)' }))}
              </mask>
            </defs>
            <g class="background" style=${styleMap({ "opacity": this._config.gauge_background_style?.opacity,
              "--gauge-stroke-width": this._config.gauge_background_style?.width ? `${this._config.gauge_background_style?.width}px` : undefined })}>
              ${renderPath("arc clear", path, undefined, styleMap({ "stroke": gaugeBackgroundColor && gaugeBackgroundColor != "adaptive" ? gaugeBackgroundColor : undefined }))}
              ${this._config.segments && (needle || this._config.gauge_background_style?.color == "adaptive") ? svg`
              <g class="segments" mask=${ifDefined(this._config.smooth_segments ? "url(#gradient-path)" : undefined)}>
                ${renderColorSegments(segments, min, max, RADIUS, this._config?.smooth_segments)}
              </g>`
              : nothing
              }
            </g>
            ${current ? gaugeForegroundColor == "adaptive" ? svg`
              <g class="foreground-segments" mask="url(#gradient-current-path)" style=${styleMap({ "opacity": this._config.gauge_foreground_style?.opacity })}>
                ${renderColorSegments(segments, min, max, RADIUS, this._config?.smooth_segments)}
              </g>
              ` : renderPath("arc current", path, current, styleMap({ "visibility": numberState <= min && min >= 0 ? "hidden" : "visible", "opacity": this._config.gauge_foreground_style?.opacity })) : nothing}
            ${typeof this._config.secondary != "string" ? 
              this._config.secondary?.show_gauge == "outter" ? this._renderOutterSecondary()
              : this._config.secondary?.show_gauge == "inner" ? this._renderInnerGauge()
              : nothing
              : nothing}
            ${needle ? svg`
              ${renderPath("needle-border", path, needle)}
              ${renderPath("needle", path, needle)}
              ` : nothing}
          </g>
        </svg>
        <svg class="state" overflow="visible" viewBox="-50 ${iconCenter ? -55 : -50} 100 100">
          ${this._config.show_state ? svg`
          <text
            x="0" y="0" 
            class="value ${classMap({"dual-state": typeof this._config.secondary != "string" && this._config.secondary?.state_size == "big", "adaptive": !!this._config.adaptive_state_color})}" 
            style=${styleMap({ "font-size": this._calcStateSize(entityState) })}
            dy=${typeof this._config.secondary != "string" && this._config.secondary?.state_size == "big" ? -14 : 0}
          >
            ${this._getSegmentLabel(numberState, segments) ? this._getSegmentLabel(numberState, segments) : svg`
              ${entityState}
              ${this._config.show_unit ?? true ? svg`<tspan class="unit" dx="-4" dy="-6">${unit}</tspan>` : nothing}
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

  private _calcStateSize(state: string): string {
    let initialSize = this._config?.state_font_size ?? 24;
    if (typeof this._config?.secondary != "string") {
      initialSize -= this._config?.secondary?.show_gauge == "inner" ? 2 : 0;
      initialSize -= this._config?.secondary?.state_size == "big" ? 3 : 0;
    }

    if (state.length >= (this._config?.state_scaling_limit ?? 7)) {
      return `${initialSize - (state.length - 4) * (this._config?.state_scaling_multiplier ?? 1)}px`
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
        ${renderPath("arc clear", innerPath)}
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

    const current = secondaryObj.needle ? undefined : strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0, min, max, INNER_RADIUS);
    const needle = secondaryObj.needle ? strokeDashArc(numberState, numberState, min, max, INNER_RADIUS) : undefined;

    const segments = (this._templateResults?.secondarySegments as unknown) as SegmentsConfig[] ?? secondaryObj.segments;

    const gaugeBackgroundColor = secondaryObj.gauge_background_style?.color;
    const gaugeForegroundColor = secondaryObj.gauge_foreground_style?.color;

    return svg`
    <g 
      class="inner"
      style=${styleMap({ "--gauge-color": gaugeForegroundColor && gaugeForegroundColor != "adaptive" ? gaugeForegroundColor : computeSegments(numberState, (this._templateResults?.secondarySegments as unknown) as SegmentsConfig[] ?? secondaryObj.segments, this._config?.smooth_segments) })}
      >
      <mask id="gradient-current-inner-path">
        ${current ? renderPath("arc current", innerPath, current, styleMap({ "stroke": "white", "visibility": numberState <= min && min >= 0 ? "hidden" : "visible" })) : nothing}
      </mask>
      <g class="background" style=${styleMap({ "opacity": secondaryObj.gauge_background_style?.opacity,
        "--gauge-stroke-width": secondaryObj.gauge_background_style?.width ? `${secondaryObj.gauge_background_style?.width}px` : undefined })}
      >
        ${renderPath("arc clear", innerPath, undefined, styleMap({ "stroke": gaugeBackgroundColor && gaugeBackgroundColor != "adaptive" ? gaugeBackgroundColor : undefined }))}
        ${this._config?.segments && (needle || secondaryObj.gauge_background_style?.color == "adaptive") ? svg`
        <g class="segments" mask=${ifDefined(this._config.smooth_segments ? "url(#gradient-inner-path)" : undefined)}>
          ${renderColorSegments(segments, min, max, INNER_RADIUS, this._config?.smooth_segments)}
        </g>`
        : nothing
        }
      </g>
      ${current ? gaugeForegroundColor == "adaptive" ? svg`
        <g class="foreground-segments" mask="url(#gradient-current-inner-path)" style=${styleMap({ "opacity": secondaryObj.gauge_foreground_style?.opacity })}>
          ${renderColorSegments(segments, min, max, INNER_RADIUS, this._config?.smooth_segments)}
        </g>
        ` : renderPath("arc current", innerPath, current, styleMap({ "visibility": numberState <= min && min >= 0 ? "hidden" : "visible", "opacity": secondaryObj.gauge_foreground_style?.opacity })) : nothing}
      ${needle ? svg`
        ${renderPath("needle-border", innerPath, needle)}
        ${renderPath("needle", innerPath, needle)}
        `  : nothing}
    </g>
    `;
  }

  private _renderOutterSecondary(): TemplateResult {
    const secondaryObj = this._config?.secondary as SecondaryEntity;
    const stateObj = this.hass.states[secondaryObj.entity || ""];
    const templatedState = this._templateResults?.secondaryEntity?.result;

    if (!stateObj && templatedState === undefined) {
      return svg``;
    }

    const numberState = Number(templatedState ?? stateObj.state);

    if (stateObj?.state === "unavailable" && templatedState) {
      return svg``;
    }

    if (isNaN(numberState)) {
      return svg``;
    }

    const min = Number(this._templateResults?.min?.result ?? this._config?.min) || DEFAULT_MIN; 
    const max = Number(this._templateResults?.max?.result ?? this._config?.max) || DEFAULT_MAX;

    const current = strokeDashArc(numberState, numberState, min, max, RADIUS);

    return renderPath("dot", path, current, styleMap({ "opacity": secondaryObj.gauge_foreground_style?.opacity ?? 0.8, "stroke": secondaryObj.gauge_foreground_style?.color, "stroke-width": secondaryObj.gauge_foreground_style?.width }));
  }

  private _renderSecondary(): TemplateResult {
    const secondary = this._config?.secondary;
    if (!secondary) {
      return svg``;
    }

    if (typeof secondary === "string") {
      this._hasSecondary = true;
      return svg`
      <text
        x="0" y="0"
        class="secondary"
        dy=19
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
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    let secondaryColor;

    if (secondary.adaptive_state_color) {
      if (secondary.show_gauge == "outter") {
        secondaryColor = computeSegments(Number(state), this._config?.segments, this._config?.smooth_segments);
      } else if (secondary.show_gauge == "inner") {
        secondaryColor = computeSegments(Number(state), secondary.segments, this._config?.smooth_segments);
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
      style=${styleMap({ "font-size": secondary.state_size == "big" ? this._calcStateSize(entityState) : undefined,
        "fill": secondaryColor ?? undefined
       })}
      dy=${secondary.state_size == "big" ? 14 : 20}
    >
      ${entityState}
      ${secondary.show_unit ?? true ? svg`
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
      secondary: this._config?.secondary
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
      secondary: this._config?.secondary
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
        secondarySegments: secondary?.segments
      };

      Object.entries(secondaryTemplates).forEach(([key, _]) => {
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

    ha-state-icon {
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

    .icon-center ha-state-icon, .icon-center ha-state-icon.big {
      position: static;
      transform: unset;
      height: 30%;
      width: 30%;
    }

    ha-state-icon.big {
      height: 18%;
      width: 18%;
    }

    .adaptive {
      color: var(--gauge-color);
    }

    .value.adaptive, .secondary.adaptive {
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
      --gauge-color: var(--accent-color);
      --gauge-stroke-width: var(--inner-gauge-stroke-width);
    }

    .dual-gauge {
      --gauge-stroke-width: 4px;
    }

    .dot {
      fill: none;
      stroke-linecap: round;
      stroke-width: calc(var(--gauge-stroke-width) / 2);
      stroke: var(--primary-text-color);
      transition: all 1s ease 0s;
      opacity: 0.5;
    }
    `;
  }
}
