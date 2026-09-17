import { NUMBER_ENTITY_DOMAINS } from "../const";
import { computeDomain } from "../ha/common/entity/compute_domain";

interface RegisterCardParams {
  type: string;
  name: string;
  description: string;
}

export function registerCustomCard(params: RegisterCardParams) {
  const windowWithCards = window as unknown as Window & {
      customCards: unknown[];
  }
  windowWithCards.customCards = windowWithCards.customCards || [];

  windowWithCards.customCards.push({
    ...params,
    preview: true,
    documentationURL: `https://github.com/selvalt7/modern-circular-gauge`,
    getEntitySuggestion: (hass, entityId) => {
      const domain = computeDomain(entityId);
      if (!NUMBER_ENTITY_DOMAINS.includes(domain)) return null;
      const stateObj = hass.states[entityId];
      if (!stateObj || isNaN(Number(stateObj.state))) return null;

      if (stateObj.attributes?.device_class === "wind_direction") {
        return {
          config: {
            type: 'custom:modern-circular-gauge',
            entity: entityId,
            max: 360,
            gauge_type: 'full',
            needle: true,
            rotate_gauge: true,
            needle_config: {
              type: 'arrow',
              rotate: 180,
            },
            show_icon: false,
            state_format: 'direction',
          }
        }
      }

      return {
        config: {
          type: 'custom:modern-circular-gauge',
          entity: entityId
        }
      }
    }
  })
}