import { html, LitElement, css, PropertyValues, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { HassEntity } from "home-assistant-js-websocket";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { GaugeType } from "../card/type";
import { TIMESTAMP_STATE_DOMAINS } from "../const";
import { computeStateDomain } from "../ha/common/entity/compute_state_domain";
import secondsToDuration from "../utils/seconds_to_duration";

@customElement("modern-circular-gauge-state")
export class ModernCircularGaugeState extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ type: Object }) public stateObj?: HassEntity;

  @property({ type: String }) public entityAttribute?: string;

  @property() public unit?: string;

  @property({ type: Boolean }) public showUnit = true;

  @property() public label?: string;

  @property({ type: Number }) public labelFontSize?: number;

  @property({ type: String }) public gaugeType: GaugeType = "standard";

  @property({ type: Boolean }) public small = false;

  @property({ type: Number}) public verticalOffset?: number;

  @property({ type: Number }) public horizontalOffset?: number;

  @property() public stateOverride?: string;

  @property({ type: Number }) public stateMargin: number = 82;

  @property({ type: Boolean }) public showSeconds = true;

  @state() private _updated = false;

  private _interval?: any;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.stateObj) {
      const domain = computeStateDomain(this.stateObj);
      if (this.stateObj?.attributes.device_class === "timestamp" ||
        TIMESTAMP_STATE_DOMAINS.includes(domain)
      ) {
        this._startInterval();
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._clearInterval();
  }

  private _startInterval() {
    this._clearInterval();
    this._interval = setInterval(() => {
      this.requestUpdate();
    }, (this.showSeconds ?? true) ? 1000 : 60000);
  }

  private _clearInterval() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = undefined;
    }
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this._updated = true;
    this._scaleText();
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    if (!this._updated) {
      return;
    }
    this._scaleText();
  }

  private _computeState(): string {
    if (!this.stateObj && this.stateOverride !== undefined) {
      return this.stateOverride;
    }

    if (this.stateObj) {
      const domain = computeStateDomain(this.stateObj);
      let secondsUntil: number | undefined;

      if (this.stateObj?.attributes.device_class === "timestamp" ||
        TIMESTAMP_STATE_DOMAINS.includes(domain)
      ) {
        const timestamp = new Date(this.stateObj.state);
        secondsUntil = Math.round(Math.abs(timestamp.getTime() - Date.now()) / 1000);
        return secondsToDuration(secondsUntil, this.showSeconds ?? true) || "0";
      }

      if (domain === "timer") {
        secondsUntil = 0;
        if (this.stateObj.state === "active") {
          const timestamp = new Date(this.stateObj.attributes?.finishes_at);
          secondsUntil = Math.round(Math.abs(timestamp.getTime() - Date.now()) / 1000);
          return secondsToDuration(secondsUntil, this.showSeconds ?? true) || "0";
        }
      }

      const state = this.stateOverride ?? this.stateObj.attributes[this.entityAttribute!] ?? this.stateObj.state;
      const attributes = this.stateObj.attributes ?? undefined;
      const entityState = Number.isNaN(state) ? state
        : formatNumber(state, this.hass?.locale, getNumberFormatOptions({ state, attributes } as HassEntity, this.hass?.entities[this.stateObj?.entity_id]));
      return entityState;
    }

    return "";
  }

  private _scaleText() {
    const svgRoot = this.shadowRoot!.querySelector(".state")!;
    if (!svgRoot) {
      return;
    }
    const svgText = svgRoot.querySelector("text")!;
    const bbox = svgText.getBBox();
    const maxWidth = (Math.abs(this.stateMargin) - Math.abs((this.verticalOffset ?? 0) * 0.5)) * (this.horizontalOffset != 0 ? 0.5 : 1);

    if (bbox.width > maxWidth) {
      const scale = maxWidth / bbox.width;
      if (this.verticalOffset) {
        svgText.setAttribute("transform", `translate(0 ${this.verticalOffset}) scale(${scale}) translate(0 ${-this.verticalOffset})`);
      } else {
        svgText.setAttribute("transform", `scale(${scale})`);
      }
    } else {
      svgText.removeAttribute("transform");
    }
  }

  protected render() {
    if (!this.hass || (!this.stateObj && this.stateOverride === undefined)) {
      return html``;
    }

    const state = this._computeState();
    const verticalOffset = this.verticalOffset ?? 0;

    return html`
    <svg class="state ${classMap({ "small": this.small })}" overflow="visible" viewBox="${-50 + (this.horizontalOffset ?? 0)} -50 100 ${this.gaugeType == "half" ? 50 : 100}">
      <text x="0" y=${verticalOffset} class="value">
        ${state}
        ${this.showUnit ? this.small ? this.unit : svg`
        <tspan class="unit" dx=${-4} dy=${-6}>${this.unit}</tspan>
        ` : nothing}
      </text>
      <text class="state-label" style=${styleMap({ "font-size": this.labelFontSize ? `${this.labelFontSize}px` : undefined })} y=${verticalOffset + (this.small ? (9 * Math.sign(verticalOffset)) : 13)}>
        ${this.label}
      </text>
    </svg>
    `;
  }

  static get styles() {
    return css`
    :host {
      --state-text-color: var(--primary-text-color);
      --state-font-size: 24px;
      --state-pointer-events: auto;

      pointer-events: none;
    }

    :host(.preview) {
      --state-pointer-events: none;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
    }

    .state {
      text-anchor: middle;
    }

    .value {
      font-size: var(--state-font-size-override, var(--state-font-size));
      fill: var(--state-text-color-override, var(--state-text-color));
      dominant-baseline: middle;
      pointer-events: var(--state-pointer-events);
    }

    .unit {
      font-size: var(--unit-font-size, .33em);
      opacity: 0.6;
    }

    .small {
      --state-text-color: var(--state-text-color-override, var(--secondary-text-color));
    }

    .small .unit {
      opacity: 1;
      font-size: inherit;
    }

    .small .value {
      --state-font-size: 10px;
      fill: var(--state-text-color);
    }

    .state-label {
      font-size: 0.49em;
      fill: var(--secondary-text-color);
      dominant-baseline: middle;
    }
    `;
  }
}
