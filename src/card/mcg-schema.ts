import { mdiNumeric2BoxOutline, mdiSegment, mdiNumeric3BoxOutline, mdiFlipToFront, mdiFlipToBack, mdiGauge } from "@mdi/js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX, RADIUS, INNER_RADIUS, TERTIARY_RADIUS, NON_NUMERIC_ATTRIBUTES } from "../const";

export const getSecondaryGaugeSchema = (showGaugeOptions: boolean) => [
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
        type: "mcg-template",
        default: DEFAULT_MIN,
        schema: { number: { step: 0.1 } },
      },
      {
        name: "max",
        type: "mcg-template",
        default: DEFAULT_MAX,
        schema: { number: { step: 0.1 } },
      }
    ],
  },
];

const getSegmentsSchema = () => [
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
]

export const getGaugeStyleSchema = (gaugeDefaultWidth: number = 6) => [
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "width",
        default: gaugeDefaultWidth,
        selector: { number: { step: "any", min: 0 } }
      },
      {
        name: "color",
        helper: "gauge_color",
        selector: { text: {} }
      },
      {
        name: "opacity",
        default: 1,
        selector: { number: { step: "any", min: 0, max: 1 } }
      }
    ]
  }
];

export const getEntityStyleSchema = (showGaugeOptions: boolean, gaugeDefaultRadius: number = RADIUS, labelHelper: string = "label") => [
  {
    name: "label",
    helper: labelHelper,
    selector: { text: {} }
  },
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "needle",
        disabled: !showGaugeOptions,
        selector: { boolean: {} },
      },
      {
        name: "start_from_zero",
        helper: "start_from_zero",
        disabled: !showGaugeOptions,
        selector: { boolean: {} }
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
    ]
  },
  {
    name: "state_text",
    helper: "state_text",
    selector: { template: {} }
  },
  {
    name: "gauge_radius",
    default: gaugeDefaultRadius,
    disabled: !showGaugeOptions,
    selector: { number: { step: 1 } }
  },
  {
    name: "gauge_foreground_style",
    type: "expandable",
    disabled: !showGaugeOptions,
    iconPath: mdiFlipToFront,
    schema: getGaugeStyleSchema(gaugeDefaultRadius == RADIUS ? 6 : 4)
  },
  {
    name: "gauge_background_style",
    type: "expandable",
    disabled: !showGaugeOptions,
    iconPath: mdiFlipToBack,
    schema: getGaugeStyleSchema(gaugeDefaultRadius == RADIUS ? 6 : 4)
  }
];

export function getSecondarySchema(showGaugeOptions: boolean) {
  return {
    name: "secondary",
    type: "expandable",
    iconPath: mdiNumeric2BoxOutline,
    schema: [
      {
        name: "entity",
        type: "mcg-template",
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
          }
        ],
      },
      ...getSecondaryGaugeSchema(showGaugeOptions),
      {
        name: "secondary_entity_style",
        type: "expandable",
        flatten: true,
        iconPath: mdiGauge,
        schema: getEntityStyleSchema(showGaugeOptions, INNER_RADIUS)
      },
      ...getSegmentsSchema(),
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
        type: "mcg-template",
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
        name: "unit",
        selector: { text: {} },
      },
      ...getSecondaryGaugeSchema(showGaugeOptions),
      {
        name: "tertiary_entity_style",
        type: "expandable",
        flatten: true,
        iconPath: mdiGauge,
        schema: getEntityStyleSchema(showGaugeOptions, TERTIARY_RADIUS)
      },
      ...getSegmentsSchema(),
      {
        name: "tap_action",
        selector: { ui_action: {} },
      }
    ],
  }
}