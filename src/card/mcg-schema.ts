import { mdiNumeric2BoxOutline, mdiSegment, mdiNumeric3BoxOutline } from "@mdi/js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX } from "../const";

export const getSecondaryGaugeSchema = (showGaugeOptions: boolean) => {
  return [
    {
      name: "show_gauge",
      selector: { select: {
        options: [
          { value: "none", label: "None" },
          { value: "inner", label: "Inner gauge" },
          { value: "outer", label: "Outer gauge" },
        ],
        mode: "dropdown",
        translation_key: "show_gauge_options",
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
          selector: { number: { step: 0.1 } },
        },
        {
          name: "max",
          default: DEFAULT_MAX,
          selector: { number: { step: 0.1 } },
        },
        {
          name: "needle",
          selector: { boolean: {} },
        },
      ],
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
            selector: { select: {
              options: [
                { value: "small", label: "Small"},
                { value: "big", label: "Big"},
              ],
              mode: "dropdown",
              translation_key: "state_size_options",
            }},
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
            name: "adaptive_state_color",
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
            default: true,
            selector: { boolean: {} },
          },
          {
            name: "show_unit",
            default: true,
            selector: { boolean: {} },
          },
          {
            name: "adaptive_state_color",
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