const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const QUOTA_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "dailyLimitExceededUnreg",
  "rateLimitExceeded",
  "rateLimitExceededUnreg",
  "userRateLimitExceeded",
  "servingLimitExceeded"
]);
const TEMPORARY_REASONS = new Set(["backendError", "backendNotConnected", "internalError"]);
const INVALID_KEY_REASONS = new Set(["keyInvalid", "apiKeyInvalid"]);
const REFERRER_REASONS = new Set(["ipRefererBlocked", "refererBlocked", "forbidden"]);

export class YouTubeApiError extends Error {
  constructor(kind, { status = 0, reason = "", cause } = {}) {
    super(kind, { cause });
    this.name = "YouTubeApiError";
    this.kind = kind;
    this.status = status;
    this.reason = reason;
  }
}

export function getDefaultFetch(scope = globalThis) {
  if (typeof scope.fetch !== "function") {
    throw new TypeError("fetch is required.");
  }
  return scope.fetch.bind(scope);
}

function createSearchUrl({ query, pageToken, maxResults }) {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("regionCode", "JP");
  url.searchParams.set("relevanceLanguage", "ja");
  url.searchParams.set("q", query);
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }
  return url;
}

function extractApiError(payload) {
  const first = Array.isArray(payload?.error?.errors) ? payload.error.errors[0] : null;
  return {
    reason: typeof first?.reason === "string" ? first.reason : "",
    message: typeof payload?.error?.message === "string" ? payload.error.message : ""
  };
}

export function classifyApiFailure({ status, reason = "", message = "" }) {
  const comparableMessage = message.toLocaleLowerCase("en-US");
  if (
    INVALID_KEY_REASONS.has(reason) ||
    comparableMessage.includes("api key not valid") ||
    comparableMessage.includes("invalid api key")
  ) {
    return "invalidKey";
  }
  if (reason === "accessNotConfigured" || comparableMessage.includes("has not been used in project")) {
    return "apiNotEnabled";
  }
  if (
    reason === "ipRefererBlocked" ||
    reason === "refererBlocked" ||
    comparableMessage.includes("requests from referer") ||
    comparableMessage.includes("referer restrictions")
  ) {
    return "referrerBlocked";
  }
  if (QUOTA_REASONS.has(reason)) {
    return "quotaExceeded";
  }
  if (TEMPORARY_REASONS.has(reason) || status >= 500) {
    return "temporaryFailure";
  }
  if (REFERRER_REASONS.has(reason) && status === 403) {
    return "referrerBlocked";
  }
  return "unexpectedResponse";
}

export function getApiErrorMessage(error) {
  const messages = {
    missingKey: {
      title: "APIキーが未設定です。",
      action: "APIキー設定を開き、自分のAPIキーを保存して接続確認してください。"
    },
    invalidKey: {
      title: "APIキーが無効です。",
      action: "入力したAPIキーが正しいか、削除・再発行されていないか確認してください。"
    },
    apiNotEnabled: {
      title: "YouTube Data API v3が有効になっていません。",
      action: "Google Cloudで、APIキーを作成したプロジェクトのYouTube Data API v3を有効にしてください。"
    },
    referrerBlocked: {
      title: "現在のURLはAPIキーのWebサイト制限で許可されていません。",
      action: "Google CloudのAPIキー設定で、現在のアプリURLが許可されているか確認してください。"
    },
    quotaExceeded: {
      title: "APIの利用上限に達しました。",
      action: "Google Cloudの割り当て使用量を確認し、上限が戻るまで時間を置いてから再度お試しください。"
    },
    networkFailure: {
      title: "インターネットへ接続できませんでした。",
      action: "通信状態を確認してから再度お試しください。"
    },
    temporaryFailure: {
      title: "YouTube API側で一時的な障害が発生しています。",
      action: "時間を置いてから再度お試しください。"
    },
    unexpectedResponse: {
      title: "YouTube APIから予期しない応答を受け取りました。",
      action: "時間を置いて再試行し、続く場合はアプリを更新してください。"
    }
  };
  const message = messages[error?.kind] ?? messages.unexpectedResponse;
  const detail = error?.status ? `（HTTP ${error.status}${error.reason ? ` / ${error.reason}` : ""}）` : "";
  return { ...message, detail };
}

function validateResponse(payload) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new YouTubeApiError("unexpectedResponse");
  }
  return {
    nextPageToken: typeof payload.nextPageToken === "string" ? payload.nextPageToken : null,
    items: payload.items.map((item) => ({
      videoId: typeof item?.id?.videoId === "string" ? item.id.videoId : "",
      title: typeof item?.snippet?.title === "string" ? item.snippet.title : "",
      channelTitle: typeof item?.snippet?.channelTitle === "string" ? item.snippet.channelTitle : "",
      publishedAt: typeof item?.snippet?.publishedAt === "string" ? item.snippet.publishedAt : "",
      thumbnailUrl:
        item?.snippet?.thumbnails?.medium?.url ??
        item?.snippet?.thumbnails?.high?.url ??
        item?.snippet?.thumbnails?.default?.url ??
        ""
    }))
  };
}

export class YouTubeApiClient {
  constructor({ fetchImpl } = {}) {
    this.fetchImpl = fetchImpl ?? getDefaultFetch();
  }

  async search({ apiKey, query, pageToken = null, maxResults = 50 }) {
    if (!String(apiKey ?? "").trim()) {
      throw new YouTubeApiError("missingKey");
    }
    const url = createSearchUrl({ query, pageToken, maxResults });
    let response;
    try {
      const fetchImpl = this.fetchImpl;
      response = await fetchImpl(url, {
        method: "GET",
        headers: { "X-Goog-Api-Key": String(apiKey).trim() }
      });
    } catch (cause) {
      throw new YouTubeApiError("networkFailure", { cause });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new YouTubeApiError("unexpectedResponse", { status: response.status, cause });
    }

    if (!response.ok) {
      const { reason, message } = extractApiError(payload);
      throw new YouTubeApiError(classifyApiFailure({ status: response.status, reason, message }), {
        status: response.status,
        reason
      });
    }
    return validateResponse(payload);
  }

  async validateApiKey(apiKey) {
    await this.search({ apiKey, query: "YouTube", maxResults: 1 });
    return true;
  }
}
