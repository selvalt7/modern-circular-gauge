import { LitElement, html, nothing } from "lit";
import { HomeAssistant } from "../ha/types";
import { customElement, property, state } from "lit/decorators.js";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MAX, DEFAULT_MIN } from "../const";
import { fireEvent } from "custom-card-helpers";


const FORM = [
  {
    name: "entity",
    required: true,
    selector: { entity: {
        domain: NUMBER_ENTITY_DOMAINS,
    }},
  },
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "name",
        selector: { text: {} },
      },
      {
        name: "unit",
        selector: { text: {} },
      },
      {
        name: "min",
        default: DEFAULT_MIN,
        label: "generic.minimum",
        selector: { number: {} },
      },
      {
        name: "max",
        default: DEFAULT_MAX,
        label: "generic.maximum",
        selector: { number: {} },
      },
      {
        name: "show_name",
        label: "Show name",
        default: false,
        selector: { boolean: {} },
      },
      {
        name: "show_state",
        label: "Show state",
        default: true,
        selector: { boolean: {} },
      },
    ]
  },
  {
    name: "tap_action",
    selector: {
        ui_action: {
        },
    },
  }
]

@customElement("modern-circular-gauge-badge-editor")
export class ModernCircularGaugeBadgeEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeBadgeConfig;

  setConfig(config: ModernCircularGaugeBadgeConfig): void {
      this._config = config;
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    return html`
    <ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${FORM}
      .computeLabel=${this._computeLabel}
      @value-changed=${this._valueChanged}
    ></ha-form>
    `;
  }

  private _computeLabel = (schema: any) => {
    let label = this.hass?.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`);
    if (label) return label;
    label = this.hass?.localize(`ui.panel.lovelace.editor.card.${schema.label}`);
    if (label) return label;
    return schema.label;
  };

  private _valueChanged(ev: CustomEvent): void {
    let config = ev.detail.value as ModernCircularGaugeBadgeConfig;
    if (!config) {
      return;
    }

    fireEvent(this, "config-changed", { config });
  }
}