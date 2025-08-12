import { html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HassEntity } from "home-assistant-js-websocket";
import { TIMESTAMP_STATE_DOMAINS } from "../const";
import { computeStateDomain } from "../ha/common/entity/compute_state_domain";
import { computeState } from "../utils/compute-state";

@customElement("mcg-badge-state")
export class McgBadgeState extends LitElement {
  @property({attribute: false}) public hass?: HomeAssistant;

  @property({type: Object}) public stateObj?: HassEntity;

  @property({type: String}) public entityAttribute?: string;

  @property({type: String}) public unit?: string;

  @property({type: Number}) public decimals?: number;

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
    }, (this.showSeconds ?? true) ? 1000 : 60000);
  }

  private _clearInterval(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = undefined;
    }
  }

  protected render(): TemplateResult {
    const state = computeState(this.hass!, this.stateObj!, this.entityAttribute!, this.stateOverride!, this.decimals, this.showSeconds);

    return html`
      ${state} ${this.unit}
    `;
  }
}