import { html, LitElement, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HaFormMCGTemplateSchema } from "./type";
import { HaFormBaseSchema, HaFormDataContainer } from "../ha/components/ha-form-types";
import { fireEvent } from "../ha/common/dom/fire_event";
import { isTemplate } from "../utils/template";
import { mdiCodeBraces, mdiListBoxOutline } from "@mdi/js";

@customElement("ha-form-mcg-template")
export class HaFormMCGTemplate extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public data!: HaFormDataContainer;

  @property({ attribute: false }) public schema!: HaFormMCGTemplateSchema;

  @property({ type: String }) public template = "";

  @property({ attribute: false }) public computeLabel?: (
    schema: HaFormBaseSchema,
    data?: HaFormDataContainer
  ) => string;

  @state() private _templateMode: boolean = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._templateMode = isTemplate(this.data as unknown as string);
  }

  private _computeSelector(): any[] {
    return [
      {
        name: this.schema.name,
        label: this.schema.label,
        selector: this.schema.schema,
      }
    ];
  }

  protected render() {
    const DATA = { [this.schema.name]: this.data };

    const dataIsTemplate = this._templateMode ?? isTemplate((DATA[this.schema.name] as unknown) as string);
    
    let schema = Array.isArray(this.schema.schema) ? this.schema.schema : this._computeSelector();
    
    if (dataIsTemplate) {
      schema = [
        {
          name: this.schema.name,
          label: this.schema.label,
          selector: { template: {} },
        }
      ]
    }

    return html`
      <div class="selector-container">
        <ha-form
          .hass=${this.hass}
          .data=${DATA}
          .schema=${schema}
          .computeLabel=${this.computeLabel}
          @value-changed=${this._valueChanged}
        >
        </ha-form>
        <ha-icon-button
          .path=${this._templateMode ? mdiListBoxOutline : mdiCodeBraces}
          @click=${this._toggleTemplateMode}
        ></ha-icon-button>
      </div>
    `;
  }

  private _toggleTemplateMode(): void {
    this._templateMode = !this._templateMode;
    if (this._templateMode) {
      const value = this.data != undefined ? String(this.data) : "";
      fireEvent(this, "value-changed", { value: value });
    }
  }

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = ev.detail.value[this.schema.name];
    if (value === undefined) {
      return;
    }
    fireEvent(this, "value-changed", { value: value });
  }

  static styles = css`
    :host {
      display: block;
    }
    .selector-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ha-form {
      flex: 1;
    }
  `;
}