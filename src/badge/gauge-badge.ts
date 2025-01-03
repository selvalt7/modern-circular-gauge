import { LitElement, TemplateResult, html, css, nothing, PropertyValues, svg } from "lit";
import { HomeAssistant } from "../ha/types";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { customElement, property, state } from "lit/decorators.js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX } from "../const";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { registerCustomBadge } from "../utils/custom-badges";
import { HassEntity, UnsubscribeFunc } from "home-assistant-js-websocket";
import { styleMap } from "lit/directives/style-map.js";
import { svgArc, clamp } from "../utils/gauge";
import { classMap } from "lit/directives/class-map.js";
import { ActionHandlerEvent, hasAction } from "custom-card-helpers";
import { handleAction } from "../ha/handle-action";
import { actionHandler } from "../utils/action-handler-directive";
import { mdiAlertCircle } from "@mdi/js";
import { rgbToHex } from "../utils/color";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/ws-templates";
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

const TEMPLATE_KEYS = ["min", "max", "entity"];

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

    TEMPLATE_KEYS.forEach((key) => {
      if (this._config?.[key] !== config[key]) {
        this._tryDisconnectKey(key);
      }
    });

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

  get hasAction() {
    return (
      !this._config?.tap_action ||
      hasAction(this._config?.tap_action) ||
      hasAction(this._config?.hold_action) ||
      hasAction(this._config?.double_tap_action)
    );
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
                <path
                  class="arc clear"
                  d=${path}
                />
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

    const min = Number(this._getValue("min")) ?? DEFAULT_MIN;

    const attributes = stateObj?.attributes ?? undefined;

    const numberState = Number(templatedState ?? stateObj.state);

    const unit = (this._config.unit ?? stateObj?.attributes.unit_of_measurement) || "";

    const current = this._config.needle ? undefined : this._strokeDashArc(numberState > 0 ? 0 : numberState, numberState > 0 ? numberState : 0);
    const state = templatedState ?? stateObj.state;
    const entityState = formatNumber(state, this.hass.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass.entities[stateObj?.entity_id])) ?? templatedState;

    const name = this._config.name || stateObj?.attributes.friendly_name;
    const label = this._config.show_name && this._config.show_icon && this._config.show_state ? name : undefined;
    const content = this._config.show_icon && this._config.show_state ? `${entityState} ${unit}` : this._config.show_name ? name : undefined;

    return html`
    <ha-badge
      .type=${this.hasAction ? "button" : "badge"}
      @action=${this._handleAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config.hold_action),
        hasDoubleClick: hasAction(this._config.double_tap_action),
      })}
      .iconOnly=${content === undefined}
      style=${styleMap({ "--gauge-color": this._computeSegments(numberState) })}
      .label=${label}
    >
      <div class=${classMap({ "container": true, "icon-only": content === undefined })} slot="icon">
        <svg class="gauge" viewBox="-50 -50 100 100">
          <g transform="rotate(${ROTATE_ANGLE})">
          ${this._config.needle ? svg`
            <mask id="needle-mask">
              <rect x="-50" y="-50" width="100" height="100" fill="white"/>
              <circle cx="42" cy="0" r="12" fill="black" transform="rotate(${this._getAngle(numberState)})"/>
            </mask>
          ` : nothing}

            <path
              class="arc clear"
              d=${path}
              mask="url(#needle-mask)"
            />
          ${this._config.needle ? svg`
            ${this._config.segments ? svg`
            <g class="segments" mask="url(#needle-mask)">
              ${this._renderSegments(this._config.segments)}
            </g>  
            ` : nothing}
            <circle class="needle" cx="42" cy="0" r="7" transform="rotate(${this._getAngle(numberState)})"/>
          ` : nothing}
          ${current ? svg`
              <path
                class="arc current"
                style=${styleMap({ "visibility": numberState <= min && min >= 0 ? "hidden" : "visible" })}
                d=${path}
                stroke-dasharray="${current[0]}"
                stroke-dashoffset="${current[1]}"
              />
          ` : nothing}
          </g>
        </svg>
        ${this._config.show_icon
          ? html`
          <ha-state-icon
            .hass=${this.hass}
            .stateObj=${stateObj}
            .icon=${this._config.icon}
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

  private _renderSegments(segments: SegmentsConfig[]): TemplateResult[] {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => a.from - b.from);

      return [...sortedSegments].map((segment, index) => {
        let roundEnd: TemplateResult | undefined;
        const startAngle = index === 0 ? 0 : this._getAngle(segment.from);
        const angle = index === sortedSegments.length - 1 ? MAX_ANGLE : this._getAngle(sortedSegments[index + 1].from);
        const color = typeof segment.color === "object" ? rgbToHex(segment.color) : segment.color;
        const segmentPath = svgArc({
          x: 0,
          y: 0,
          start: startAngle,
          end: angle,
          r: RADIUS,
        });

        if (index === 0 || index === sortedSegments.length - 1) {
          const endPath = svgArc({
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

  private _getValue(key: string) {
    return isTemplate(this._config?.[key])
      ? this._templateResults?.[key]?.result?.toString()
      : this._config?.[key];
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
      height: var(--ha-badge-size, 36px);
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
      opacity: 0.3;
    }

    ha-badge {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      --badge-color: var(--gauge-color)
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