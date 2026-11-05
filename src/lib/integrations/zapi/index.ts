/**
 * Único ponto de saída HTTP para a Z-API.
 */
export { ZapiApiError, zapiFetch, type ZapiCredentials } from "./client";
export {
  clearReceivedWebhook,
  getDeviceInfo,
  getInstanceStatus,
  sendText,
  setReceivedWebhook,
  type ZapiDevice,
  type ZapiStatus,
} from "./instance";
