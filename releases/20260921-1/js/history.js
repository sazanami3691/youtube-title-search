export const HISTORY_STORAGE_KEY = "youtubeTitleSearch.searchHistory.v1";
export const MAX_HISTORY_ITEMS = 10;

function normalizeHistoryTerm(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function readArray(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeArray(items, storage) {
  storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
  return items;
}

export function getSearchHistory(storage = globalThis.localStorage) {
  return readArray(storage).slice(0, MAX_HISTORY_ITEMS);
}

export function addSearchHistory(value, storage = globalThis.localStorage) {
  const term = normalizeHistoryTerm(value);
  if (!term) {
    return getSearchHistory(storage);
  }
  const comparison = term.toLocaleLowerCase("ja-JP");
  const remaining = readArray(storage).filter(
    (item) => normalizeHistoryTerm(item).toLocaleLowerCase("ja-JP") !== comparison
  );
  return writeArray([term, ...remaining].slice(0, MAX_HISTORY_ITEMS), storage);
}

export function removeSearchHistory(value, storage = globalThis.localStorage) {
  const comparison = normalizeHistoryTerm(value).toLocaleLowerCase("ja-JP");
  return writeArray(
    readArray(storage).filter(
      (item) => normalizeHistoryTerm(item).toLocaleLowerCase("ja-JP") !== comparison
    ),
    storage
  );
}

export function clearSearchHistory(storage = globalThis.localStorage) {
  storage.removeItem(HISTORY_STORAGE_KEY);
  return [];
}
