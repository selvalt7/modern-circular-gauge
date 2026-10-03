import { html, LitElement, TemplateResult, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ActionHandlerEvent } from "../ha/data/lovelace";
import { hasAction } from "../ha/panels/lovelace/common/has-action";
import { computeSegments, stateLayout } from "../utils/gauge";
import { registerCustomCard } from "../utils/custom-cards";
import type { BaseEntityConfig, EntityNames, GaugeElementConfig, GaugeSlot, ModernCircularGaugeConfig, SecondaryEntity, SegmentsConfig, TertiaryEntity } from "./type";
import { LovelaceLayoutOptions, LovelaceGridOptions } from "../ha/data/lovelace";
import { handleAction } from "../ha/handle-action";
import { HomeAssistant } from "../ha/types";
import { HassEntity } from "home-assistant-js-websocket";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { actionHandler } from "../utils/action-handler-directive";
import { DEFAULT_MIN, DEFAULT_MAX, NUMBER_ENTITY_DOMAINS, RADIUS, INNER_RADIUS, TERTIARY_RADIUS, TIMESTAMP_STATE_DOMAINS } from "../const";
import { RenderTemplateResult } from "../ha/data/ws-templates";
import { isTemplate } from "../utils/template";
import "../components/modern-circular-gauge-element";
import "../components/modern-circular-gauge-state";
import "../components/modern-circular-gauge-icon";
import "../components/modern-circular-gauge-graph";
import { computeStateDomain } from "../ha/common/entity/compute_state_domain";
import durationToSeconds from "../ha/common/datetime/duration_to_seconds";
import { getTimerRemainingSeconds, getTimestampRemainingSeconds } from "../utils/timer_timestamp_utils";
import { compareHass } from "../utils/compare-hass";
import { MCGGraphConfig } from "../components/type";
import { computeCssColor } from "../ha/common/color/compute-color";
import { compareTemplateResult } from "../utils/compare-template-result";
import { parseNumericValue } from "../utils/entity-state-processor";
import { ModernCircularGaugeState } from "../components/modern-circular-gauge-state";
import { computeEntityName, entityNamesChanged } from "../entity-name";
import { TemplateController } from "../utils/template-controller";

const SLOT_TEMPLATE_KEYS = {
  primary: {
    entity: "entity",
    min: "min",
    max: "max",
    label: "label",
    segments: "segments",
    stateText: "stateText",
  },
  secondary: {
    entity: "secondaryEntity",
    min: "secondaryMin",
    max: "secondaryMax",
    label: "secondaryLabel",
    segments: "secondarySegments",
    stateText: "secondaryStateText",
  },
  tertiary: {
    entity: "tertiaryEntity",
    min: "tertiaryMin",
    max: "tertiaryMax",
    label: "tertiaryLabel",
    segments: "tertiarySegments",
    stateText: "tertiaryStateText",
  },
} as const;
type TemplateField = keyof typeof SLOT_TEMPLATE_KEYS.primary;

registerCustomCard({
  type: "modern-circular-gauge",
  name: "Modern Circular Gauge",
  description: "Modern circular gauge",
});

@customElement("modern-circular-gauge")
export class ModernCircularGauge extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ModernCircularGaugeConfig;

  @state() private _hasSecondary?: boolean = false;

  @state() private _templateResults?: Partial<Record<string, RenderTemplateResult | undefined>> = {};

  @state() private _stateMargin?: number;

  @state() private _inCardPicker?: boolean;

  private _templates = new TemplateController((results) => {
    this._templateResults = results;
  });

  private _entityStates: Map<EntityNames, HassEntity | string | number | undefined> = new Map();

  private _trackedEntities: Set<string> = new Set();

  private _isTimerOrTimestamp: boolean = false;

  private _interval?: any;

  public static async getConfigElement(): Promise<HTMLElement> {
    await import("./mcg-editor");
    return document.createElement("modern-circular-gauge-editor");
  }

  public static async getStubConfig(hass: HomeAssistant): Promise<ModernCircularGaugeConfig> {
    const entities = Object.keys(hass.states);
    const numbers = entities.filter((e) =>
      NUMBER_ENTITY_DOMAINS.includes(e.split(".")[0])
    );
    return {
      type: "custom:modern-circular-gauge",
      entity: numbers[0],
    };
  }

  setConfig(config: ModernCircularGaugeConfig): void {
    if (!config.entity) {
      throw new Error("Entity must be specified");
    }
    
    let secondary = config.secondary;

    if (secondary === undefined && config.secondary_entity !== undefined) {
        secondary = config.secondary_entity;
    }
    
    if (typeof secondary === "object") {
        const template = secondary.template || "";
        if (template.length > 0) {
            secondary = template;
        }

        let secondaryGaugeForegroundStyle = (secondary as SecondaryEntity).gauge_foreground_style;
        if (!secondaryGaugeForegroundStyle) {
          if ((secondary as SecondaryEntity).gauge_width !== undefined) {
            secondaryGaugeForegroundStyle = { width: (secondary as SecondaryEntity).gauge_width };
            secondary = { ...(secondary as SecondaryEntity), gauge_foreground_style: secondaryGaugeForegroundStyle };
          }
        }
    }

    let gaugeForegroundStyle = config.gauge_foreground_style;

    if (!gaugeForegroundStyle) {
      if (config.gauge_width !== undefined) {
        gaugeForegroundStyle = { width: config.gauge_width };
        config = { ...config, gauge_foreground_style: gaugeForegroundStyle };
      }
    }

    this._templates.disconnectChanged(this._templateMap(this._config), this._templateMap(config));

    this._config = { min: DEFAULT_MIN, show_header: true, show_state: true, ...config, secondary: secondary, secondary_entity: undefined };
  }

  public connectedCallback() {
    super.connectedCallback();
    this._inCardPicker = this.parentElement?.classList.contains("preview");
    this._templates.connect(this._templateMap(this._config), this.hass, this._config);
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
    this._clearInterval();
    this._templates.disconnectAll();
  }

  private _templateMap(config?: ModernCircularGaugeConfig): Record<string, unknown> {
    return {
      entity: config?.entity,
      name: config?.name,
      icon: config?.icon,
      min: config?.min,
      max: config?.max,
      label: config?.label,
      segments: config?.segments,
      stateText: config?.state_text,
      secondary: config?.secondary,
      tertiary: config?.tertiary,
      ...this._slotTemplateValues("secondary", config),
      ...this._slotTemplateValues("tertiary", config),
    };
  }

  private _slotTemplateValues(slotName: "secondary" | "tertiary", config?: ModernCircularGaugeConfig): Record<string, unknown> {
    const slotConfig = config?.[slotName];
    if (typeof slotConfig === "object") {
      return {
        [SLOT_TEMPLATE_KEYS[slotName].entity]: slotConfig.entity,
        [SLOT_TEMPLATE_KEYS[slotName].min]: slotConfig.min,
        [SLOT_TEMPLATE_KEYS[slotName].max]: slotConfig.max,
        [SLOT_TEMPLATE_KEYS[slotName].label]: slotConfig.label,
        [SLOT_TEMPLATE_KEYS[slotName].segments]: slotConfig.segments,
        [SLOT_TEMPLATE_KEYS[slotName].stateText]: slotConfig.state_text,
      };
    }
    return {};
  }

  private _startInterval() {
    this._clearInterval();
    this._interval = setInterval(() => {
      this.requestUpdate();
    }, 1000);
  }

  private _clearInterval() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = undefined;
    }
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has("_templateResults")) {
      const oldTemplateResults = _changedProperties.get("_templateResults") as Partial<Record<string, RenderTemplateResult | undefined>> | undefined;
      return compareTemplateResult(oldTemplateResults, this._templateResults);
    }
    if (_changedProperties.has("hass")) {
      if (this._trackedEntities.size <= 0) {
        if (Object.keys(this._templateResults || {}).length > 0) {
          return false;
        }
        return true;
      }
      const oldHass = _changedProperties.get("hass") as HomeAssistant | undefined;
      // Names resolve against the entity/device/area/floor registries, and HA
      // swaps the real formatEntityName in asynchronously once translations
      // load. Neither changes an entity state, so compareHass misses both.
      if (entityNamesChanged(oldHass, this.hass)) {
        return true;
      }
      return compareHass(oldHass, this.hass, this._trackedEntities);
    }
    return true;
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this._stateMargin = this._calcStateMargin();
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this.hass) {
      return;
    }

    if (this._isTimerOrTimestamp) {
      if (!this._interval) {
        this._startInterval();
      }
    }

    this._templates.connect(this._templateMap(this._config), this.hass, this._config);
  }

  private _hasCardAction() {
    return (!this._config?.tap_action ||
      hasAction(this._config?.tap_action) ||
      hasAction(this._config?.hold_action) ||
      hasAction(this._config?.double_tap_action)
    );
  }

  private _buildEntityStates() {
    this._entityStates.clear();
    this._trackedEntities.clear();
    this._isTimerOrTimestamp = false;

    if (this._config?.entity) {
      const state = this._templateResults?.entity?.result ?? (isTemplate(this._config.entity) ? undefined : this.hass.states[this._config.entity]) ?? undefined;

      if (!isTemplate(this._config.entity) && this.hass.states[this._config.entity]) {
        this._trackedEntities.add(this._config.entity);
      }

      this._entityStates.set("primary", state);
    }
    if (this._config?.secondary) {
      const secondaryEntity = typeof this._config.secondary === "string" ? this._config.secondary : this._config.secondary.entity;
      if (secondaryEntity)
      {
        const state = this._templateResults?.secondaryEntity?.result ?? (isTemplate(secondaryEntity) ? undefined : this.hass.states[secondaryEntity]) ?? undefined;

        if (!isTemplate(secondaryEntity) && this.hass.states[secondaryEntity]) {
          this._trackedEntities.add(secondaryEntity);
        }
        
        if (typeof this._config.secondary != "string" && !(this._config.secondary.show_state ?? true)) {
          this._hasSecondary = false;
        } else {
          this._hasSecondary = true;
        }

        this._entityStates.set("secondary", state);
      }
    }
    if (this._config?.tertiary) {
      const tertiaryEntity = typeof this._config.tertiary === "string" ? this._config.tertiary : this._config.tertiary.entity;
      if (tertiaryEntity)
      {
        const state = this._templateResults?.tertiaryEntity?.result ?? (isTemplate(tertiaryEntity) ? undefined : this.hass.states[tertiaryEntity]) ?? undefined;

        if (!isTemplate(tertiaryEntity) && this.hass.states[tertiaryEntity]) {
          this._trackedEntities.add(tertiaryEntity);
        }

        this._entityStates.set("tertiary", state);
      }
    }
  }

  private _getEntityState(entityName: EntityNames, attribute?: string): string | number | undefined {
    const state = this._entityStates.get(entityName);
    if (state === undefined) {
      return undefined;
    }
    if (typeof state === "object") {
      return attribute ? state.attributes[attribute] : state.state;
    }
    return state;
  }

  private _getEntityStateObj(entityName: EntityNames): HassEntity | undefined {
    if (this._entityStates.has(entityName)) {
      const state = this._entityStates.get(entityName);
      if (typeof state === "string" || typeof state === "number") {
        return undefined;
      }
      return state as HassEntity | undefined;
    }
    return undefined;
  }

  private _getEntityStatesSum(ignoreTertiary: boolean = false): number {
    let combinedStates = 0;
    this._entityStates.forEach((_, key) => {
      if (key === "primary") {
        combinedStates += Number(this._getEntityState(key, this._config?.attribute)) ?? 0;
      } else if (key === "secondary" || (key === "tertiary" && !ignoreTertiary)) {
        combinedStates += Number(this._getEntityState(key, typeof this._config?.[key] === "object" ? this._config?.[key].attribute : undefined)) ?? 0;
      }
    });
    return combinedStates;
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    this._buildEntityStates();

    const primarySlot = this._resolveSlot("primary");

    if (!primarySlot) {
      return this._renderWarning(undefined, undefined, undefined, "mdi:exclamation");
    }

    const secondarySlot = this._resolveSlot("secondary");
    const tertiarySlot = this._resolveSlot("tertiary");

    const icon = this._templateResult("icon") ?? this._config.icon;

    if (primarySlot?.error) {
      switch (primarySlot.error) {
        case "blank":
          return this._renderWarning();
        case "missing":
          return this._renderWarning(primarySlot.config.entity, undefined, undefined, "mdi:help");
        case "unavailable":
          return this._renderWarning(this._templateResult("name") ?? (typeof this._config.name === "string" ? (isTemplate(String(this._config.name)) ? "" : this._config.name) : computeEntityName(this.hass, primarySlot.stateObj, this._config.name)), this.hass.localize("state.default.unavailable"), primarySlot.stateObj, icon)
        case "nan":
          return this._renderWarning(this._templateResult("name") ?? (typeof this._config.name === "string" ? (isTemplate(String(this._config.name)) ? "" : this._config.name) : computeEntityName(this.hass, primarySlot.stateObj, this._config.name)), "NaN", primarySlot.stateObj, icon);
      }
    }
    

    const iconCenter = !(this._config.show_state ?? false) && (this._config.show_icon ?? true);
    const segments = (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config.segments;

    return html`
    <ha-card
      class="${classMap({
        "flex-column-reverse": this._config.header_position == "top",
        "action": this._hasCardAction(),
        "icon-center": iconCenter
       })}"
      @action=${this._handleAction}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config.hold_action),
        hasDoubleClick: hasAction(this._config.double_tap_action),
      })}
      tabindex=${ifDefined(
        !this._config.tap_action || hasAction(this._config.tap_action)
        ? "0"
        : undefined
      )}
    >
      ${this._config.show_header ? html`
      <div class="header" style=${styleMap({ "--gauge-header-font-size": this._config.header_font_size ? `${this._config.header_font_size}px` : undefined,
        "transform": this._config.header_offset ? `translate(0, ${this._config.header_offset}px)` : undefined })}>
        <p class="name">
          ${this._templateResults?.name?.result ?? (typeof this._config.name === "string" ? (isTemplate(String(this._config.name)) ? "" : this._config.name) : computeEntityName(this.hass, primarySlot.stateObj, this._config.name))}
        </p>
      </div>
      ` : nothing}
      <div
        class="container${classMap({ "dual-gauge": secondarySlot?.config.show_gauge === "inner" || tertiarySlot?.config.show_gauge === "inner",
          "half-gauge": this._config.gauge_type == "half", "full-gauge": this._config.gauge_type == "full" })}"
        style=${styleMap({ "--full-gauge-padding": this._config.show_header ? undefined : "0",
          "--gauge-color": this._config.gauge_foreground_style?.color && this._config.gauge_foreground_style?.color != "adaptive" ? computeCssColor(this._config.gauge_foreground_style?.color) : computeSegments(primarySlot.value ?? 0, segments, primarySlot.config.smooth_segments, this) })}
      >
        <div class="gauge-container">
          ${this._renderGauge(primarySlot)}
          ${this._renderGauge(secondarySlot)}
          ${this._renderGauge(tertiarySlot)}
        </div>
        ${this._config.show_graph ? this._renderGraph() : nothing}
        <div class="gauge-state">
          ${this._renderState(primarySlot)}
          ${this._renderState(secondarySlot)}
          ${this._renderState(tertiarySlot)}
        </div>
        ${this._config.show_icon ?? true ? this._renderIcon(icon) : nothing}
      </div> 
    </ha-card>
    `;
  }

  private _renderWarning(headerText?: string, stateText?: string, stateObj?: HassEntity, icon?: string): TemplateResult {
    const iconCenter = stateText === undefined || stateText?.length == 0;
    return html`
      <ha-card
      class="${classMap({
        "flex-column-reverse": this._config?.header_position == "top",
        "action": this._hasCardAction() && stateObj !== undefined
      })}"
      @action=${ifDefined(stateObj ? this._handleAction : undefined)}
      .actionHandler=${actionHandler({
        hasHold: hasAction(this._config?.hold_action),
        hasDoubleClick: hasAction(this._config?.double_tap_action),
      })}
      tabindex=${ifDefined(
        !this._config?.tap_action || hasAction(this._config?.tap_action)
        ? "0"
        : undefined
      )}
      >
      <div class="header" style=${styleMap({ "--gauge-header-font-size": this._config?.header_font_size ? `${this._config.header_font_size}px` : undefined,
        "transform": this._config?.header_offset ? `translate(0, ${this._config.header_offset}px)` : undefined })}>
        <p class="name">
          ${headerText}
        </p>
      </div>
      <div class=${classMap({ "icon-center": iconCenter, "container": true, "half-gauge": this._config?.gauge_type == "half", "full-gauge": this._config?.gauge_type == "full" })}>
        <modern-circular-gauge-element 
          .gaugeType=${this._config?.gauge_type}
          .radius=${this._config?.gauge_radius ?? RADIUS}
          error
        ></modern-circular-gauge-element>
        <modern-circular-gauge-state
          .hass=${this.hass}
          .stateOverride=${stateText}
          .verticalOffset=${this._config?.gauge_type == "half" ? -10 : 0}
          .gaugeType=${this._config?.gauge_type}
        ></modern-circular-gauge-state>
        ${this._config?.gauge_type == "half" && !iconCenter ? nothing : html`
        <div class="icon-container">
          <modern-circular-gauge-icon
            class="warning-icon"
            .hass=${this.hass}
            .stateObj=${stateObj}
            .icon=${icon}
            .position=${iconCenter ? 3 : 2}
          ></modern-circular-gauge-icon>
        </div>
        `}
      </div>
      </ha-card>
      `;
  }

  private _renderIcon(iconOverride?: string): TemplateResult {
    // Don't know where to put the icon in half gauge, so for now just don't render it
    if (this._config?.gauge_type == "half") {
      return html``;
    }

    const iconEntity = this._config?.icon_entity;

    let entityId: string | undefined;
    let templatedState: string | undefined;
    let segments: SegmentsConfig[] | undefined;
    let gaugeForegroundStyle: GaugeElementConfig | undefined;

    if (!iconEntity || iconEntity === "primary") {
      entityId = this._config?.entity;
      templatedState = this._templateResults?.entity?.result;
      segments = (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config?.segments;
      gaugeForegroundStyle = this._config?.gauge_foreground_style;
    } else if (
      typeof this._config?.secondary === "object" &&
      iconEntity === "secondary"
    ) {
      entityId = this._config.secondary.entity;
      templatedState = this._templateResults?.secondaryEntity?.result;
      segments = (this._templateResults?.secondarySegments?.result as unknown) as SegmentsConfig[] ?? this._config.secondary.segments;
      gaugeForegroundStyle = this._config.secondary.gauge_foreground_style;
    } else if (
      typeof this._config?.tertiary === "object" &&
      (iconEntity === "tertiary")
    ) {
      entityId = this._config.tertiary.entity;
      templatedState = this._templateResults?.tertiaryEntity?.result;
      segments = (this._templateResults?.tertiarySegments?.result as unknown) as SegmentsConfig[] ?? this._config.tertiary.segments;
      gaugeForegroundStyle = this._config.tertiary.gauge_foreground_style;
    }

    const stateObj = this.hass.states[entityId || ""];
    if (!stateObj && templatedState === undefined) {
      return html``;
    }

    const value = Number(templatedState ?? stateObj.state);
    const iconCenter = !(this._config?.show_state ?? false) && (this._config?.show_icon ?? true) && (!this._config?.combine_gauges || this._config?.gauge_type !== "full");
    const secondaryHasLabel = typeof this._config?.secondary != "string" && this._config?.secondary?.label;
    const iconPosition = iconCenter ? 3 : secondaryHasLabel && this._hasSecondary ? 0 : this._hasSecondary ? 1 : 2;

    return html`
    <div class="icon-container">
      <modern-circular-gauge-icon
        class=${classMap({ "adaptive": !!this._config?.adaptive_icon_color })}
        style=${styleMap({ "--gauge-color": gaugeForegroundStyle?.color && gaugeForegroundStyle.color != "adaptive" ? computeCssColor(gaugeForegroundStyle.color) : computeSegments(value, segments, this._config?.smooth_segments, this) })}
        .hass=${this.hass}
        .stateObj=${stateObj}
        .icon=${iconOverride}
        .position=${iconPosition}
        .iconVerticalPositionOverride=${this._config?.icon_vertical_position}
        .iconSizeOverride=${this._config?.icon_size}
        .showEntityPicture=${this._config?.show_entity_picture ?? false}
      ></modern-circular-gauge-icon>
    </div>
    `;
  }

  private _renderGraph(): TemplateResult {
    if (this._config?.gauge_type == "half") {
      return html``;
    }

    if (this._config?.secondary && typeof this._config?.secondary != "string" && this._config.secondary.state_size == "big") {
      return html``;
    }

    let graphConfig: MCGGraphConfig = { entitys: new Map(), hours_to_show: this._config?.graph_hours_to_show,
      smooth_segments: this._config?.smooth_segments ?? false,
      points_per_hour: this._config?.graph_points_per_hour
    };
    
    if (this._config?.show_in_graph ?? true) {
      graphConfig.entitys?.set("primary", { entity: this._config?.entity ?? "",
        min: parseNumericValue(this._templateResults?.min?.result ?? this._config?.min) ?? DEFAULT_MIN,
        max: parseNumericValue(this._templateResults?.max?.result ?? this._config?.max) ?? DEFAULT_MAX,
        segments: (this._templateResults?.segments?.result as unknown) as SegmentsConfig[] ?? this._config?.segments,
        adaptive_range: this._config?.adaptive_graph_range
      });
    }
    if (this._config?.secondary && typeof this._config?.secondary != "string" && this._config.secondary.show_in_graph) {
      const secondaryEntity = this._config?.secondary?.entity;
      if (secondaryEntity) {
        graphConfig.entitys?.set("secondary", { entity: secondaryEntity,
          min: parseNumericValue(this._templateResults?.secondaryMin?.result ?? this._config?.secondary?.min) ?? DEFAULT_MIN,
          max: parseNumericValue(this._templateResults?.secondaryMax?.result ?? this._config?.secondary?.max) ?? DEFAULT_MAX,
          segments: (this._templateResults?.secondarySegments?.result as unknown) as SegmentsConfig[] ?? this._config?.secondary?.segments,
          adaptive_range: this._config.secondary.adaptive_graph_range
        });
      }
    }
    if (this._config?.tertiary && typeof this._config?.tertiary != "string" && this._config.tertiary.show_in_graph) {
      const tertiaryEntity = this._config?.tertiary?.entity;
      if (tertiaryEntity) {
        graphConfig.entitys?.set("tertiary", { entity: tertiaryEntity,
          min: parseNumericValue(this._templateResults?.tertiaryMin?.result ?? this._config?.tertiary?.min) ?? DEFAULT_MIN,
          max: parseNumericValue(this._templateResults?.tertiaryMax?.result ?? this._config?.tertiary?.max) ?? DEFAULT_MAX,
          segments: (this._templateResults?.tertiarySegments?.result as unknown) as SegmentsConfig[] ?? this._config?.tertiary?.segments,
          adaptive_range: this._config.tertiary.adaptive_graph_range
        });
      }
    }
    return html`
    <modern-circular-gauge-graph
      .hass=${this.hass}
      .config=${graphConfig}
    ></modern-circular-gauge-graph>
    `;
  }

  private _calcStateMargin(): number {
    let gauges: any[] = [];

    if (typeof this._config?.secondary != "string") {
      if (this._config?.secondary?.show_gauge == "inner") {
        const gauge = { radius: this._config.secondary.gauge_radius ?? INNER_RADIUS, width: this._config.secondary.gauge_foreground_style?.width ?? 4 };
        gauges.push(gauge)
      }
    }

    if (typeof this._config?.tertiary != "string") {
      if (this._config?.tertiary?.show_gauge == "inner") {
        const gauge = { radius: this._config.tertiary.gauge_radius ?? TERTIARY_RADIUS, width: this._config.tertiary.gauge_foreground_style?.width ?? 4 };
        gauges.push(gauge)
      }
    }

    gauges.push({ radius: this._config?.gauge_radius ?? RADIUS, width: this._config?.gauge_foreground_style?.width ?? (gauges.length > 1 ? 4 : 6) });
    const gauge = gauges.reduce((r, e) => r.radius < e.radius ? r : e);

    return (gauge.radius - gauge.width) * 2;
  }

  private _resolveSlot(slotName: EntityNames): GaugeSlot | undefined {
    if (!this._config) {
      return undefined;
    }

    const slotConfig = this._getSlotConfig(slotName);

    if (!slotConfig) {
      return undefined;
    }

    if (!slotConfig.entity) {
      return undefined;
    }

    const stateObj = this._getEntityStateObj(slotName);
    const entityState = this._getEntityState(slotName, slotConfig.attribute);
    const templatedState = this._slotTemplate(slotName, "entity");
    const isEntityTemplate = isTemplate(slotConfig.entity);

    if (!stateObj && templatedState === undefined) {
      let error: "missing" | "blank" = "missing";

      if (isEntityTemplate) {
        error = "blank";
      } else {
        error = "missing";
      }
      return {
        name: slotName,
        className: slotName,
        config: slotConfig,
        error: error,
      }
    }

    if (stateObj && stateObj?.state === "unavailable") {
      return {
        name: slotName,
        className: slotName,
        config: slotConfig,
        stateObj: stateObj,
        error: "unavailable",
      };
    }

    const domain = computeStateDomain(stateObj!);
    let secondsUntil: number | undefined;

    if ((!isEntityTemplate && stateObj && stateObj?.attributes?.device_class === "timestamp") ||
      TIMESTAMP_STATE_DOMAINS.includes(domain)
    ) {
      secondsUntil = getTimestampRemainingSeconds(stateObj!);
      this._isTimerOrTimestamp = true;
    }

    let calculatedMax: number | undefined;

    if (domain === "timer") {
      calculatedMax = durationToSeconds(stateObj?.attributes?.duration ?? "00:00");
      secondsUntil = getTimerRemainingSeconds(stateObj!);
      this._isTimerOrTimestamp = true;
    }

    if (this._config.combine_gauges && this._config.gauge_type === "full") {
      calculatedMax = this._getEntityStatesSum(true);
    }

    const numberState = Number(templatedState ?? secondsUntil ?? entityState);

    const stateOverride = 
      this._config.combine_gauges && this._config.gauge_type === "full" 
      ? this._getEntityStatesSum(true)
      : (this._slotTemplate(slotName, "stateText") ?? (isTemplate(String(slotConfig.state_text)) ? "" : (slotConfig.state_text || undefined)));

    if (isNaN(numberState)) {
      return {
        name: slotName,
        className: slotName,
        stateOverride: stateOverride,
        config: slotConfig,
        stateObj: stateObj,
        error: "nan",
      };
    }

    const min = parseNumericValue(this._slotTemplate(slotName, "min") ?? slotConfig.min) ?? DEFAULT_MIN;
    const max = parseNumericValue(this._slotTemplate(slotName, "max") ?? slotConfig.max ?? calculatedMax) ?? DEFAULT_MAX;

    const segments = (this._slotTemplate(slotName, "segments") as unknown as SegmentsConfig[]) ?? slotConfig.segments;
    const segmentsLabel = this._getSegmentLabel(numberState, segments);

    return {
      name: slotName,
      className: slotName,
      config: slotConfig,
      stateObj: stateObj,
      value: numberState,
      min: min,
      max: max,
      stateOverride: (segmentsLabel || stateOverride) ?? templatedState,
      label: this._slotTemplate(slotName, "label") ?? (isTemplate(String(slotConfig.label)) ? "" : slotConfig.label),
      segments: segments
    }
  }

  private _getSlotConfig(slotName: EntityNames): BaseEntityConfig | undefined {
    if (!this._config) {
      return undefined;
    }

    if (slotName === "primary") {
      return this._config;
    }

    const slotConfig = this._config[slotName];

    if (typeof slotConfig === "string") {
      return { 
        entity: slotConfig,
        show_gauge: "none",
      };
    }

    return slotConfig;
  }

  private _renderGauge(slot: GaugeSlot | undefined): TemplateResult {
    if (!slot) {
      return html``;
    }

    const canCombineGauges = this._config?.combine_gauges && this._config.gauge_type === "full" && slot.name !== "tertiary";

    const secondaryInner =
      typeof this._config?.secondary !== "string" &&
      this._config?.secondary?.show_gauge === "inner";
    const RADIUS_MAP: Record<EntityNames, number> = {
      primary: this._config?.gauge_radius ?? RADIUS,
      secondary: slot.config.gauge_radius ?? INNER_RADIUS,
      tertiary: slot.config.gauge_radius ?? (secondaryInner ? TERTIARY_RADIUS : INNER_RADIUS),
    };
    const radius = canCombineGauges ? RADIUS_MAP["primary"] : RADIUS_MAP[slot.name];

    if (slot.name === "primary" ||slot.config.show_gauge == "inner" || canCombineGauges) {
      if (slot.error) {
        switch (slot.error) {
          case "blank":
          case "missing":
            if (canCombineGauges) {
              return html``;
            }
            return html`
              <modern-circular-gauge-element
                class=${slot.className}
                .radius=${RADIUS_MAP[slot.name]}
                .gaugeType=${this._config?.gauge_type}
              ></modern-circular-gauge-element>
            `;
          case "unavailable":
            return html`
              <modern-circular-gauge-element
                class=${slot.className}
                .radius=${radius}
                .gaugeType=${this._config?.gauge_type}
                .disableBackground=${canCombineGauges}
                error
              ></modern-circular-gauge-element>
            `;
          case "nan":
            return html`
              <modern-circular-gauge-element
                class=${slot.className}
                .radius=${radius}
                .gaugeType=${this._config?.gauge_type}
                .disableBackground=${canCombineGauges}
                error
              ></modern-circular-gauge-element>
            `;
        }
      }

      return html`
        <modern-circular-gauge-element
          class=${slot.className}
          .min=${slot.min}
          .max=${slot.max}
          .value=${slot.value}
          .radius=${radius}
          .gaugeType=${this._config?.gauge_type}
          .segments=${slot.segments}
          .smoothSegments=${slot.config.smooth_segments}
          .foregroundStyle=${slot.config?.gauge_foreground_style}
          .backgroundStyle=${slot.config?.gauge_background_style}
          .needle=${slot.config?.needle}
          .startFromZero=${slot.config.start_from_zero}
          .rotateGauge=${this._config?.rotate_gauge}
          .disableBackground=${canCombineGauges}
          .flipGauge=${canCombineGauges}
          .linePadding=${canCombineGauges ? 7.5 : 0}
          .lineOffset=${canCombineGauges ? 3.25 : 0}
          .invertedMode=${slot.config?.inverted_mode}
          .needleConfig=${slot.config?.needle_config}
        ></modern-circular-gauge-element>
      `;
    } else {
      if (slot.error) {
        return html``;
      }

      return html`
        <modern-circular-gauge-element
          class=${slot.className}
          .min=${slot.min}
          .max=${slot.max}
          .value=${slot.value}
          .radius=${this._config?.gauge_radius ?? RADIUS}
          .gaugeType=${this._config?.gauge_type}
          .foregroundStyle=${slot.config?.gauge_foreground_style}
          .backgroundStyle=${slot.config?.gauge_background_style}
          .outter=${true}
          .rotateGauge=${this._config?.rotate_gauge}
          .invertedMode=${slot.config?.inverted_mode}
          .needleConfig=${slot.config?.needle_config}
        ></modern-circular-gauge-element>
      `;
    }
  }

  private _renderState(slot: GaugeSlot | undefined): TemplateResult {
    if (!slot) {
      return html``;
    }

    if (!(slot.config.show_state ?? true)) {
      return html``;
    }

    const stateSize = slot.name === "primary" ? "big" : slot.name === "tertiary" ? "small" : slot.config.state_size ?? "small";

    if (slot.error) {
      switch (slot.error) {
        case "blank":
        case "missing":
          return html``;
        case "unavailable":
          return html`
            <modern-circular-gauge-state
              class=${classMap({ "preview": this._inCardPicker!, "warning": true, [slot.className]: Boolean(slot.className) })}
              .hass=${this.hass}
              .gaugeType=${this._config?.gauge_type}
              .stateMargin=${this._stateMargin}
              .stateSize=${stateSize}
              .stateOverride=${this.hass.localize("state.default.unavailable")}
              .label=${slot.label}
            ></modern-circular-gauge-state>
          `;
      }
    }

    const label = slot.name === "primary"
      ? typeof this._config?.secondary != "string" && this._config?.secondary?.state_size == "big" 
        ? slot.label : "" 
      : this._config?.gauge_type == "half" && stateSize != "big" ? "" : slot.label;

    let color;

    if (slot.config.adaptive_state_color || slot.config.adaptive_label_color) {
      color = "var(--gauge-color)";
      if (slot.config.show_gauge == "outer" || slot.config.show_gauge == "outter") {
        color = computeSegments(slot.value ?? 0, this._slotTemplate("primary", "segments") as unknown as SegmentsConfig[] ?? this._config?.segments, this._config?.smooth_segments, this);
      } else if (slot.segments) {
        color = computeSegments(slot.value ?? 0, slot.segments, slot.config.smooth_segments, this);
      }

      if (slot.config.gauge_foreground_style?.color && slot.config.gauge_foreground_style.color != "adaptive") {
        color = computeCssColor(slot.config.gauge_foreground_style.color);
      }
    }

    const hasSecondary = typeof this._config?.secondary != "string" && this._config?.secondary?.show_gauge == "inner";
    const hasTertiary = typeof this._config?.tertiary != "string" && this._config?.tertiary?.show_gauge == "inner";

    const { x, y, fontPx } = stateLayout(slot.name, {
      gaugeType: this._config?.gauge_type ?? "standard",
      hasSecondary: !!this._config?.secondary,
      secondaryBig: !!this._config?.secondary && typeof this._config?.secondary != "string" && this._config?.secondary?.state_size == "big",
      iconCenter: !!this._config?.icon_center,
      threeGauges: hasTertiary && hasSecondary,
    });

    return html`
      <modern-circular-gauge-state
        class=${classMap({ "preview": this._inCardPicker!, [slot.className]: Boolean(slot.className) })}
        style=${styleMap({ "--state-text-color-override": slot.config.adaptive_state_color ? color ?? (slot.config.state_size == "big" ? "var(--secondary-text-color)" : undefined) : (slot.config.state_size == "big" ? "var(--secondary-text-color)" : undefined),
          "--state-font-size-override": slot.config.state_font_size ? `${slot.config.state_font_size}px` : fontPx ? `${fontPx}px` : undefined,
          "--state-label-color-override": slot.config.adaptive_label_color ? (color ?? "var(--gauge-color)") : undefined,
          "font-family": slot.config.state_font_family ? slot.config.state_font_family : undefined })}
        .hass=${this.hass}
        .stateObj=${slot.stateObj}
        .entityAttribute=${slot.config.attribute}
        .stateOverride=${slot.stateOverride}
        .unit=${slot.config.unit}
        .verticalOffset=${y}
        .horizontalOffset=${x}
        .stateSize=${stateSize}
        .label=${label}
        .gaugeType=${this._config?.gauge_type}
        .stateMargin=${this._stateMargin}
        .labelFontSize=${slot.config.label_font_size}
        .showUnit=${slot.config.show_unit ?? true}
        .showSeconds=${slot.config.show_seconds}
        .decimals=${slot.config.decimals}
        .unitSuperscript=${slot.config.unit_superscript}
        .timeFormat=${slot.config.time_format}
        .stateFormat=${slot.config.state_format}
        .min=${slot.min}
        .max=${slot.max}
      ></modern-circular-gauge-state>
    `;;
  }

  private _getSegmentLabel(numberState: number, segments: SegmentsConfig[] | undefined): string {
    if (segments) {
      let sortedSegments = [...segments].sort((a, b) => Number(a.from) - Number(b.from));

      for (let i = sortedSegments.length - 1; i >= 0; i--) {
        let segment = sortedSegments[i];
        if (numberState >= Number(segment.from) || i === 0) {
          return segment.label || "";
        }
      }
    }
    return "";
  }

  private _templateResult(key: string) {
    return this._templateResults?.[key]?.result;
  }

  private _slotTemplate(slot: EntityNames, field: TemplateField) {
    return this._templateResult(SLOT_TEMPLATE_KEYS[slot][field]);
  }

  private _handleAction(ev: ActionHandlerEvent) {
    ev.stopPropagation();
    let targetEntity = this._config?.entity;
    let entityConfig = this._config as any;

    if (ev.target instanceof ModernCircularGaugeState) {
      if (ev.target.classList.contains("secondary")) {
        targetEntity = typeof this._config?.secondary == "string" ? this._config?.secondary : this._config?.secondary?.entity;
        entityConfig = typeof this._config?.secondary == "string" ? {} : this._config?.secondary ?? {};
      }
      if (ev.target.classList.contains("tertiary")) {
        targetEntity = typeof this._config?.tertiary == "string" ? this._config?.tertiary : this._config?.tertiary?.entity;
        entityConfig = typeof this._config?.tertiary == "string" ? {} : this._config?.tertiary ?? {};
      }
    }

    const config = {
      ...entityConfig,
      entity: isTemplate(targetEntity ?? "") ? "" : targetEntity
    };

    handleAction(this, this.hass!, config, ev.detail.action!);
  }

  public getGridOptions(): LovelaceGridOptions {
    return {
      columns: 6,
      rows: 4,
      min_rows: this._config?.gauge_type == "half" ? 2 : 3,
      min_columns: 4
    };
  }

  public getLayoutOptions(): LovelaceLayoutOptions {
    return {
      grid_columns: 2,
      grid_rows: 3,
      grid_min_rows: this._config?.gauge_type == "half" ? 2 : 3,
      grid_min_columns: 2
    };
  }

  public getCardSize(): Promise<number> | number {
    return 4;
  }

  static get styles() {
    return css`
    :host {
      --gauge-primary-color: var(--light-blue-color);
      --gauge-secondary-color: var(--orange-color);
      --gauge-tertiary-color: var(--light-green-color);

      --gauge-color: var(--gauge-primary-color);
      --gauge-stroke-width: 6px;
      --inner-gauge-stroke-width: 4px;
      --gauge-header-font-size: 14px;

      --half-gauge-padding: 16px 0px 24px;
      --full-gauge-padding: 20px 0px;
    }

    ha-card {
      width: 100%;
      height: 100%;
      display: flex;
      padding: 10px;
      flex-direction: column-reverse;
      align-items: center;
      overflow: hidden;
    }

    ha-card.action {
      cursor: pointer
    }

    .flex-column-reverse {
      flex-direction: column;
    }
    
    .header {
      position: absolute;
      width: 100%;
      display: flex;
      flex-direction: column;
      text-align: center;
      padding: 0 10px;
      box-sizing: border-box;
    }

    .flex-column-reverse .header {
      position: relative;
    }
    
    .gauge-state {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 2;
      padding: inherit;
    }

    modern-circular-gauge-state, modern-circular-gauge-graph {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      padding: inherit;
    }

    .half-gauge modern-circular-gauge-state.secondary,
    .half-gauge modern-circular-gauge-state.tertiary {
      --state-font-size-override: 8px;
    }

    .half-gauge modern-circular-gauge-state:not(.secondary):not(.tertiary) {
      --state-font-size-override: 20px;
    }

    .container {
      position: relative;
      container-type: inline-size;
      container-name: container;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }

    .container.half-gauge {
      padding: var(--half-gauge-padding);
    }

    .container.full-gauge {
      padding: var(--full-gauge-padding);
    }

    .flex-column-reverse .container {
      margin-bottom: 0px;
    }

    .state-label {
      font-size: 0.49em;
      fill: var(--secondary-text-color);
    }

    modern-circular-gauge-icon {
      color: var(--state-icon-color);
    }

    .warning-icon {
      color: var(--state-unavailable-color);
    }

    .adaptive {
      color: var(--gauge-color);
    }

    .value.adaptive, .secondary.adaptive, .tertiary-state.adaptive {
      fill: var(--gauge-color);
    }

    .name {
      width: 100%;
      font-size: var(--gauge-header-font-size);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      line-height: 20px;
      letter-spacing: .1px;
      color: var(--primary-text-color);
    }

    .unit {
      font-size: .33em;
      opacity: 0.6;
    }

    .gauge-container {
      height: 100%;
      width: 100%;
      display: block;
    }

    modern-circular-gauge-element.secondary, modern-circular-gauge-element.tertiary {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
    }

    .half-gauge modern-circular-gauge-element.secondary, .half-gauge modern-circular-gauge-element.tertiary {
      padding: var(--half-gauge-padding);
    }

    .full-gauge modern-circular-gauge-element.secondary, .full-gauge modern-circular-gauge-element.tertiary {
      padding: var(--full-gauge-padding);
    }

    .icon-container {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      padding: inherit;
    }

    .secondary {
      --gauge-color: var(--gauge-secondary-color);
    }

    .tertiary {
      --gauge-color: var(--gauge-tertiary-color);
    }

    .dual-gauge modern-circular-gauge-element {
      --gauge-stroke-width: 4px;
      --gauge-default-stroke-width: 4px;
    }

    .dot {
      fill: none;
      stroke-linecap: round;
      stroke-width: calc(var(--gauge-stroke-width) / 2);
      stroke: var(--primary-text-color);
      transition: all 1s ease 0s;
    }

    .dot.border {
      stroke: var(--gauge-color);
      stroke-width: var(--gauge-stroke-width);
    }
    `;
  }
}
