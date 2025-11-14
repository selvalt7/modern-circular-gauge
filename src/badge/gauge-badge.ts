import { LitElement, TemplateResult, html, css, nothing, PropertyValues, svg } from "lit";
import { HomeAssistant } from "../ha/types";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { customElement, property, state } from "lit/decorators.js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX, TIMESTAMP_STATE_DOMAINS } from "../const";
import { registerCustomBadge } from "../utils/custom-badges";
import { HassEntity, UnsubscribeFunc } from "home-assistant-js-websocket";
import { styleMap } from "lit/directives/style-map.js";
import { svgArc, computeSegments, getAngle, renderPath, renderColorSegments, currentDashArc } from "../utils/gauge";
import { classMap } from "lit/directives/class-map.js";
import { ActionHandlerEvent } from "../ha/data/lovelace";
import { hasAction } from "../ha/panels/lovelace/common/has-action";
import { handleAction } from "../ha/handle-action";
import { actionHandler } from "../utils/action-handler-directive";
import { mdiAlertCircle } from "@mdi/js";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/data/ws-templates";
import { ifDefined } from "lit/directives/if-defined.js";
import { isJSTemplate, isTemplate, JSTemplateRegex } from "../utils/template";
import { SegmentsConfig } from "../card/type";
import getEntityPictureUrl from "../utils/entity-picture";
import durationToSeconds from "../ha/common/datetime/duration_to_seconds";
import { computeStateDomain } from "../ha/common/entity/compute_state_domain";
import { getTimestampRemainingSeconds, getTimerRemainingSeconds } from "../utils/timer_timestamp_utils";
import "../components/mcg-badge-state";
import "../components/modern-circular-gauge-state";
import { compareHass } from "../utils/compare-hass";
import { computeCssColor } from "../ha/common/color/compute-color";
import HomeAssistantJavaScriptTemplates from "home-assistant-javascript-templates";
import { compareTemplateResult } from "../utils/compare-template-result";

const MAX_ANGLE = 270;
const ROTATE_ANGLE = 360 - MAX_ANGLE / 2 - 90;
const RADIUS = 42;

registerCustomBadge({
  type: "modern-circular-gauge-badge",
  name: "Modern Circular Gauge Badge",
  description: "Modern circular gauge badge",
});

const path = svgArc({
  x: 0,
  y: 0,
  start: 0,
  end: MAX_ANGLE,
  r: RADIUS,
});

@customElement("modern-circular-gauge-badge")
export class ModernCircularGaugeBadge extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeBadgeConfig;

  @state() private _templateResults?: Partial<Record<string, RenderTemplateResult | undefined>> = {};

  @state() private _unsubRenderTemplates?: Map<string, Promise<UnsubscribeFunc> | UnsubscribeFunc> = new Map();

  private _trackedEntities: Set<string> = new Set();

  private _isTimerOrTimestamp: boolean = false;

  private _interval?: any;

  private haJsTemplates = new HomeAssistantJavaScriptTemplates(document.querySelector("home-assistant") as any);

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

    const templates = {
      entity: "entity",
      name: "name",
      icon: "icon",
      min: "min",
      max: "max",
      segments: "segments",
      stateText: "state_text",
    };

    Object.entries(templates).forEach(([key, value]) => {
      if (this._config?.[value] !== config[value]) {
        this._tryDisconnectKey(key);
      }
    });

    this._config = { min: DEFAULT_MIN, show_state: true, ...config };
  }

  public connectedCallback() {
    super.connectedCallback();
    this._tryConnect();
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
    this._tryDisconnect();
    this._clearInterval();
  }

  private _startInterval() {
    this._clearInterval();
    this._interval = setInterval(() => {
      this.requestUpdate();
    }, 1000);
  }

  private _clearInterval() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = undefined;
    }
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has("_templateResults")) {
      const oldTemplateResults = _changedProperties.get("_templateResults") as Partial<Record<string, RenderTemplateResult | undefined>> | undefined;
      return compareTemplateResult(oldTemplateResults, this._templateResults);
    }
    if (_changedProperties.has("hass")) {
      if (this._trackedEntities.size <= 0) {
        if (Object.keys(this._templateResults || {}).length > 0) {
          return false;
        }
        return true;
      }
      const oldHass = _changedProperties.get("hass") as HomeAssistant | undefined;
      return compareHass(oldHass, this.hass, this._trackedEntities);
    }
    return true;
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this.hass) {
      return;
    }

    if (this._isTimerOrTimestamp) {
      if (!this._interval) {
        this._startInterval();
      }
    }

    this._tryConnect();
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
    };

    Object.entries(templates).forEach(([key, value]) => {
      if (typeof value == "string") {
        this._tryConnectKey(key, value);
      } else if (key == "segments") {
        let segmentsStringified = JSON.stringify(value);
        if (typeof segmentsStringified !== "undefined")
        {
          segmentsStringified = segmentsStringified.replace(/\\"/g, "'");
          this._tryConnectKey(key, segmentsStringified);
        }
      }
    });
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

    if (isJSTemplate(templateValue)) {
      const isSegments = /segments$/i.test(key);
      if (isSegments) {
        this.haJsTemplates.getRenderer()
        .then((renderer) => {
          const untrack = renderer.trackTemplate(
            `
              const processedSegments = [];
              for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const newSegment = { ...segment };
                const keys = Object.keys(segment);
                keys.forEach((k) => {
                  if (typeof segment[k] === "string" && JSRegex.test(segment[k])) {
                    const segmentValue = segment[k].replace(JSRegex, "$1");
                    const functionBody = segmentValue.includes('return')
                    ? segmentValue
                    : 'return ' + segmentValue;
                    newSegment[k] = eval('(function(){' + functionBody + '})()');
                  }
                });
                processedSegments.push(newSegment);
              }
              return processedSegments;
            `,
            (result) => {
              const templateResult = {
                result: result as string || "",
                listeners: { all: false, domains: [], entities: [], time: false },
              };
              this._templateResults = {
                ...this._templateResults,
                [key]: templateResult,
              };
            }, {"segments": JSON.parse(templateValue), "JSRegex": JSTemplateRegex});
          this._unsubRenderTemplates?.set(key, untrack);
        });
      } else {
        this.haJsTemplates.getRenderer()
        .then((renderer) => {
          const untrack = renderer.trackTemplate(
            templateValue.replace(JSTemplateRegex, "$1"),
            (result) => {
              const templateResult = {
                result: result as string || "",
                listeners: { all: false, domains: [], entities: [], time: false },
              };
              this._templateResults = {
                ...this._templateResults,
                [key]: templateResult,
              };
            }
          );
          this._unsubRenderTemplates?.set(key, untrack);
        });
      }
    } else {
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
    };
    
    Object.entries(templates).forEach(([key, _]) => {
      this._tryDisconnectKey(key);
    });

    this.haJsTemplates.getRenderer()
    .then((renderer) => {
      renderer.cleanTracked();
    });
  }

  private async _tryDisconnectKey(key: string): Promise<void> {
    const unsubRenderTemplate = this._unsubRenderTemplates?.get(key);
    if (!unsubRenderTemplate) {
      return;
    }

    if (unsubRenderTemplate instanceof Promise === false) {
      unsubRenderTemplate();
      this._unsubRenderTemplates?.delete(key);
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

  get hasAction() {
    return (
      !this._config?.tap_action ||
      hasAction(this._config?.tap_action) ||
      hasAction(this._config?.hold_action) ||
      hasAction(this._config?.double_tap_action)
    );
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    this._trackedEntities.clear();
    if (this._config.entity && !isTemplate(this._config.entity)) {
      this._trackedEntities.add(this._config.entity);
    }

    const stateObj = this.hass.states[this._config.entity];
    const templatedState = this._templateResults?.entity?.result;    

    if (!stateObj && templatedState === undefined) {
      if (isTemplate(this._config.entity)) {
        return this._renderWarning();
      } else {
        return this._renderWarning(this._config.entity, this.hass.localize("ui.badge.entity.not_found"), undefined, "error", mdiAlertCircle);
      }
    }

    const icon = this._templateResults?.icon?.result ?? this._config.icon;

    if (stateObj?.state === "unavailable") {
      return this._renderWarning(this._templateResults?.name?.result ?? (isTemplate(String(this._config.name)) ? "" : this._config.name) ?? stateObj.attributes.friendly_name ?? '', this.hass.localize("state.default.unavailable"), stateObj, "warning", icon);
    }

    const domain = computeStateDomain(stateObj);
    let secondsUntil: number | undefined;

    if (stateObj?.attributes.device_class === "timestamp" ||
      TIMESTAMP_STATE_DOMAINS.includes(domain)
    ) {
      secondsUntil = getTimestampRemainingSeconds(stateObj);
      this._isTimerOrTimestamp = true;
    }

    let timerDuration: number | undefined;

    if (domain === "timer") {
      timerDuration = durationToSeconds(stateObj.attributes?.duration ?? "00:00");
      secondsUntil = getTimerRemainingSeconds(stateObj);
      this._isTimerOrTimestamp = true;
    }

    const numberState = Number(templatedState ?? secondsUntil ?? stateObj.attributes[this._config.attribute!] ?? stateObj.state);

    if (isNaN(numberState)) {
      return this._renderWarning(this._templateResults?.name?.result ?? (isTemplate(String(this._config.name)) ? "" : this._config.name) ?? stateObj.attributes.friendly_name ?? '', "NaN", stateObj, "warning", icon);
    }

    const min = Number(this._templateResults?.min?.result ?? this._config.min) || DEFAULT_MIN;
    const max = Number(this._templateResults?.max?.result ?? this._config.max ?? timerDuration) || DEFAULT_MAX;

    const current = this._config.needle ? undefined : currentDashArc(numberState, min, max, RADIUS, this._config.start_from_zero, undefined, undefined, undefined, this._config.inverted_mode);

    const stateOverride = this._templateResults?.stateText?.result ?? (isTemplate(String(this._config.state_text)) ? "" : (this._config.state_text || undefined));
    const unit = this._config.show_unit ?? true ? (this._config.unit ?? stateObj?.attributes.unit_of_measurement) || "" : "";
    
    const showIcon = this._config.show_icon ?? true;

    const imageUrl = this._config.show_entity_picture
      ? getEntityPictureUrl(this.hass, stateObj)
      : undefined;

    const stateElement = html`
      <mcg-badge-state
        .hass=${this.hass}
        .stateObj=${stateObj}
        .unit=${unit}
        .stateOverride=${stateOverride ?? templatedState}
        .showSeconds=${this._config.show_seconds}
        .decimals=${this._config.decimals}
      ></mcg-badge-state>
    `;

    const name = this._templateResults?.name?.result ?? (isTemplate(String(this._config.name)) ? "" : this._config.name) ?? stateObj?.attributes.friendly_name ?? "";
    const label = this._config.show_name && showIcon && this._config.show_state ? name : undefined;
    const content = showIcon && this._config.show_state ? stateElement : this._config.show_name ? name : undefined;

    const segments = (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config.segments;

    const gaugeBackgroundStyle = this._config.gauge_background_style;
    const gaugeForegroundStyle = this._config.gauge_foreground_style;

    const needleAngle = getAngle(numberState, min, max, undefined, this._config.inverted_mode);

    return html`
    <ha-badge
      .type=${this.hasAction ? "button" : "badge"}
      @action=${this._handleAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config.hold_action),
        hasDoubleClick: hasAction(this._config.double_tap_action),
      })}
      .iconOnly=${content === undefined}
      style=${styleMap({ "--gauge-color": gaugeForegroundStyle?.color && gaugeForegroundStyle?.color != "adaptive" ? computeCssColor(gaugeForegroundStyle?.color) : computeSegments(numberState, segments, this._config.smooth_segments, this), "--gauge-stroke-width": gaugeForegroundStyle?.width ? `${gaugeForegroundStyle?.width}px` : undefined })}
      .label=${label}
    >
      <div class=${classMap({ "container": true, "icon-only": content === undefined })} slot="icon">
        <svg class="gauge" viewBox="-50 -50 100 100">
          <g transform="rotate(${ROTATE_ANGLE})">
            <defs>
            ${this._config.needle ? svg`
              <mask id="needle-mask">
                ${renderPath("arc", path, undefined, styleMap({ "stroke": "white", "stroke-width": gaugeBackgroundStyle?.width ? `${gaugeBackgroundStyle?.width}px` : undefined  }))}
                <circle cx="42" cy="0" r=${gaugeForegroundStyle?.width ? gaugeForegroundStyle?.width - 2 : 12} fill="black" transform="rotate(${needleAngle})"/>
              </mask>
              ` : nothing}
              <mask id="gradient-path">
                ${renderPath("arc", path, undefined, styleMap({ "stroke": "white", "stroke-width": gaugeBackgroundStyle?.width ? `${gaugeBackgroundStyle?.width}px` : undefined }))}
              </mask>
              <mask id="gradient-current-path">
                ${current ? renderPath("arc current", path, current, styleMap({ "stroke": "white", "visibility": numberState <= min && min >= 0 ? "hidden" : "visible" })) : nothing}
              </mask>
            </defs>
            <g mask="url(#needle-mask)">
              <g class="background" style=${styleMap({ "opacity": this._config.gauge_background_style?.opacity,
                "--gauge-stroke-width": this._config.gauge_background_style?.width ? `${this._config.gauge_background_style?.width}px` : undefined })}>
                ${this._config.segments && (this._config.needle || this._config.gauge_background_style?.color == "adaptive") ? svg`
                <g class=${classMap({ "segments": true, "segments-opaque": typeof this._config.gauge_background_style?.opacity != "undefined" })} mask=${ifDefined(this._config.smooth_segments ? "url(#gradient-path)" : undefined)}>
                  ${renderColorSegments(segments, min, max, RADIUS, this._config?.smooth_segments)}
                </g>`
                : svg`
                ${renderPath("arc clear", path, undefined, styleMap({ "stroke": gaugeBackgroundStyle?.color && gaugeBackgroundStyle?.color != "adaptive" ? computeCssColor(gaugeBackgroundStyle?.color) : undefined }))}
                `
                }
              </g>
            </g>
          ${this._config.needle ? svg`
            <circle class="needle" cx="42" cy="0" r=${gaugeForegroundStyle?.width ? gaugeForegroundStyle?.width / 2 : 7} transform="rotate(${needleAngle})"/>
          ` : nothing}
          ${current ? gaugeForegroundStyle?.color == "adaptive" ? svg`
            <g class="foreground-segments" mask="url(#gradient-current-path)" style=${styleMap({ "opacity": gaugeForegroundStyle?.opacity })}>
              ${renderColorSegments(segments, min, max, RADIUS, this._config?.smooth_segments)}
            </g>
            ` : renderPath("arc current", path, current, styleMap({ "visibility": numberState <= min && min >= 0 ? "hidden" : "visible", "opacity": gaugeForegroundStyle?.opacity })) : nothing}
          </g>
        </svg>
        ${showIcon
          ? imageUrl
            ? html`<img src=${imageUrl} aria-hidden/>`
            : html`
            <ha-state-icon
              .hass=${this.hass}
              .stateObj=${stateObj}
              .icon=${icon}
            ></ha-state-icon>`
          : nothing}
        ${this._config.show_state && !showIcon
          ? html`
            <modern-circular-gauge-state
              class="state"
              .hass=${this.hass}
              .stateObj=${stateObj}
              .unit=${unit}
              .stateOverride=${stateOverride ?? templatedState}
              .showSeconds=${this._config.show_seconds}
              .decimals=${this._config.decimals}
            ></modern-circular-gauge-state>
          ` : nothing}
      </div>
      ${content}
    </ha-badge>
    `;
  }

  private _renderWarning(label?: string, content?: string, stateObj?: HassEntity, badgeClass?: string, icon?: string): TemplateResult {
    return html`
    <ha-badge
      .type=${this.hasAction ?? stateObj != undefined ? "button" : "badge"}
      @action=${ifDefined(stateObj ? this._handleAction : undefined)}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config?.hold_action),
        hasDoubleClick: hasAction(this._config?.double_tap_action),
      })}
      class="${ifDefined(badgeClass)}"
      .label=${label} 
      >
      <div class=${classMap({ "container": true, "icon-only": content === undefined })} slot="icon">
        <svg class="gauge" viewBox="-50 -50 100 100">
          <g transform="rotate(${ROTATE_ANGLE})">
            ${renderPath("arc clear", path)}
          </g>
        </svg>
        ${stateObj ? html`
        <ha-state-icon
          slot="icon"
          .hass=${this.hass}
          .stateObj=${stateObj}
          .icon=${icon}
        ></ha-state-icon>
        ` : html`
        <ha-svg-icon
          slot="icon"
          .path=${icon}
        ></ha-svg-icon>
        `}
      </div>
      ${content}
    </ha-badge>
    `;
  }

  private _calcStateSize(state: string): string {
    const initialSize = 25;
    if (state.length >= 4) {
      return `${initialSize - (state.length - 3)}px`
    }
    return `${initialSize}px`;
  }

  private _handleAction(ev: ActionHandlerEvent) {
    const config = {
      ...this._config,
      entity: isTemplate(this._config?.entity ?? "") ? "" : this._config?.entity
    };

    handleAction(this, this.hass!, config, ev.detail.action!);
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
      --state-font-size-override: 25px;
      --unit-font-size: .53em;
    }

    .container {
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      container-type: normal;
      container-name: container;
      width: calc(var(--ha-badge-size, 36px) - 2px);
      height: calc(var(--ha-badge-size, 36px) - 2px);
      margin-left: -12px;
      margin-inline-start: -12px;
      pointer-events: none;
    }

    .container img {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      overflow: hidden;
      margin-right: 0;
      margin-inline-end: 0;
    }
    
    .container.icon-only {
      margin-left: 0;
      margin-inline-start: 0;
    }

    .gauge {
      position: absolute;
    }

    .segment {
      fill: none;
      stroke-width: var(--gauge-stroke-width);
    }

    .segments {
      opacity: var(--gauge-segments-opacity, 0.45);
    }

    .segments-opaque {
      opacity: var(--gauge-segments-opacity, 1);
    }

    ha-badge {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      --badge-color: var(--gauge-color);
    }

    ha-badge.error {
      --badge-color: var(--red-color);
    }

    ha-badge.warning {
      --badge-color: var(--state-unavailable-color);
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

    .needle {
      fill: var(--gauge-color);
      stroke: var(--gauge-color);
      transition: all 1s ease 0s;
    }

    circle {
      transition: all 1s ease 0s;
    }
    `
  }
}