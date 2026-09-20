export const API_KEY_STORAGE_KEY = "youtubeTitleSearch.apiKey.v1";

function resolveStorage(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    throw new TypeError("Storage is required.");
  }
  return storage;
}

export function getApiKey(storage = globalThis.localStorage) {
  return resolveStorage(storage).getItem(API_KEY_STORAGE_KEY)?.trim() ?? "";
}

export function saveApiKey(apiKey, storage = globalThis.localStorage) {
  const value = String(apiKey ?? "").trim();
  if (!value) {
    throw new TypeError("API key must not be empty.");
  }
  resolveStorage(storage).setItem(API_KEY_STORAGE_KEY, value);
}

export function deleteApiKey(storage = globalThis.localStorage) {
  resolveStorage(storage).removeItem(API_KEY_STORAGE_KEY);
}

export function hasApiKey(storage = globalThis.localStorage) {
  return getApiKey(storage).length > 0;
}
