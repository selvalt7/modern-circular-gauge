import { html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HassEntity } from "home-assistant-js-websocket";
import { computeState } from "../utils/compute-state";
import { processEntityState } from "../utils/entity-state-processor";

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

  @property() public timeFormat?: "compact" | "minutes" | "digital";

  @property() public stateFormat?: "default" | "direction" | "percentage";

  @property({ type: Number }) public min?: number;

  @property({ type: Number }) public max?: number;

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  protected render(): TemplateResult {
    if (!this.hass || (!this.stateObj && this.stateOverride === undefined)) {
      return html``;
    }

    const processedState = processEntityState(this.hass, this.stateObj, {
      entityAttribute: this.entityAttribute,
      stateOverride: this.stateOverride || undefined,
      decimals: this.decimals,
      showSeconds: this.showSeconds,
      timeFormat: this.timeFormat,
      stateFormat: this.stateFormat,
      min: this.min,
      max: this.max
    });

    const state = processedState.displayState;
    const unit = this.showUnit ? this.unit ?? processedState.unit ?? this.stateObj?.attributes.unit_of_measurement ?? "" : "";

    return html`
      ${state} ${unit}
    `;
  }
}