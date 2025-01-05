import { Connection, UnsubscribeFunc } from "home-assistant-js-websocket";

export interface RenderTemplateResult {
  result: string;
  listeners: TemplateListeners;
}

export interface RenderTemplateError {
  error: string;
  level: "ERROR" | "WARNING";
}

interface TemplateListeners {
  all: boolean;
  domains: string[];
  entities: string[];
  time: boolean;
} 

export const subscribeRenderTemplate = (
  conn: Connection,
  onChange: (result: RenderTemplateResult | RenderTemplateError) => void,
  params: {
    template: string;
    entity_ids?: string | string[];
    variables?: Record<string, unknown>;
    timeout?: number;
    strict?: boolean;
    report_errors?: boolean;
  }
): Promise<UnsubscribeFunc> =>
  conn.subscribeMessage(
    (msg: RenderTemplateResult | RenderTemplateError) => onChange(msg),
    {
      type: "render_template",
      ...params,
    }
  );