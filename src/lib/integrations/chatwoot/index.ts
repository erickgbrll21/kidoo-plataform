/**
 * Único ponto de saída HTTP para o Chatwoot.
 * O restante da aplicação deve importar daqui (ou de services/), nunca montar fetch próprio.
 */
export { CHATWOOT_TOKEN_HEADER, ChatwootApiError, chatwootFetch, platformToken } from "./client";
export * from "./accounts";
export * from "./agents";
export * from "./inboxes";
export * from "./contacts";
export * from "./conversations";
export * from "./messages";
export * from "./teams";
export * from "./webhooks";
export * from "./types";
