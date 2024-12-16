import { LitElement, html, nothing, css } from "lit";
import { HomeAssistant } from "../ha/types";
import { customElement, property, state } from "lit/decorators.js";
import { ModernCircularGaugeBadgeConfig } from "./gauge-badge-config";
import { NUMBER_ENTITY_DOMAINS, DEFAULT_MAX, DEFAULT_MIN } from "../const";
import { fireEvent } from "custom-card-helpers";
import { mdiSegment, mdiPlus, mdiClose } from "@mdi/js";
import { hexToRgb } from "../utils/color";
import type { SegmentsConfig } from "../card/type";


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

const SEGMENT = [
  {
      name: "",
      type: "grid",
      schema: [
          {
              name: "from",
              label: "From",
              required: true,
              selector: { number: {} },
          },
          {
              name: "color",
              label: "heading.entity_config.color",
              required: true,
              selector: { color_rgb: {} },
          },
      ],
  }
];

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
    <ha-expansion-panel outlined>
      <div
        slot="header"
        role="heading"
      >
        <ha-svg-icon .path=${mdiSegment}></ha-svg-icon>
        Color segments
      </div>
      <div class="content">
        ${DATA.segments?.map((row, index) => html`
        <div class="segment-entry">
          <ha-form
            .hass=${this.hass}
            .data=${row}
            .schema=${SEGMENT}
            .index=${index}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._segmentChanged}
          ></ha-form>
          <ha-icon-button
            .label=${this.hass.localize("ui.common.remove")}
            .path=${mdiClose}
            .index=${index}
            @click=${this._removeSegment}
          >
        </div>
        `)}
        <ha-button @click=${this._addSegment}>
          ${this.hass?.localize("ui.common.add") ?? "Add"}
          <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>
        </ha-button>
      </div>
    </ha-expansion-panel>
    `;
  }

  private _computeLabel = (schema: any) => {
    let label = this.hass?.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`);
    if (label) return label;
    label = this.hass?.localize(`ui.panel.lovelace.editor.card.${schema.label}`);
    if (label) return label;
    return schema.label;
  };

  private _addSegment(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = { from: 0, color: [0, 0, 0] } as SegmentsConfig;
    if (!this._config?.segments) {
      fireEvent(this, "config-changed", { config: { ...this._config, segments: [value] } });
      return;
    }

    fireEvent(this, "config-changed", { config: { ...this._config, segments: [...this._config.segments, value] } });
  }

  private _removeSegment(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this.hass || !this._config) {
      return;
    }
    const index = (ev.target as any).index;
    const newSegment = this._config.segments?.concat();

    console.log(index);

    newSegment?.splice(index, 1);

    fireEvent(this, "config-changed", { config: { ...this._config, segments: newSegment } } as any);
  }

  private _segmentChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this.hass || !this._config) {
      return;
    }
    const value = ev.detail.value;
    const index = (ev.target as any).index;
    const newSegment = this._config.segments!.concat();

    newSegment[index] = value;

    fireEvent(this, "config-changed", { config: { ...this._config, segments: newSegment } } as any);
  }

  private _valueChanged(ev: CustomEvent): void {
    let config = ev.detail.value as ModernCircularGaugeBadgeConfig;
    if (!config) {
      return;
    }

    fireEvent(this, "config-changed", { config });
  }

  static get styles() {
    return css`
      .content {
        display: flex;
        justify-items: center;
        flex-direction: column;
      }

      .segment-entry {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        margin-bottom: 24px;
      }

      .segment-entry ha-form {
        flex: 1;
      }
      
      ha-expansion-panel {
        margin-top: 24px;
      }
    `;
  }
}