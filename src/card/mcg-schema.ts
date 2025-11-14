import { mdiNumeric2BoxOutline, mdiSegment, mdiNumeric3BoxOutline, mdiFlipToFront, mdiFlipToBack, mdiGauge } from "@mdi/js";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MIN, DEFAULT_MAX, RADIUS, INNER_RADIUS, TERTIARY_RADIUS, NON_NUMERIC_ATTRIBUTES } from "../const";
import { EntityNames } from "./type";

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

export const getGaugeStyleSchema = (gaugeDefaultWidth: number = 6, gaugeDefaultOpacity: number = 1) => [
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
        default: gaugeDefaultOpacity,
        selector: { number: { step: "any", min: 0, max: 1 } }
      }
    ]
  }
];

export const getEntityStyleSchema = (showGaugeOptions: boolean, gaugeDefaultRadius: number = RADIUS, labelHelper: string = "label", gaugeDefaultBackgroundOpacity: number = 1) => [
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
        name: "show_seconds",
        default: true,
        helper: "show_seconds",
        selector: { boolean: {} }
      },
      {
        name: "adaptive_state_color",
        default: false,
        selector: { boolean: {} },
      },
      {
        name: "adaptive_label_color",
        default: false,
        selector: { boolean: {} },
      },
      {
        name: "decimals",
        selector: { number: { step: 1, min: 0 } },
      },
      {
        name: "inverted_mode",
        default: false,
        selector: { boolean: {} },
      },
      {
        name: "show_in_graph",
        default: labelHelper === "primary_label",
        selector: { boolean: {} },
      },
      {
        name: "adaptive_graph_range",
        default: false,
        selector: { boolean: {} },
      }
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
    iconPath: mdiFlipToFront,
    schema: getGaugeStyleSchema(gaugeDefaultRadius == RADIUS ? 6 : 4)
  },
  {
    name: "gauge_background_style",
    type: "expandable",
    iconPath: mdiFlipToBack,
    schema: getGaugeStyleSchema(gaugeDefaultRadius == RADIUS ? 6 : 4, gaugeDefaultBackgroundOpacity)
  }
];

export function getSecondarySchema(showGaugeOptions: boolean, entities?: Map<EntityNames, string>, gaugeDefaultBackgroundOpacity: number = 1) {
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
            entity_id: entities?.get("secondary") ?? undefined,
          } 
        },
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
        schema: getEntityStyleSchema(showGaugeOptions, INNER_RADIUS, "label", gaugeDefaultBackgroundOpacity)
      },
      ...getSegmentsSchema(),
      {
        name: "tap_action",
        selector: { ui_action: {} },
      }
    ],
  }
}

export function getTertiarySchema(disableTertiary: boolean, showGaugeOptions: boolean, entities?: Map<EntityNames, string>, gaugeDefaultBackgroundOpacity: number = 1) {
  return {
    name: "tertiary",
    type: "expandable",
    iconPath: mdiNumeric3BoxOutline,
    disabled: disableTertiary,
    helper: disableTertiary ? "tertiary_combined" : undefined,
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
            entity_id: entities?.get("tertiary") ?? undefined,
          } 
        },
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
        schema: getEntityStyleSchema(showGaugeOptions, TERTIARY_RADIUS, "label", gaugeDefaultBackgroundOpacity)
      },
      ...getSegmentsSchema(),
      {
        name: "tap_action",
        selector: { ui_action: {} },
      }
    ],
  }
}

export const standardGaugeIcon = "data:image/svg+xml;base64,PHN2ZwogICB3aWR0aD0iOTQiCiAgIGhlaWdodD0iOTQiCiAgIHZpZXdCb3g9IjAgMCA5NCA5NCIKICAgZmlsbD0ibm9uZSIKICAgaWQ9InN2ZzMiCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9Ijk0IiBoZWlnaHQ9Ijk0IiByeD0iOCIgZmlsbD0id2hpdGUiLz4KICA8cmVjdCB4PSIwLjUiIHk9IjAuNSIgd2lkdGg9IjkzIiBoZWlnaHQ9IjkzIiByeD0iNy41IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utb3BhY2l0eT0iMC4xMiIvPgogIDxwYXRoCiAgICAgc3R5bGU9ImZpbGw6bm9uZTtzdHJva2U6IzAwMDAwMDtzdHJva2Utd2lkdGg6NjtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6OC42O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2UtZGFzaG9mZnNldDowO3N0cm9rZS1vcGFjaXR5OjAuMzIxNTY5IgogICAgIGlkPSJwYXRoNSIKICAgICBkPSJNIDM4LjM3OTA0MSwtNjcuMjQzOTQyIEEgMzcuNjAzMDAxLDM3LjYwMzAwMSAwIDAgMSAxNS4wNDQ3MywtMzIuNDUzMjgxIDM3LjYwMzAwMSwzNy42MDMwMDEgMCAwIDEgLTI1Ljk5ODI3NiwtNDAuODQwODggMzcuNjAzMDAxLDM3LjYwMzAwMSAwIDAgMSAtMzMuODEyMDA4LC04MS45OTY5OTUgMzcuNjAzMDAxLDM3LjYwMzAwMSAwIDAgMSAxLjMwMTA1OTQsLTEwNC44NDMyOCIKICAgICB0cmFuc2Zvcm09InJvdGF0ZSgxMzUpIiAvPgogIDxyZWN0CiAgICAgZmlsbD0iYmxhY2siCiAgICAgZmlsbC1vcGFjaXR5PSIwLjEyIgogICAgIGlkPSJyZWN0MyIKICAgICB3aWR0aD0iMzYuNTkwNTkxIgogICAgIGhlaWdodD0iMTUuOTYwMTU1IgogICAgIHg9IjI4LjcwNDcwNCIKICAgICB5PSIzOS4wMTk5MjQiCiAgICAgcnk9IjUuMzg0NjYwNyIgLz4KICA8cmVjdAogICAgIGZpbGw9ImJsYWNrIgogICAgIGZpbGwtb3BhY2l0eT0iMC4xMiIKICAgICBpZD0icmVjdDMtNCIKICAgICB3aWR0aD0iMzYuNTkwNTkxIgogICAgIGhlaWdodD0iNS44MzUxNTQ1IgogICAgIHg9IjI4LjcwNDcwNCIKICAgICB5PSI4My43NjQ5OTkiCiAgICAgcnk9IjIuOTE3NTc3MyIgLz4KPC9zdmc+Cg==";
export const standardDarkGaugeIcon = "data:image/svg+xml;base64,PHN2ZwogICB3aWR0aD0iOTQiCiAgIGhlaWdodD0iOTQiCiAgIHZpZXdCb3g9IjAgMCA5NCA5NCIKICAgZmlsbD0ibm9uZSIKICAgaWQ9InN2ZzMiCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgIDxyZWN0IHdpZHRoPSI5NCIgaGVpZ2h0PSI5NCIgcng9IjgiIGZpbGw9IiMxQzFDMUMiLz4KICAgPHJlY3QgeD0iMC41IiB5PSIwLjUiIHdpZHRoPSI5MyIgaGVpZ2h0PSI5MyIgcng9IjcuNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMjQiLz4KICAgPHBhdGgKICAgICBzdHlsZT0iZmlsbDpub25lO3N0cm9rZTojZmZmZmZmO3N0cm9rZS13aWR0aDo2O3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo4LjY7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1kYXNob2Zmc2V0OjA7c3Ryb2tlLW9wYWNpdHk6MC40Nzg0MzEiCiAgICAgaWQ9InBhdGg1IgogICAgIGQ9Ik0gMzguMzc5MDQxLC02Ny4yNDM5NDIgQSAzNy42MDMwMDEsMzcuNjAzMDAxIDAgMCAxIDE1LjA0NDczLC0zMi40NTMyODEgMzcuNjAzMDAxLDM3LjYwMzAwMSAwIDAgMSAtMjUuOTk4Mjc2LC00MC44NDA4OCAzNy42MDMwMDEsMzcuNjAzMDAxIDAgMCAxIC0zMy44MTIwMDgsLTgxLjk5Njk5NSAzNy42MDMwMDEsMzcuNjAzMDAxIDAgMCAxIDEuMzAxMDU5NCwtMTA0Ljg0MzI4IgogICAgIHRyYW5zZm9ybT0icm90YXRlKDEzNSkiIC8+CiAgIDxyZWN0CiAgICAgZmlsbD0id2hpdGUiCiAgICAgZmlsbC1vcGFjaXR5PSIwLjI0IgogICAgIGlkPSJyZWN0MyIKICAgICB3aWR0aD0iMzYuNTkwNTkxIgogICAgIGhlaWdodD0iMTUuOTYwMTU1IgogICAgIHg9IjI4LjcwNDcwNCIKICAgICB5PSIzOS4wMTk5MjQiCiAgICAgcnk9IjUuMzg0NjYwNyIgLz4KICA8cmVjdAogICAgIGZpbGw9IndoaXRlIgogICAgIGZpbGwtb3BhY2l0eT0iMC4yNCIKICAgICBpZD0icmVjdDMtNCIKICAgICB3aWR0aD0iMzYuNTkwNTkxIgogICAgIGhlaWdodD0iNS44MzUxNTQ1IgogICAgIHg9IjI4LjcwNDcwNCIKICAgICB5PSI4My43NjQ5OTkiCiAgICAgcnk9IjIuOTE3NTc3MyIgLz4KPC9zdmc+Cg==";
export const halfGaugeIcon = "data:image/svg+xml;base64,PHN2ZwogICB3aWR0aD0iOTQiCiAgIGhlaWdodD0iOTQiCiAgIHZpZXdCb3g9IjAgMCA5NCA5NCIKICAgZmlsbD0ibm9uZSIKICAgaWQ9InN2ZzMiCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9Ijk0IiBoZWlnaHQ9Ijk0IiByeD0iOCIgZmlsbD0id2hpdGUiLz4KICA8cmVjdCB4PSIwLjUiIHk9IjAuNSIgd2lkdGg9IjkzIiBoZWlnaHQ9IjkzIiByeD0iNy41IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utb3BhY2l0eT0iMC4xMiIvPgogIDxwYXRoCiAgICAgc3R5bGU9ImZpbGw6bm9uZTtzdHJva2U6IzAwMDAwMDtzdHJva2Utd2lkdGg6NjtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6OC42O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2UtZGFzaG9mZnNldDowO3N0cm9rZS1vcGFjaXR5OjAuMzIxNTY5IgogICAgIGlkPSJwYXRoNSIKICAgICBkPSJtIC05LjM5Njk5OTQsLTY1LjgwMDU5OCBhIDM3LjYwMzAwMSwzNy42MDMwMDEgMCAwIDEgLTE4LjgwMTUwMDYsMzIuNTY1MTU0IDM3LjYwMzAwMSwzNy42MDMwMDEgMCAwIDEgLTM3LjYwMzAwMSwtMTBlLTcgMzcuNjAzMDAxLDM3LjYwMzAwMSAwIDAgMSAtMTguODAxNSwtMzIuNTY1MTUzIgogICAgIHRyYW5zZm9ybT0icm90YXRlKDE4MCkiIC8+CiAgPHJlY3QKICAgICBmaWxsPSJibGFjayIKICAgICBmaWxsLW9wYWNpdHk9IjAuMTIiCiAgICAgaWQ9InJlY3QzIgogICAgIHdpZHRoPSIzNi41OTA1OTEiCiAgICAgaGVpZ2h0PSIxNS45NjAxNTUiCiAgICAgeD0iMjguNzA0NzA0IgogICAgIHk9IjQ4LjkxOTk5OCIKICAgICByeT0iNS4zODQ2NjA3IiAvPgogIDxyZWN0CiAgICAgZmlsbD0iYmxhY2siCiAgICAgZmlsbC1vcGFjaXR5PSIwLjEyIgogICAgIGlkPSJyZWN0My00IgogICAgIHdpZHRoPSIzNi41OTA1OTEiCiAgICAgaGVpZ2h0PSI1LjgzNTE1NDUiCiAgICAgeD0iMjguMDk1MzAxIgogICAgIHk9IjgzLjc2NDk5OSIKICAgICByeT0iMi45MTc1NzczIiAvPgo8L3N2Zz4K";
export const halfDarkGaugeIcon = "data:image/svg+xml;base64,PHN2ZwogICB3aWR0aD0iOTQiCiAgIGhlaWdodD0iOTQiCiAgIHZpZXdCb3g9IjAgMCA5NCA5NCIKICAgZmlsbD0ibm9uZSIKICAgaWQ9InN2ZzMiCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgIDxyZWN0IHdpZHRoPSI5NCIgaGVpZ2h0PSI5NCIgcng9IjgiIGZpbGw9IiMxQzFDMUMiLz4KICAgPHJlY3QgeD0iMC41IiB5PSIwLjUiIHdpZHRoPSI5MyIgaGVpZ2h0PSI5MyIgcng9IjcuNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMjQiLz4KICAgPHBhdGgKICAgICBzdHlsZT0iZmlsbDpub25lO3N0cm9rZTojZmZmZmZmO3N0cm9rZS13aWR0aDo2O3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo4LjY7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1kYXNob2Zmc2V0OjA7c3Ryb2tlLW9wYWNpdHk6MC40Nzg0MzEiCiAgICAgaWQ9InBhdGg1IgogICAgIGQ9Im0gLTkuMzk2OTk5NCwtNjUuODAwNTk4IGEgMzcuNjAzMDAxLDM3LjYwMzAwMSAwIDAgMSAtMTguODAxNTAwNiwzMi41NjUxNTQgMzcuNjAzMDAxLDM3LjYwMzAwMSAwIDAgMSAtMzcuNjAzMDAxLC0xMGUtNyAzNy42MDMwMDEsMzcuNjAzMDAxIDAgMCAxIC0xOC44MDE1LC0zMi41NjUxNTMiCiAgICAgdHJhbnNmb3JtPSJyb3RhdGUoMTgwKSIgLz4KICAgPHJlY3QKICAgICBmaWxsPSJ3aGl0ZSIKICAgICBmaWxsLW9wYWNpdHk9IjAuMjQiCiAgICAgaWQ9InJlY3QzIgogICAgIHdpZHRoPSIzNi41OTA1OTEiCiAgICAgaGVpZ2h0PSIxNS45NjAxNTUiCiAgICAgeD0iMjguNzA0NzA0IgogICAgIHk9IjQ4LjkxOTk5OCIKICAgICByeT0iNS4zODQ2NjA3IiAvPgogIDxyZWN0CiAgICAgZmlsbD0id2hpdGUiCiAgICAgZmlsbC1vcGFjaXR5PSIwLjI0IgogICAgIGlkPSJyZWN0My00IgogICAgIHdpZHRoPSIzNi41OTA1OTEiCiAgICAgaGVpZ2h0PSI1LjgzNTE1NDUiCiAgICAgeD0iMjguMDk1MzAxIgogICAgIHk9IjgzLjc2NDk5OSIKICAgICByeT0iMi45MTc1NzczIiAvPgo8L3N2Zz4K";
export const fullGaugeIcon = "data:image/svg+xml;base64,PHN2ZwogICB3aWR0aD0iOTQiCiAgIGhlaWdodD0iMTA2IgogICB2aWV3Qm94PSIwIDAgOTQgMTA2IgogICBmaWxsPSJub25lIgogICBpZD0ic3ZnMyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iOTQiIGhlaWdodD0iMTA2IiByeD0iOCIgZmlsbD0id2hpdGUiLz4KICA8cmVjdCB4PSIwLjUiIHk9IjAuNSIgd2lkdGg9IjkzIiBoZWlnaHQ9IjEwNSIgcng9IjcuNSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLW9wYWNpdHk9IjAuMTIiLz4KICAgPGNpcmNsZQogICAgIGN4PSI0NyIKICAgICBjeT0iNTMiCiAgICAgcj0iMzcuNjAzMDAxIgogICAgIGZpbGw9Im5vbmUiCiAgICAgc3Ryb2tlPSJibGFjayIKICAgICBzdHJva2Utb3BhY2l0eT0iMC4zMjE1NjkiCiAgICAgc3Ryb2tlLXdpZHRoPSI2IiAvPgogIDxyZWN0CiAgICAgZmlsbD0iYmxhY2siCiAgICAgZmlsbC1vcGFjaXR5PSIwLjEyIgogICAgIGlkPSJyZWN0MyIKICAgICB3aWR0aD0iMzYuNTkwNTkxIgogICAgIGhlaWdodD0iMTUuOTYwMTU1IgogICAgIHg9IjI4LjcwNDcwNCIKICAgICB5PSI0NS4wMTk5MjQiCiAgICAgcnk9IjUuMzg0NjYwNyIgLz4KICA8cmVjdAogICAgIGZpbGw9ImJsYWNrIgogICAgIGZpbGwtb3BhY2l0eT0iMC4xMiIKICAgICBpZD0icmVjdDMtNCIKICAgICB3aWR0aD0iMzYuNTkwNTkxIgogICAgIGhlaWdodD0iNS44MzUxNTQ1IgogICAgIHg9IjI4LjcwNDcwNCIKICAgICB5PSI5NC43NjQ5OTkiCiAgICAgcnk9IjIuOTE3NTc3MyIgLz4KPC9zdmc+Cg==";
export const fullDarkGaugeIcon = "data:image/svg+xml;base64,PHN2ZwogICB3aWR0aD0iOTQiCiAgIGhlaWdodD0iMTA2IgogICB2aWV3Qm94PSIwIDAgOTQgMTA2IgogICBmaWxsPSJub25lIgogICBpZD0ic3ZnMyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iOTQiIGhlaWdodD0iMTA2IiByeD0iOCIgZmlsbD0iIzFDMUMxQyIvPgogIDxyZWN0IHg9IjAuNSIgeT0iMC41IiB3aWR0aD0iOTMiIGhlaWdodD0iMTA1IiByeD0iNy41IiBzdHJva2U9IndoaXRlIiBzdHJva2Utb3BhY2l0eT0iMC4yNCIvPgogICA8Y2lyY2xlCiAgICAgY3g9IjQ3IgogICAgIGN5PSI1MyIKICAgICByPSIzNy42MDMwMDEiCiAgICAgZmlsbD0ibm9uZSIKICAgICBzdHJva2U9IndoaXRlIgogICAgIHN0cm9rZS1vcGFjaXR5PSIwLjQ3IgogICAgIHN0cm9rZS13aWR0aD0iNiIgLz4KICA8cmVjdAogICAgIGZpbGw9IndoaXRlIgogICAgIGZpbGwtb3BhY2l0eT0iMC4yNCIKICAgICBpZD0icmVjdDMiCiAgICAgd2lkdGg9IjM2LjU5MDU5MSIKICAgICBoZWlnaHQ9IjE1Ljk2MDE1NSIKICAgICB4PSIyOC43MDQ3MDQiCiAgICAgeT0iNDUuMDE5OTI0IgogICAgIHJ5PSI1LjM4NDY2MDciIC8+CiAgPHJlY3QKICAgICBmaWxsPSJ3aGl0ZSIKICAgICBmaWxsLW9wYWNpdHk9IjAuMjQiCiAgICAgaWQ9InJlY3QzLTQiCiAgICAgd2lkdGg9IjM2LjU5MDU5MSIKICAgICBoZWlnaHQ9IjUuODM1MTU0NSIKICAgICB4PSIyOC43MDQ3MDQiCiAgICAgeT0iOTQuNzY0OTk5IgogICAgIHJ5PSIyLjkxNzU3NzMiIC8+Cjwvc3ZnPgo=";
