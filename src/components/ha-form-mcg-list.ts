import { html, LitElement, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HaFormMCGListSchema } from "./type";
import { HaFormBaseSchema, HaFormDataContainer } from "../ha/components/ha-form-types";
import { mdiClose, mdiPlus } from "@mdi/js";
import { fireEvent } from "../ha/common/dom/fire_event";
import localize from "../localize/localize";

@customElement("ha-form-mcg-list")
export class MCG_List extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public data!: HaFormDataContainer[];

  @property({ attribute: false }) public schema!: HaFormMCGListSchema;

  @property({ attribute: false }) public computeLabel?: (
    schema: HaFormBaseSchema,
    data?: HaFormDataContainer,
    options?: { path?: string[] }
  ) => string;

  @property({ type: Boolean }) public disabled = false;

  private _computeLabel = (
    schema: HaFormBaseSchema,
    data?: HaFormDataContainer,
    options?: { path?: string[] }
  ) => {
    if (!this.computeLabel) return this._computeLabel;

    return this.computeLabel(schema, data, {
      ...options,
      path: [...(options?.path || []), this.schema.name],
    });
  };

  protected render() {
    return html`
    <ha-expansion-panel outlined .expanded=${Boolean(this.schema.expanded)}>
      <div
        slot="header"
        role="heading"
      >
        <ha-svg-icon .path=${this.schema.iconPath}></ha-svg-icon>
        ${localize(this.hass, `editor.${this.schema.name}`)}
      </div>
      <div class="content">
        ${this.data ? this.data.map((row, index) => html`
          <div class="entry">
            <ha-form
              .hass=${this.hass}
              .data=${row}
              .schema=${this.schema.schema}
              .index=${index}
              .disabled=${this.disabled}
              .computeLabel=${this._computeLabel}
              @value-changed=${this._valueChanged}
            ></ha-form>
            <ha-icon-button
              .label=${this.hass.localize("ui.common.remove")}
              .path=${mdiClose}
              .index=${index}
              @click=${this._removeRow}
            >
          </div>
        `) : nothing}
        <ha-button size="small" appearance="plain" .disabled=${this.disabled} @click=${this._addRow}>
          ${this.hass?.localize("ui.common.add") ?? "Add"}
          <ha-svg-icon slot="start" .path=${mdiPlus}></ha-svg-icon>
          <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>
        </ha-button>
      </div>
    </ha-expansion-panel>
    `;
  }

  private _valueChanged(ev: CustomEvent) {
    ev.stopPropagation();
    const data = [...this.data];
    data[(ev.target as any).index] = ev.detail.value;
    fireEvent(this, "value-changed", { value: data });
  }

  private _addRow() {
    if (this.data === undefined) {
      fireEvent(this, "value-changed", { value: [{}] });
      return;
    }
    const data = [
      ...this.data,
      {}
    ];
    fireEvent(this, "value-changed", { value: data });
  }

  private _removeRow(ev: CustomEvent) {
    const data = [...this.data];
    data.splice((ev.target as any).index, 1);
    fireEvent(this, "value-changed", { value: data });
  }

  static get styles() {
    return css`
      .content {
        display: flex;
        justify-items: center;
        flex-direction: column;
        padding: 12px;
      }
      
      .entry {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding-top: 12px;
        margin-bottom: 12px;
        border-top: 1px solid var(--divider-color);
      }

      .entry:first-child {
        border-top: none;
      }

      .entry ha-form {
        flex: 1;
      }

      ha-button ha-svg-icon {
        color: inherit;
      }

      ha-svg-icon, ha-icon-button {
        color: var(--secondary-text-color);
      }
    `;
  }
}