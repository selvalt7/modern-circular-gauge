import { html, LitElement, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha/types";
import { HaFormMCGTemplateSchema } from "./type";
import { HaFormBaseSchema, HaFormDataContainer } from "../ha/components/ha-form-types";
import { fireEvent } from "../ha/common/dom/fire_event";
import { isTemplate } from "../utils/template";
import { mdiCodeBraces, mdiListBoxOutline } from "@mdi/js";
import localize from "../localize/localize";

@customElement("ha-form-mcg-template")
export class HaFormMCGTemplate extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public data!: HaFormDataContainer;

  @property({ attribute: false }) public schema!: HaFormMCGTemplateSchema;

  @property({ type: Boolean }) public disabled = false;

  @property({ attribute: false }) public computeLabel?: (
    schema: HaFormBaseSchema,
    data?: HaFormDataContainer
  ) => string;

  @state() private _templateMode: boolean = false;

  connectedCallback(): void {
    super.connectedCallback();

    const DATA = this.schema.flatten ? this.data : { [this.schema.name]: this.data };
    this._templateMode = isTemplate(DATA[this.schema.name] as unknown as string);
  }

  private _computeSelector(): any[] {
    return [
      {
        name: this.schema.name,
        label: this.schema.label,
        selector: this.schema.schema,
        required: this.schema.required,
        context: this.schema.context || undefined,
      }
    ];
  }

  protected render() {
    const DATA = this.schema.flatten ? this.data : { [this.schema.name]: this.data };
    
    const dataIsTemplate = this._templateMode ?? isTemplate(DATA[this.schema.name] as unknown as string);
    
    let schema = Array.isArray(this.schema.schema) ? this.schema.schema : this._computeSelector();
    
    if (dataIsTemplate) {
      schema = [
        {
          name: this.schema.name,
          label: this.schema.label,
          required: this.schema.required,
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
          .disabled=${this.disabled}
          @value-changed=${this._valueChanged}
        >
        </ha-form>
        <ha-button .disabled=${this.disabled} @click=${this._toggleTemplateMode}>
          ${this._templateMode ? localize(this.hass, "editor.switch_to_form") : localize(this.hass, "editor.switch_to_template")}
          <ha-svg-icon slot="icon" .path=${this._templateMode ? mdiListBoxOutline : mdiCodeBraces}></ha-svg-icon>
        </ha-button>
      </div>
    `;
  }

  private _toggleTemplateMode(): void {
    this._templateMode = !this._templateMode;
  }

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = ev.detail.value[this.schema.name];
    if (value === undefined) {
      return;
    }

    const data = this.schema.flatten ? { value: ev.detail.value } : { value: value };

    fireEvent(this, "value-changed", data);
  }

  static styles = css`
    :host {
      display: block;
    }
    .selector-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    ha-form {
      flex: 1;
      width: 100%;
    }
  `;
}