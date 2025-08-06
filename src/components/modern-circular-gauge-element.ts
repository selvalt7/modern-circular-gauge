import { html, LitElement, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { DEFAULT_MAX, DEFAULT_MIN, GAUGE_TYPE_ANGLES, MAX_ANGLE } from "../const";
import { GaugeElementConfig, GaugeType, SegmentsConfig } from "../card/type";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { svgArc, renderPath, currentDashArc, strokeDashArc, renderColorSegments, computeSegments } from "../utils/gauge";

@customElement("modern-circular-gauge-element")
export class ModernCircularGaugeElement extends LitElement {
  @property({ type: Number }) public min = DEFAULT_MIN;

  @property({ type: Number }) public max = DEFAULT_MAX;

  @property({ type: Number }) public value = 0;

  @property({ type: Number }) public radius = 47;

  @property({ type: String }) public gaugeType: GaugeType = "standard";

  @property({ type: Boolean }) public rotateGauge = false;

  @property({ type: Array }) public segments?: SegmentsConfig[];

  @property({ type: Boolean }) public smoothSegments = false;

  @property({ type: Object }) public foregroundStyle?: GaugeElementConfig;

  @property({ type: Object }) public backgroundStyle?: GaugeElementConfig;

  @property({ type: Boolean }) public needle = false;

  @property({ type: Boolean }) public startFromZero = false;

  @property({ type: Boolean }) public outter = false;

  @state() private _updated = false;

  @state() private _path?: string;

  @state() private _rotateAngle?: number;

  @state() private _maxAngle: number = MAX_ANGLE;

  public connectedCallback(): void {
    super.connectedCallback();
    if (!this._updated) {
      this._maxAngle = GAUGE_TYPE_ANGLES[this.gaugeType] ?? MAX_ANGLE;
      this._path = svgArc({
        x: 0,
        y: 0,
        start: 0,
        end: this._maxAngle,
        r: this.radius,
      });
      this._rotateAngle = 360 - this._maxAngle / 2 - 90;
      this._updated = true;
    }
  }

  protected render() {
    if (!this._path) {
      return nothing;
    }

    if (this.outter)
    {
      const current = strokeDashArc(this.value, this.value, this.min, this.max, this.radius, this._maxAngle);

      return html`
      <svg viewBox="-50 -50 100 ${this.gaugeType == "half" ? 50 : 100}" preserveAspectRatio="xMidYMid"
        overflow="visible"
        style=${styleMap({ "--gauge-stroke-width": this.foregroundStyle?.width ? `${this.foregroundStyle?.width}px` : undefined,
        "--gauge-color": this.foregroundStyle?.color && this.foregroundStyle?.color != "adaptive" ? this.foregroundStyle?.color : computeSegments(this.value, this.segments, this.smoothSegments, this) })}
      >
        <g transform="rotate(${this._rotateAngle})">
          ${!this.foregroundStyle?.color ? renderPath("dot border", this._path, current, styleMap({ "opacity": this.foregroundStyle?.opacity ?? 1, "stroke-width": this.foregroundStyle?.width })) : nothing}
          ${renderPath("dot", this._path, current, styleMap({ "opacity": this.foregroundStyle?.opacity ?? 1, "stroke": this.foregroundStyle?.color, "stroke-width": this.foregroundStyle?.width }))}
        </g>
      </svg>
      `
    } else {
      const current = this.needle ? undefined : currentDashArc(this.value, this.min, this.max, this.radius, this.startFromZero, this._maxAngle);
      const needle = this.needle ? strokeDashArc(this.value, this.value, this.min, this.max, this.radius, this._maxAngle) : undefined;
      
      return html`
        <svg viewBox="-50 -50 100 ${this.gaugeType == "half" ? 50 : 100}" preserveAspectRatio="xMidYMid"
          overflow="visible"
          style=${styleMap({ "--gauge-stroke-width": this.foregroundStyle?.width ? `${this.foregroundStyle?.width}px` : undefined,
          "--gauge-color": this.foregroundStyle?.color && this.foregroundStyle?.color != "adaptive" ? this.foregroundStyle?.color : computeSegments(this.value, this.segments, this.smoothSegments, this) })}
        >
          <g transform="rotate(${this._rotateAngle! + (this.gaugeType == "full" && this.rotateGauge ? 180 : 0)})">
            <defs>
              <mask id="needle-border-mask">
                <rect x="-70" y="-70" width="140" height="140" fill="white"/>
                ${needle ? svg`
                <path
                  class="needle-border"
                  d=${this._path}
                  stroke-dasharray="${needle[0]}"
                  stroke-dashoffset="${needle[1]}"
                  stroke="black"
                />
                ` : nothing}
              </mask>
              <mask id="gradient-path">
                ${renderPath("arc", this._path, undefined, styleMap({ "stroke": "white", "stroke-width": this.backgroundStyle?.width ? `${this.backgroundStyle?.width}px` : undefined }))}
              </mask>
              <mask id="gradient-current-path">
                ${current ? renderPath("arc current", this._path, current, styleMap({ "stroke": "white", "visibility": this.value <= this.min && this.min >= 0 ? "hidden" : "visible" })) : nothing}
              </mask>
            </defs>
            <g class="background" mask=${ifDefined(needle ? "url(#needle-border-mask)" : undefined)} style=${styleMap({ "opacity": this.backgroundStyle?.opacity,
              "--gauge-stroke-width": this.backgroundStyle?.width ? `${this.backgroundStyle?.width}px` : undefined })}>
              ${renderPath("arc clear", this._path, undefined, styleMap({ "stroke": this.backgroundStyle?.color && this.backgroundStyle.color != "adaptive" ? this.backgroundStyle.color : undefined }))}
              ${this.segments && (needle || this.backgroundStyle?.color == "adaptive") ? svg`
              <g class="segments" mask=${ifDefined(this.smoothSegments ? "url(#gradient-path)" : undefined)}>
                ${renderColorSegments(this.segments, this.min, this.max, this.radius, this.smoothSegments, this._maxAngle)}
              </g>`
              : nothing
              }
            </g>
            ${current ? this.foregroundStyle?.color == "adaptive" && this.segments ? svg`
            <g class="foreground-segments" mask="url(#gradient-current-path)" style=${styleMap({ "opacity": this.foregroundStyle?.opacity })}>
              ${renderColorSegments(this.segments, this.min, this.max, this.radius, this.smoothSegments, this._maxAngle)}
            </g>
            ` : renderPath("arc current", this._path, current, styleMap({ "visibility": this.value <= this.min && this.min >= 0 ? "hidden" : "visible", "opacity": this.foregroundStyle?.opacity }))
            : nothing}
            ${needle ? svg`
            ${renderPath("needle", this._path, needle)}
            ` : nothing}
          </g>
        </svg>
      `;
    }
  }

  static get styles() {
    return css`
    :host {
      --gauge-primary-color: var(--light-blue-color);

      --gauge-color: var(--gauge-primary-color);
      --gauge-stroke-width: 6px;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    g {
      fill: none;
    }
    .arc {
      fill: none;
      stroke-linecap: round;
      stroke-width: var(--gauge-stroke-width);
    }

    .arc.clear {
      stroke: var(--primary-background-color);
    }

    .arc.current {
      stroke: var(--gauge-color);
      transition: all 1s ease 0s;
    }

    .segment {
      fill: none;
      stroke-width: var(--gauge-stroke-width);
    }

    .segments {
      opacity: 0.45;
    }

    .needle {
      fill: none;
      stroke-linecap: round;
      stroke-width: var(--gauge-stroke-width);
      stroke: var(--gauge-color);
      transition: all 1s ease 0s;
    }

    .needle-border {
      fill: none;
      stroke-linecap: round;
      stroke-width: calc(var(--gauge-stroke-width) + 4px);
      transition: all 1s ease 0s, stroke 0.3s ease-out;
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