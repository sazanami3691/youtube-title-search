import { normalizeSearchText, parseKeywords, titleMatchesKeywords } from "./titleMatcher.js";
import { YouTubeApiError } from "./youtubeApi.js";

export class SearchManager {
  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.isLoading = false;
    this.resetState();
  }

  resetState() {
    this.query = "";
    this.keywords = [];
    this.nextPageToken = null;
    this.seenVideoIds = new Set();
    this.results = [];
    this.checkedCount = 0;
  }

  snapshot() {
    return {
      query: this.query,
      keywords: [...this.keywords],
      nextPageToken: this.nextPageToken,
      results: [...this.results],
      checkedCount: this.checkedCount,
      displayedCount: this.results.length,
      isLoading: this.isLoading
    };
  }

  async searchNew(input, apiKey) {
    if (this.isLoading) {
      return { ignoredBusy: true, state: this.snapshot() };
    }
    const query = normalizeSearchText(input);
    const keywords = parseKeywords(query);
    if (keywords.length === 0) {
      return { emptyQuery: true, state: this.snapshot() };
    }
    if (!String(apiKey ?? "").trim()) {
      throw new YouTubeApiError("missingKey");
    }

    this.resetState();
    this.query = query;
    this.keywords = keywords;
    return this.#fetchPage(apiKey, null);
  }

  async loadMore(apiKey) {
    if (this.isLoading) {
      return { ignoredBusy: true, state: this.snapshot() };
    }
    if (!this.nextPageToken) {
      return { noNextPage: true, state: this.snapshot() };
    }
    return this.#fetchPage(apiKey, this.nextPageToken);
  }

  async #fetchPage(apiKey, pageToken) {
    this.isLoading = true;
    try {
      const page = await this.apiClient.search({
        apiKey,
        query: this.query,
        pageToken,
        maxResults: 50
      });
      this.checkedCount += page.items.length;
      for (const item of page.items) {
        if (!item.videoId || this.seenVideoIds.has(item.videoId)) {
          continue;
        }
        this.seenVideoIds.add(item.videoId);
        if (titleMatchesKeywords(item.title, this.keywords)) {
          this.results.push(item);
        }
      }
      this.nextPageToken = page.nextPageToken;
    } finally {
      this.isLoading = false;
    }
    return { appended: true, state: this.snapshot() };
  }
}
