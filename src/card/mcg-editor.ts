import { fireEvent } from "../ha/common/dom/fire_event";
import { HomeAssistant } from "../ha/types";
import { html, LitElement, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GaugeType, ModernCircularGaugeConfig } from "./type";
import { mdiSegment, mdiPalette, mdiGauge } from "@mdi/js";
import { fullDarkGaugeIcon, fullGaugeIcon, getEntityStyleSchema, getSecondarySchema, getTertiarySchema, halfDarkGaugeIcon, halfGaugeIcon, standardDarkGaugeIcon, standardGaugeIcon } from "./mcg-schema";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS, RADIUS, NON_NUMERIC_ATTRIBUTES } from "../const";
import memoizeOne from "memoize-one";
import "../components/ha-form-mcg-list";
import "../components/ha-form-mcg-template";
import localize from "../localize/localize";

@customElement("modern-circular-gauge-editor")
export class ModernCircularGaugeEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeConfig;

  setConfig(config: ModernCircularGaugeConfig): void {
    let secondary = config.secondary;

    if (secondary === undefined && config.secondary_entity !== undefined) {
      secondary = config.secondary_entity;
    }
    
    if (typeof secondary === "object") {
      const template = secondary.template || "";
      if (template.length > 0) {
        secondary = template;
      }
    }

    this._config = { ...config, secondary: secondary, secondary_entity: undefined };
  }

  private _schema = memoizeOne(
    (showInnerGaugeOptions: boolean, showTertiaryGaugeOptions: boolean, gaugeType: GaugeType) =>
    [
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
            disabled: gaugeType === "half",
            helper: gaugeType === "half" ? "half_gauge_icon_unavailable" : undefined,
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
        ],
      },
      {
        name: "primary_entity_style",
        type: "expandable",
        flatten: true,
        iconPath: mdiGauge,
        schema: getEntityStyleSchema(true, RADIUS, "primary_label", gaugeType === "full"),
      },
        getSecondarySchema(showInnerGaugeOptions, gaugeType === "full"),
        getTertiarySchema(showTertiaryGaugeOptions, gaugeType === "full"),
      {
        name: "appearance",
        type: "expandable",
        flatten: true,
        iconPath: mdiPalette,
        schema: [
          {
            name: "header_position",
            default: "bottom",
            selector: {
              select: {
                options: [
                  { label: "Bottom", value: "bottom" },
                  { label: "Top", value: "top" },
                ],
                translation_key: "header_position_options",
                mode: "box"
              },
            },
          },
          {
            name: "",
            type: "grid",
            schema: [
              {
                name: "smooth_segments",
                selector: { boolean: {} },
              },
              {
                name: "show_header",
                default: true,
                selector: { boolean: {} },
              },
              {
                name: "show_icon",
                default: true,
                disabled: gaugeType === "half",
                helper: gaugeType === "half" ? "half_gauge_icon_unavailable" : undefined,
                selector: { boolean: {} },
              },
              {
                name: "adaptive_icon_color",
                default: false,
                disabled: gaugeType === "half",
                helper: gaugeType === "half" ? "half_gauge_icon_unavailable" : undefined,
                selector: { boolean: {} },
              },
              {
                name: "icon_entity",
                default: "primary",
                disabled: gaugeType === "half",
                helper: gaugeType === "half" ? "half_gauge_icon_unavailable" : "icon_entity",
                selector: {
                  select: {
                    options: [
                      { value: "primary", label: "Primary" },
                      { value: "secondary", label: "Secondary" },
                      { value: "tertiary", label: "Tertiary" },
                    ],
                    mode: "dropdown",
                    translation_key: "icon_entity_options",
                  },
                },
              }
            ],
          },
          {
            name: "gauge_type",
            default: "standard",
            selector: {
              select: {
                options: [
                  { label: "Standard", value: "standard", image: { src: standardGaugeIcon, src_dark: standardDarkGaugeIcon } },
                  { label: "Half", value: "half", image: { src: halfGaugeIcon, src_dark: halfDarkGaugeIcon } },
                  { label: "Full", value: "full", image: { src: fullGaugeIcon, src_dark: fullDarkGaugeIcon } },
                ],
                translation_key: "gauge_type_options",
                box_max_columns: 2,
                mode: "box"
              },
            },
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
          {
            name: "label",
            type: "mcg-template",
            schema: { text: {} },
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
  )

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    const schema = this._schema(typeof this._config.secondary != "string" && this._config.secondary?.show_gauge == "inner",
      typeof this._config.tertiary != "string" && this._config.tertiary?.show_gauge == "inner",
      this._config.gauge_type || "standard"
    );

    const DATA = {
      ...this._config,
    };

    return html`
    <ha-form
        .hass=${this.hass}
        .data=${DATA}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        .localizeValue=${this._localizeValue}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
    ></ha-form>
    `;
  }

  private _localizeValue = (key: string) => {
    return localize(this.hass, `editor.${key}`);
  };

  private _computeLabel = (schema: any) => {
    return this.hass?.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`) || localize(this.hass, `editor.${schema.name}`);
  };

  private _computeHelper = (schema: any) => {
    if ("helper" in schema) {
      if (!schema.helper) {
        return undefined;
      }
      return localize(this.hass, `editor.helper.${schema.helper}`);
    }
    return undefined
  };

  private _valueChanged(ev: CustomEvent): void {
    let config = ev.detail.value as ModernCircularGaugeConfig;
    if (!config) {
      return;
    }

    let newSecondary = {};

    if (typeof this._config?.secondary === "string") {
      newSecondary = {
        ...newSecondary,
        entity: this._config.secondary,
      };
    }

    if (typeof config.secondary === "object") {
      Object.entries(config.secondary).forEach(([key, value]) => {
        if (isNaN(Number(key))) {
          newSecondary = {
            ...newSecondary,
            [key]: value
          }
        }
      })
    }

    config.secondary = newSecondary;

    fireEvent(this, "config-changed", { config });
  }

  static get styles() {
    return css`
    `;
  }
}