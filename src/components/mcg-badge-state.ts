import { html, LitElement, css, PropertyValues, svg, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HassEntity } from "home-assistant-js-websocket";
import { TIMESTAMP_STATE_DOMAINS } from "../const";
import { computeStateDomain } from "../ha/common/entity/compute_state_domain";
import { formatNumber, getNumberFormatOptions } from "../utils/format_number";
import secondsToDuration from "../utils/seconds_to_duration";

@customElement("mcg-badge-state")
export class McgBadgeState extends LitElement {
  @property({attribute: false}) public hass?: HomeAssistant;

  @property({type: Object}) public stateObj?: HassEntity;

  @property({type: String}) public entityAttribute?: string;

  @property({type: String}) public unit?: string;

  @property({type: Boolean}) public showUnit = true;

  @property({type: String}) public stateOverride?: string;

  @property({ type: Boolean }) public showSeconds = true;

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

  private _startInterval(): void {
    if (this._interval) {
      clearInterval(this._interval);
    }
    this._interval = setInterval(() => {
      this.requestUpdate();
    }, this.showSeconds ? 1000 : 60000);
  }

  private _clearInterval(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = undefined;
    }
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

  protected render(): TemplateResult {
    const state = this._computeState();

    return html`
      ${state} ${this.unit}
    `;
  }
}