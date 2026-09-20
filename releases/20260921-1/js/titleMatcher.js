export function normalizeSearchText(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

export function normalizeForComparison(value) {
  return normalizeSearchText(value).toLocaleLowerCase("ja-JP");
}

export function parseKeywords(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const unique = new Set();
  for (const part of normalized.split(/\s+/u)) {
    const keyword = normalizeForComparison(part);
    if (keyword) {
      unique.add(keyword);
    }
  }
  return [...unique];
}

export function titleMatchesKeywords(title, keywordsOrInput) {
  const keywords = Array.isArray(keywordsOrInput)
    ? keywordsOrInput
    : parseKeywords(keywordsOrInput);
  if (keywords.length === 0) {
    return false;
  }
  const normalizedTitle = normalizeForComparison(title);
  return keywords.every((keyword) => normalizedTitle.includes(keyword));
}
