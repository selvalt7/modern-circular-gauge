import { LitElement, html, nothing, css } from "lit";
import { HomeAssistant } from "../ha/types";
import { customElement, property, state } from "lit/decorators.js";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MAX, DEFAULT_MIN, NON_NUMERIC_ATTRIBUTES } from "../const";
import { fireEvent } from "../ha/common/dom/fire_event";
import { mdiFlipToBack, mdiFlipToFront, mdiPalette, mdiSegment } from "@mdi/js";
import { hexToRgb } from "../utils/color";
import "../components/ha-form-mcg-list";
import { getGaugeStyleSchema } from "../card/mcg-schema";
import localize from "../localize/localize";

const FORM = [
  {
    name: "entity",
    type: "mcg-template",
    required: true,
    schema: { entity: {
      domain: NUMBER_ENTITY_DOMAINS,
    }},
  },
  {
    name: "attribute",
    selector: { 
      attribute: {
        hide_attributes: NON_NUMERIC_ATTRIBUTES,
      } 
    },
    context: {
      filter_entity: "entity",
    }
  },
  {
    name: "name",
    type: "mcg-template",
    schema: { text: {} },
  },
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "icon",
        type: "mcg-template",
        flatten: true,
        schema: { icon: {} },
        context: {
          icon_entity: "entity",
        },
      },
      {
        name: "unit",
        selector: { text: {} },
      },
      {
        name: "min",
        type: "mcg-template",
        default: DEFAULT_MIN,
        schema: { number: { step: 0.1 } },
      },
      {
        name: "max",
        type: "mcg-template",
        default: DEFAULT_MAX,
        schema: { number: { step: 0.1 } },
      },
    ]
  },
  {
    name: "badge_appearance",
    type: "expandable",
    iconPath: mdiPalette,
    flatten: true,
    schema: [
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "needle",
            selector: { boolean: {} },
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
          {
            name: "start_from_zero",
            helper: "start_from_zero",
            selector: { boolean: {} }
          },
          {
            name: "decimals",
            selector: { number: { step: 1, min: 0 } },
          },
        ]
      },
      {
        name: "state_text",
        helper: "state_text",
        selector: { template: {} }
      },
      {
        name: "gauge_foreground_style",
        type: "expandable",
        iconPath: mdiFlipToFront,
        schema: getGaugeStyleSchema(14)
      },
      {
        name: "gauge_background_style",
        type: "expandable",
        iconPath: mdiFlipToBack,
        schema: getGaugeStyleSchema(14)
      }
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
            type: "mcg-template",
            required: true,
            schema: { number: { step: 0.1 } },
          },
          {
            name: "color",
            type: "mcg-template",
            required: true,
            schema: { color_rgb: {} },
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
      .computeHelper=${this._computeHelper}
      @value-changed=${this._valueChanged}
    ></ha-form>
    `;
  }

  private _computeLabel = (schema: any) => {
    return this.hass?.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`) || localize(this.hass, `editor.${schema.name}`);
  };

  private _computeHelper = (schema: any) => {
    if ("helper" in schema) {
      return localize(this.hass, `editor.helper.${schema.helper}`);
    }
    return undefined
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