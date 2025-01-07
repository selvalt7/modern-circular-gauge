import { fireEvent } from "custom-card-helpers";
import { HomeAssistant } from "../ha/types";
import { html, LitElement, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ModernCircularGaugeConfig } from "./type";
import { mdiSegment, mdiInformationOutline } from "@mdi/js";
import { hexToRgb } from "../utils/color";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS } from "../const";
import memoizeOne from "memoize-one";
import "../components/ha-form-mcg-list";

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
    (showInnerGaugeOptions: boolean) =>
    [
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
            selector: { number: { step: 0.1 } },
          },
          {
            name: "max",
            default: DEFAULT_MAX,
            label: "generic.maximum",
            selector: { number: { step: 0.1 } },
          },
        ],
      },
      {
        name: "secondary",
        type: "expandable",
        label: "Secondary info",
        iconPath: mdiInformationOutline,
        schema: [
          {
            name: "",
            type: "grid",
            schema: [
              {
                name: "entity",
                selector: { entity: { 
                  domain: NUMBER_ENTITY_DOMAINS,
                }},
              },
              {
                name: "unit",
                selector: { text: {} },
              },
            ]
          },
          {
            name: "state_size",
            label: "State size",
            selector: { select: {
              options: [
                { value: "small", label: "Small"},
                { value: "big", label: "Big"},
              ],
              mode: "dropdown",
            }},
          },
          {
            name: "show_gauge",
            label: "Gauge visibility",
            selector: { select: {
              options: [
                { value: "none", label: "None" },
                { value: "inner", label: "Inner gauge" },
                { value: "outter", label: "Outter gauge" },
              ],
              mode: "dropdown",
            }},
          },
          {
            name: "",
            type: "grid",
            disabled: !showInnerGaugeOptions,
            schema: [
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
                name: "needle",
                label: "gauge.needle_gauge",
                selector: { boolean: {} },
              },
            ],
          },
          {
            name: "segments",
            type: "mcg-list",
            title: "Color segments",
            iconPath: mdiSegment,
            disabled: !showInnerGaugeOptions,
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
        ],
      },
      {
        name: "header_position",
        label: "Header position",
        selector: {
          select: {
            options: [
              { label: "Top", value: "top" },
              { label: "Bottom", value: "bottom" },
            ],
          },
        },
      },
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "needle",
            label: "gauge.needle_gauge",
            selector: { boolean: {} },
          },
          {
            name: "smooth_segments",
            label: "Smooth color segments",
            selector: { boolean: {} },
          },
        ],
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
          {
              name: "label",
              label: "Label",
              selector: { text: {} },
          }
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

    const schema = this._schema(typeof this._config.secondary != "string" && this._config.secondary?.show_gauge == "inner");

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
        .schema=${schema}
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