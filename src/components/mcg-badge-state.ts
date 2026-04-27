import { html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HassEntity } from "home-assistant-js-websocket";
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

  @property() public stateFormat?: "default" | "wind_direction" | "percentage";

  @property({ type: Number }) public min?: number;

  @property({ type: Number }) public max?: number;

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  protected render(): TemplateResult {
    const state = computeState(this.hass!, this.stateObj, {
      entityAttribute: this.entityAttribute,
      stateOverride: this.stateOverride || undefined,
      decimals: this.decimals,
      showSeconds: this.showSeconds,
      stateFormat: this.stateFormat,
      min: this.min,
      max: this.max
    });

    return html`
      ${state} ${this.unit}
    `;
  }
}