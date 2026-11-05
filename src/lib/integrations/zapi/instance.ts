import "server-only";
import { zapiFetch, type ZapiCredentials } from "./client";

export type ZapiStatus = {
  connected?: boolean;
  error?: string;
  smartphoneConnected?: boolean;
};

export type ZapiDevice = {
  phone?: string;
  imgUrl?: string;
  name?: string;
  device?: { name?: string };
};

export async function getInstanceStatus(creds: ZapiCredentials) {
  return zapiFetch<ZapiStatus>(creds, "status");
}

export async function getDeviceInfo(creds: ZapiCredentials) {
  return zapiFetch<ZapiDevice>(creds, "device");
}

/** Aponta o webhook "Ao receber" para a URL HTTPS da KIDOO. */
export async function setReceivedWebhook(creds: ZapiCredentials, url: string) {
  return zapiFetch<{ value?: boolean }>(creds, "update-webhook-received", {
    method: "PUT",
    body: { value: url },
  });
}

export async function clearReceivedWebhook(creds: ZapiCredentials) {
  return zapiFetch<{ value?: boolean }>(creds, "update-webhook-received", {
    method: "PUT",
    body: { value: "" },
  });
}

export async function sendText(
  creds: ZapiCredentials,
  input: { phone: string; message: string },
) {
  return zapiFetch<{ zaapId?: string; messageId?: string }>(creds, "send-text", {
    method: "POST",
    body: { phone: input.phone, message: input.message },
  });
}
