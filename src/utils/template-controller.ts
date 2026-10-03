import { UnsubscribeFunc } from "home-assistant-js-websocket";
import { RenderTemplateResult, subscribeRenderTemplate } from "../ha/data/ws-templates";
import { HomeAssistant } from "../ha/types";
import { isJSTemplate, isTemplate, JSTemplateRegex } from "./template";
import { getHaJsTemplates } from "./js-templates";

type Unsub = UnsubscribeFunc | Promise<UnsubscribeFunc>;

export class TemplateController {
  results: Record<string, RenderTemplateResult | undefined> = {};
  private unsubs = new Map<string, Unsub>();
  private haJsTemplates = getHaJsTemplates();
  constructor(
    private onChange: (results: typeof this.results) => void
  ) {}
  get(key: string) {
    return this.results[key]?.result;
  }
  /** Subscribe every string / segments value. Keys already subscribed are skipped. */
  connect(
    templates: Record<string, unknown>,
    hass: HomeAssistant,
    config: unknown
  ) {
    if (!hass || !config) return;

    Object.entries(templates).forEach(([key, value]) => {
      this._connectValue(key, value, hass, config);
    });
  }

  private _connectValue(key: string, value: unknown, hass: HomeAssistant, config: unknown) {
    if (typeof value === "string") this._connectKey(key, value, hass, config);
    else if (/segments$/i.test(key) && value != null)
      this._connectKey(key, JSON.stringify(value).replace(/\\"/g, "'"), hass, config);
  }

  private async _connectKey(key: string, template: string, hass: HomeAssistant, config: unknown) {
    if (this.unsubs.has(key) || !isTemplate(template)) return;

    if (isJSTemplate(template)) {
      const isSegments = /segments$/i.test(key);
      if (isSegments) {
        const pending = this.haJsTemplates.getRenderer()
        .then((renderer) => {
          const untrack = renderer.trackTemplate(
            `
              const processedSegments = [];
              for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const newSegment = { ...segment };
                const keys = Object.keys(segment);
                keys.forEach((k) => {
                  if (typeof segment[k] === "string" && JSRegex.test(segment[k])) {
                    const segmentValue = segment[k].replace(JSRegex, "$1");
                    const functionBody = segmentValue.includes('return')
                    ? segmentValue
                    : 'return ' + segmentValue;
                    newSegment[k] = eval('(function(){' + functionBody + '})()');
                  }
                });
                processedSegments.push(newSegment);
              }
              return processedSegments;
            `,
            (result) => {
              const templateResult = {
                result: (result as string) ?? "",
                listeners: { all: false, domains: [], entities: [], time: false },
              };
              this.results = {
                ...this.results,
                [key]: templateResult,
              };
              this.onChange(this.results);
            }, {variables: {"segments": JSON.parse(template), "JSRegex": JSTemplateRegex}});
            this.unsubs?.set(key, untrack);
            return untrack;
        });
        this.unsubs?.set(key, pending);
      } else {
        const pending = this.haJsTemplates.getRenderer()
        .then((renderer) => {
          const untrack = renderer.trackTemplate(
            template.replace(JSTemplateRegex, "$1"),
            (result) => {
              const templateResult = {
                result: (result as string) ?? "",
                listeners: { all: false, domains: [], entities: [], time: false },
              };
              this.results = {
                ...this.results,
                [key]: templateResult,
              };
              this.onChange(this.results);
            }
          );
          this.unsubs?.set(key, untrack);
          return untrack;
        });
        this.unsubs?.set(key, pending);
      }
    } else {
      try {
        const sub = subscribeRenderTemplate(
          hass.connection,
          (result) => {
            if ("error" in result) {
              return;
            }
            this.results = {
              ...this.results,
              [key]: result,
            };
            this.onChange(this.results);
          },
          {
            template: template as string || "",
            variables: {
              config: config,
              user: hass.user!.name,
            },
            strict: true,
          }
        );
        this.unsubs?.set(key, sub);
        await sub;
      } catch (e: any) {
        const result = {
          result: template as string || "",
          listeners: { all: false, domains: [], entities: [], time: false },
        };
        this.results = {
          ...this.results,
          [key]: result,
        };
        this.onChange(this.results);
        this.unsubs?.delete(key);
      }
    }
  }

  async disconnect(key: string) { 
    const unsubRenderTemplate = this.unsubs?.get(key);
    if (!unsubRenderTemplate) {
      return;
    }

    if (unsubRenderTemplate instanceof Promise === false) {
      unsubRenderTemplate();
      this.unsubs?.delete(key);
      return;
    }

    try {
      const unsub = await unsubRenderTemplate;
      unsub();
      this.unsubs?.delete(key);
      const { [key]: _, ...rest } = this.results;
      this.results = rest;
      this.onChange(this.results);
    } catch (e: any) {
      if (e.code === "not_found" || e.code === "template_error") {

      } else {
        throw e;
      }
    }
  }

  async disconnectAll() {
    for (const key of [...this.unsubs.keys()]) await this.disconnect(key);
  }

  async disconnectChanged(
    prev: Record<string, unknown> | undefined,
    next: Record<string, unknown>
  ) {
    const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)]);
    for (const key of keys) {
      if (prev?.[key] !== next[key]) await this.disconnect(key);
    }
  }
}