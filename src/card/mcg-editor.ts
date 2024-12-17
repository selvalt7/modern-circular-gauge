import { fireEvent } from "custom-card-helpers";
import { HomeAssistant } from "../ha/types";
import { html, LitElement, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ModernCircularGaugeConfig, SegmentsConfig } from "./type";
import { mdiSegment, mdiPlus, mdiClose, mdiInformationOutline } from "@mdi/js";
import { hexToRgb } from "../utils/color";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS } from "../const";

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
        ],
    },
    {
        name: "secondary",
        type: "expandable",
        label: "Secondary info",
        iconPath: mdiInformationOutline,
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
            }
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
        name: "needle",
        label: "gauge.needle_gauge",
        selector: { boolean: {} },
    },
    {
        name: "tap_action",
        selector: {
            ui_action: {
            },
        },
    }
];

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
    },
    {
        name: "label",
        label: "Label",
        selector: { text: {} },
    }
];

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
                <ha-icon-button
                    .label=${this.hass.localize("ui.common.add")}
                    .path=${mdiPlus}
                    @click=${this._addSegment}
                ></ha-icon-button>
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
                            @click=${this._removeSegment}
                        >
                    </div>
                    `)}
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
        let config = ev.detail.value as ModernCircularGaugeConfig;
        if (!config) {
            return;
        }

        let secondary = this._config?.secondary;

        if (typeof config.secondary === "object") {
            if (config.secondary.entity !== undefined) {
                secondary = {
                    entity: config.secondary.entity,
                    unit: config.secondary.unit || undefined
                };
            }
            else {
                secondary = undefined;
            }
            if (config.secondary.template !== undefined) {
                secondary = config.secondary.template;
            }
        }

        fireEvent(this, "config-changed", { config: { ...config, secondary } });
    }

    static get styles() {
        return css`
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