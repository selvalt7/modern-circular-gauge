import { HassEntity } from "home-assistant-js-websocket";
import { HomeAssistant } from "../ha/types";

export default function getEntityPictureUrl(hass: HomeAssistant, entity: HassEntity): string | undefined {
  if (!hass || !entity || !entity.attributes) {
    return undefined;
  }
  
  const entityPicture =
    entity.attributes.entity_picture_local ||
    entity.attributes.entity_picture;

  if (!entityPicture) return undefined;

  let imageUrl = hass.hassUrl(entityPicture);

  return imageUrl;
}