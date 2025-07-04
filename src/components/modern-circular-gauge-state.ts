import { html, LitElement, css, PropertyValues, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { getNumberFormatOptions, formatNumber } from "../utils/format_number";
import { HassEntity } from "home-assistant-js-websocket";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";

@customElement("modern-circular-gauge-state")
export class ModernCircularGaugeState extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ type: Object }) public stateObj?: HassEntity;

  @property() public unit?: string;

  @property({ type: Boolean }) public showUnit = true;

  @property() public label?: string;

  @property({ type: Number }) public labelFontSize?: number;

  @property({ type: Boolean }) public small = false;

  @property({ type: Number}) public verticalOffset?: number;

  @property() public stateOverride?: string;

  @property({ type: Number }) public stateMargin: number = 82;

  @state() private _updated = false;

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
      const state = this.stateOverride ?? this.stateObj.state;
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
    const maxWidth = this.stateMargin - Math.abs((this.verticalOffset) ?? 0) * 0.5;

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
    <svg class="state ${classMap({ "small": this.small })}" overflow="visible" viewBox="-50 -50 100 100">
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

      pointer-events: none;
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
      font-size: var(--state-font-size);
      fill: var(--state-text-color-override, var(--state-text-color));
      dominant-baseline: middle;
      pointer-events: auto;
    }

    .unit {
      font-size: .33em;
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
      font-size: 10px;
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
