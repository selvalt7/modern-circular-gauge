import { html, LitElement, css, PropertyValues, svg, nothing } from "lit";
import { customElement, property, queryAsync, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HassEntity } from "home-assistant-js-websocket";

@customElement("modern-circular-gauge-icon")
export class ModernCircularGaugeIcon extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public stateObj?: HassEntity;

  @property() public icon?: string;

  @queryAsync('ha-state-icon') private _haStateIcon!: Promise<HTMLElement>;

  @state() private _updated = false;

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
  }

  protected updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    if (this._updated) {
      return;
    }

    this._haStateIcon.then( async (haStateIcon) => {
      if (!haStateIcon.shadowRoot) {
        return;
      }

      this._getSvgFromHaStateIcon(haStateIcon);
      
      if (!this._updated) {
        const observer = new MutationObserver(() => {
          this._getSvgFromHaStateIcon(haStateIcon);
          observer.disconnect();
        });

        observer.observe(haStateIcon.shadowRoot, {
          childList: true,
          subtree: true,
        });
      }
    });
  }

  private _getSvgFromHaStateIcon(haStateIconEl) {
    const haIcon = haStateIconEl.shadowRoot?.querySelector('ha-icon');
    if (!haIcon) {
      return;
    }
    (haIcon as any)?.updateComplete?.then(() => {
      const haSvgIcon = haIcon?.shadowRoot?.querySelector('ha-svg-icon');
      const svg = haSvgIcon?.shadowRoot?.querySelector('svg');
      if (svg) {
        const gaugeIcon = this.shadowRoot!.querySelector('.gauge-icon') as SVGElement;
        const iconGroup = svg.querySelector('g');
        if (gaugeIcon && iconGroup) {
          gaugeIcon.appendChild(iconGroup);
          this._updated = true;
        }
      }
    });
  }

  protected render() {
    return html`
    <ha-state-icon
      .hass=${this.hass}
      .stateObj=${this.stateObj}
      .icon=${this.icon}
    ></ha-state-icon>
    <svg class="gauge-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    </svg>`;
  }

  static styles = css`
    :host {
      width: 100%;
      height: 100%;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    g {
      transform-origin: center;
      transform: scale(0.18);
    }

    ha-state-icon {
      visibility: hidden;
      position: absolute;
    }
  `;
}