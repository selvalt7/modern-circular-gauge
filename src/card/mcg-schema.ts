import { mdiNumeric2BoxOutline, mdiSegment, mdiNumeric3BoxOutline } from "@mdi/js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX } from "../const";

export const getSecondaryGaugeSchema = (showGaugeOptions: boolean) => {
  return [
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
      disabled: !showGaugeOptions,
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
      disabled: !showGaugeOptions,
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
  ];
}

export function getSecondarySchema(showGaugeOptions: boolean) {
  return {
    name: "secondary",
    type: "expandable",
    label: "Secondary info",
    iconPath: mdiNumeric2BoxOutline,
    schema: [
      {
        name: "entity",
        selector: { entity: { 
          domain: NUMBER_ENTITY_DOMAINS,
        }},
      },
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "unit",
            selector: { text: {} },
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
            name: "show_state",
            label: "Show state",
            default: true,
            selector: { boolean: {} },
          },
          {
            name: "show_unit",
            label: "Show unit",
            default: true,
            selector: { boolean: {} },
          },
          {
            name: "adaptive_state_color",
            label: "Adaptive state color",
            default: false,
            selector: { boolean: {} },
          },
        ],
      },
      ...getSecondaryGaugeSchema(showGaugeOptions),
      {
        name: "tap_action",
        selector: { ui_action: {} },
      }
    ],
  }
}

export function getTertiarySchema(showGaugeOptions: boolean) {
  return {
    name: "tertiary",
    type: "expandable",
    label: "Tertiary info",
    iconPath: mdiNumeric3BoxOutline,
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
      {
        name: "",
        type: "grid",
        schema: [
          {
            name: "show_state",
            label: "Show state",
            default: true,
            selector: { boolean: {} },
          },
          {
            name: "show_unit",
            label: "Show unit",
            default: true,
            selector: { boolean: {} },
          },
          {
            name: "adaptive_state_color",
            label: "Adaptive state color",
            default: false,
            selector: { boolean: {} },
          },
        ],
      },
      ...getSecondaryGaugeSchema(showGaugeOptions),
      {
        name: "tap_action",
        selector: { ui_action: {} },
      }
    ],
  }
}