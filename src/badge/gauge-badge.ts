import { LitElement, TemplateResult, html, css, nothing, PropertyValues, svg } from "lit";
import { HomeAssistant } from "../ha/types";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { customElement, property, state } from "lit/decorators.js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX } from "../const";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { registerCustomBadge } from "../utils/custom-badges";
import { HassEntity, UnsubscribeFunc } from "home-assistant-js-websocket";
import { styleMap } from "lit/directives/style-map.js";
import { svgArc, strokeDashArc, computeSegments, getAngle, renderPath, renderColorSegments } from "../utils/gauge";
import { classMap } from "lit/directives/class-map.js";
import { ActionHandlerEvent } from "../ha/data/lovelace";
import { hasAction } from "../ha/panels/lovelace/common/has-action";
import { handleAction } from "../ha/handle-action";
import { actionHandler } from "../utils/action-handler-directive";
import { mdiAlertCircle } from "@mdi/js";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/data/ws-templates";
import { isTemplate } from "../utils/template";
import { SegmentsConfig } from "../card/type";

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

  @state() private _unsubRenderTemplates?: Map<string, Promise<UnsubscribeFunc>> = new Map();

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
        const segmentsStringified = JSON.stringify(value);
        this._tryConnectKey(key, segmentsStringified);
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
    };
    
    Object.entries(templates).forEach(([key, _]) => {
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

    const stateObj = this.hass.states[this._config.entity];
    const templatedState = this._templateResults?.entity?.result;    

    if (!stateObj && templatedState === undefined) {
      if (isTemplate(this._config.entity)) {
        return html`
        <ha-badge
          .type=${this.hasAction ? "button" : "badge"}
          @action=${this._handleAction}
          .actionHandler=${actionHandler({
            hasHold: hasAction(this._config.hold_action),
            hasDoubleClick: hasAction(this._config.double_tap_action),
          })}
          .iconOnly=${!this._config.show_name}
        >
          <div class=${classMap({ "container": true, "icon-only": !this._config.show_name })} slot="icon">
            <svg class="gauge" viewBox="-50 -50 100 100">
              <g transform="rotate(${ROTATE_ANGLE})">
                ${renderPath("arc clear", path)}
              </g>
            </svg>
          </div>
        </ha-badge>
        `;
      } else {
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
    }

    const min = Number(this._templateResults?.min?.result ?? this._config.min) ?? DEFAULT_MIN;
    const max = Number(this._templateResults?.max?.result ?? this._config.max) ?? DEFAULT_MAX;

    const attributes = stateObj?.attributes ?? undefined;

    const numberState = Number(templatedState ?? stateObj.state);

    
    const current = this._config.needle ? undefined : strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0, min, max, RADIUS);
    const state = templatedState ?? stateObj.state;

    const stateOverride = this._templateResults?.stateText?.result ?? (isTemplate(String(this._config.state_text)) ? "" : this._config.state_text);
    const unit = stateOverride ? "" : (this._config.unit ?? stateObj?.attributes.unit_of_measurement) || "";

    const entityState = stateOverride ?? formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    const name = this._templateResults?.name?.result ?? this._config.name ?? stateObj?.attributes.friendly_name ?? "";
    const label = this._config.show_name && this._config.show_icon && this._config.show_state ? name : undefined;
    const content = this._config.show_icon && this._config.show_state ? `${entityState} ${unit}` : this._config.show_name ? name : undefined;

    const segments = (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config.segments;

    return html`
    <ha-badge
      .type=${this.hasAction ? "button" : "badge"}
      @action=${this._handleAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config.hold_action),
        hasDoubleClick: hasAction(this._config.double_tap_action),
      })}
      .iconOnly=${content === undefined}
      style=${styleMap({ "--gauge-color": computeSegments(numberState, segments, this._config.smooth_segments) })}
      .label=${label}
    >
      <div class=${classMap({ "container": true, "icon-only": content === undefined })} slot="icon">
        <svg class="gauge" viewBox="-50 -50 100 100">
          <g transform="rotate(${ROTATE_ANGLE})">
            <defs>
            ${this._config.needle ? svg`
              <mask id="needle-mask">
                ${renderPath("arc", path, undefined, styleMap({ "stroke": "white" }))}
                <circle cx="42" cy="0" r="12" fill="black" transform="rotate(${getAngle(numberState, min, max)})"/>
              </mask>
              ` : nothing}
            </defs>
            <g mask="url(#needle-mask)">
              ${renderPath("arc clear", path)}
              ${this._config.segments && (this._config.needle) ? svg`
              <g class="segments">
                ${renderColorSegments(segments, min, max, RADIUS, this._config?.smooth_segments)}
              </g>`
              : nothing}
            </g>
          ${this._config.needle ? svg`
            <circle class="needle" cx="42" cy="0" r="7" transform="rotate(${getAngle(numberState, min, max)})"/>
          ` : nothing}
          ${current ? renderPath("arc current", path, current, styleMap({ "visibility": numberState <= min && min >= 0 ? "hidden" : "visible" })) : nothing}
          </g>
        </svg>
        ${this._config.show_icon
          ? html`
          <ha-state-icon
            .hass=${this.hass}
            .stateObj=${stateObj}
            .icon=${this._templateResults?.icon?.result ?? this._config.icon}
          ></ha-state-icon>`
          : nothing}
        ${this._config.show_state && !this._config.show_icon
          ? html`
          <svg class="state" viewBox="-50 -50 100 100">
            <text x="0" y="0" class="value" style=${styleMap({ "font-size": this._calcStateSize(entityState) })}>
              ${entityState}
              <tspan class="unit" dx="-4" dy="-6">${unit}</tspan>
            </text>
          </svg>
          ` : nothing}
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
    }

    .value {
      font-size: 21px;
      fill: var(--primary-text-color);
      dominant-baseline: middle;
    }

    .unit {
      font-size: .43em;
      opacity: 0.6;
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
      filter: brightness(100%);
    }

    .segments {
      opacity: 0.35;
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