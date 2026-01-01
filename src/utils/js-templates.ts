import HomeAssistantJavaScriptTemplates from "home-assistant-javascript-templates";

declare global {
  interface Window {
    __mcg_haJsTemplates?: HomeAssistantJavaScriptTemplates;
  }
}

export const getHaJsTemplates = (): HomeAssistantJavaScriptTemplates => {
  if (!window.__mcg_haJsTemplates) {
    window.__mcg_haJsTemplates = new HomeAssistantJavaScriptTemplates(
      document.querySelector("home-assistant") as any
    );
  }
  return window.__mcg_haJsTemplates;
};
