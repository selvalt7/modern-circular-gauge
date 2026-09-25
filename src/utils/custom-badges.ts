import { NUMBER_ENTITY_DOMAINS } from "../const";
import { computeDomain } from "../ha/common/entity/compute_domain";

interface RegisterBadgeParams {
  type: string;
  name: string;
  description: string;
}

export function registerCustomBadge(params: RegisterBadgeParams) {
  const windowWithCards = window as unknown as Window & {
      customBadges: unknown[];
  }
  windowWithCards.customBadges = windowWithCards.customBadges || [];

  windowWithCards.customBadges.push({
      ...params,
      preview: true,
      documentationURL: `https://github.com/selvalt7/modern-circular-gauge`,
      getEntitySuggestion: (hass, entityId) => {
        const domain = computeDomain(entityId);
        if (!NUMBER_ENTITY_DOMAINS.includes(domain)) return null;
        const stateObj = hass.states[entityId];
        if (!stateObj || isNaN(Number(stateObj.state))) return null;
  
        return {
          config: {
            type: 'custom:modern-circular-gauge-badge',
            entity: entityId
          }
        }
      }
  })
}
