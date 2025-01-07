import { LitElement, html, nothing, css } from "lit";
import { HomeAssistant } from "../ha/types";
import { customElement, property, state } from "lit/decorators.js";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MAX, DEFAULT_MIN } from "../const";
import { fireEvent } from "custom-card-helpers";
import { mdiSegment } from "@mdi/js";
import { hexToRgb } from "../utils/color";
import "../components/ha-form-mcg-list";

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
        name: "icon",
        selector: { icon: {} },
        context: { icon_entity: "entity" },
      },
      {
        name: "needle",
        label: "gauge.needle_gauge",
        selector: { boolean: {} },
      },
      {
        name: "min",
        default: DEFAULT_MIN,
        label: "generic.minimum",
        selector: { number: { step: 0.1 } },
      },
      {
        name: "max",
        default: DEFAULT_MAX,
        label: "generic.maximum",
        selector: { number: { step: 0.1 } },
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
      {
        name: "show_icon",
        label: "Show icon",
        default: false,
        selector: { boolean: {} },
      },
      {
        name: "smooth_segments",
        label: "Smooth color segments",
        selector: { boolean: {} },
      },
    ]
  },
  {
    name: "segments",
    type: "mcg-list",
    title: "Color segments",
    iconPath: mdiSegment,
    schema: [
      {
        name: "",
        type: "grid",
        column_min_width: "100px",
        schema: [
          {
            name: "from",
            label: "From",
            required: true,
            selector: { number: { step: 0.1 } },
          },
          {
            name: "color",
            label: "heading.entity_config.color",
            required: true,
            selector: { color_rgb: {} },
          },
        ],
      },
    ],
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

    const DATA = {
      ...this._config,
      segments: this._config.segments?.map(value => {
        let color = value.color;
        if (typeof value.color === "string") {
            color = hexToRgb(value.color) as any;
        }
        return { ...value, color };
      })
    };

    return html`
    <ha-form
      .hass=${this.hass}
      .data=${DATA}
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

  static get styles() {
    return css`
    `;
  }
}