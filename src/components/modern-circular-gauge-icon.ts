import { html, LitElement, css, svg, PropertyValues, nothing } from "lit";
import { customElement, property, queryAsync, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HassEntity } from "home-assistant-js-websocket";


const ICONPOSITIONS = [-3.6, -4.8, -5.52, -12];
const ICONSIZES = [0.12, 0.12, 0.18, 0.3];

@customElement("modern-circular-gauge-icon")
export class ModernCircularGaugeIcon extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public stateObj?: HassEntity;

  @property() public icon?: string;

  @property({ type: Boolean }) public showEntityPicture? = false;

  /**
   * Position of the icon in the gauge.
   * 0: Secondary with label, 1: Secondary, 2: No secondary, 3: No primary state
   */
  @property({ type: Number }) public position = 2;

  @property({ type: Number }) public iconVerticalPositionOverride?: number;

  @property({ type: Number }) public iconSizeOverride?: number;

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

    if (this.showEntityPicture) {
      return;
    }

    this._haStateIcon.then( async (haStateIcon) => {
      if (!haStateIcon || !haStateIcon.shadowRoot) {
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
        const gaugeIcon = this.shadowRoot!.querySelector('.gauge-icon-group') as SVGElement;
        const iconGroup = svg.querySelector('g');
        if (gaugeIcon && iconGroup) {
          gaugeIcon.appendChild(iconGroup);
          this._updated = true;
        }
      }
    });
  }

  private _computeIconPosition(): number {
    if (this.iconVerticalPositionOverride !== undefined) {
      return this.iconVerticalPositionOverride * 24 * -0.01;
    }
    return ICONPOSITIONS[this.position];
  }

  private _computeIconSize(): number {
    if (this.iconSizeOverride !== undefined) {
      return this.iconSizeOverride * 0.01;
    }
    return ICONSIZES[this.position];
  }

  private _getImageUrl(entity: HassEntity): string | undefined {
    if (!entity || !entity.attributes) {
      return undefined;
    }
    
    const entityPicture =
      entity.attributes.entity_picture_local ||
      entity.attributes.entity_picture;

    if (!entityPicture) return undefined;

    let imageUrl = this.hass!.hassUrl(entityPicture);

    return imageUrl;
  }

  protected render() {
    const imageUrl = this.showEntityPicture
      ? this._getImageUrl(this.stateObj!)
      : undefined;
      
    return html`
    ${!imageUrl ? html`
      <ha-state-icon
        .hass=${this.hass}
        .stateObj=${this.stateObj}
        .icon=${this.icon}
      ></ha-state-icon>
    ` : nothing}
    <svg class="gauge-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <g class="gauge-icon-group" transform="translate(0 12) translate(0 ${this._computeIconPosition()}) translate(12 12) scale(${this._computeIconSize()}) translate(-12 -12)">
        ${imageUrl ? svg`
          <image href="${imageUrl}" width="24" height="24"></image>
        ` : nothing}
      </g>
    </svg>`;
  }

  static styles = css`
    :host {
      width: 100%;
      height: 100%;
      fill: var(--icon-primary-color, currentcolor);
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    path.primary-path {
      opacity: var(--icon-primary-opactity, 1);
    }
    path.secondary-path {
      fill: var(--icon-secondary-color, currentcolor);
      opacity: var(--icon-secondary-opactity, 0.5);
    }

    ha-state-icon {
      visibility: hidden;
      position: absolute;
    }
  `;
}