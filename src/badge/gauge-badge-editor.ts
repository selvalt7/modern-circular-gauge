import { LitElement, html, nothing, css } from "lit";
import { HomeAssistant } from "../ha/types";
import { customElement, property, state } from "lit/decorators.js";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MAX, DEFAULT_MIN } from "../const";
import { fireEvent } from "../ha/common/dom/fire_event";
import { mdiSegment } from "@mdi/js";
import { hexToRgb } from "../utils/color";
import "../components/ha-form-mcg-list";
import localize from "../localize/localize";

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
        selector: { boolean: {} },
      },
      {
        name: "min",
        default: DEFAULT_MIN,
        selector: { number: { step: 0.1 } },
      },
      {
        name: "max",
        default: DEFAULT_MAX,
        selector: { number: { step: 0.1 } },
      },
      {
        name: "show_name",
        default: false,
        selector: { boolean: {} },
      },
      {
        name: "show_state",
        default: true,
        selector: { boolean: {} },
      },
      {
        name: "show_unit",
        default: true,
        selector: { boolean: {} },
      },
      {
        name: "show_icon",
        default: true,
        selector: { boolean: {} },
      },
      {
        name: "smooth_segments",
        selector: { boolean: {} },
      },
    ]
  },
  {
    name: "segments",
    type: "mcg-list",
    iconPath: mdiSegment,
    schema: [
      {
        name: "",
        type: "grid",
        column_min_width: "100px",
        schema: [
          {
            name: "from",
            required: true,
            selector: { number: { step: 0.1 } },
          },
          {
            name: "color",
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
    return this.hass?.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`) || localize(this.hass, `editor.${schema.name}`);
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