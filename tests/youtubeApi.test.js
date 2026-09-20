import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyApiFailure,
  getApiErrorMessage,
  getDefaultFetch,
  YouTubeApiClient
} from "../releases/20260921-1/js/youtubeApi.js";

function response(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, async json() { return payload; } };
}

test("search.listへ指定パラメータを送り、APIキーをURLへ含めない", async () => {
  let captured;
  const client = new YouTubeApiClient({
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ items: [], nextPageToken: "next" });
    }
  });
  const result = await client.search({ apiKey: "test-only-key", query: "RPG ツクール" });
  assert.equal(captured.url.searchParams.get("part"), "snippet");
  assert.equal(captured.url.searchParams.get("type"), "video");
  assert.equal(captured.url.searchParams.get("maxResults"), "50");
  assert.equal(captured.url.searchParams.get("regionCode"), "JP");
  assert.equal(captured.url.searchParams.get("relevanceLanguage"), "ja");
  assert.equal(captured.url.searchParams.get("q"), "RPG ツクール");
  assert.equal(captured.url.searchParams.has("key"), false);
  assert.equal(captured.options.headers["X-Goog-Api-Key"], "test-only-key");
  assert.equal(result.nextPageToken, "next");
});

test("次ページトークンをpageTokenとして送る", async () => {
  let capturedUrl;
  const client = new YouTubeApiClient({
    fetchImpl: async (url) => {
      capturedUrl = url;
      return response({ items: [] });
    }
  });
  await client.search({ apiKey: "test-only-key", query: "RPG", pageToken: "page-2" });
  assert.equal(capturedUrl.searchParams.get("pageToken"), "page-2");
});

test("ブラウザ標準fetchをglobalThis相当へbindする", async () => {
  const scope = {
    fetch() {
      assert.equal(this, scope);
      return "bound";
    }
  };
  const boundFetch = getDefaultFetch(scope);
  assert.equal(boundFetch(), "bound");
});

test("注入したmock fetchへglobalThis bindを強制しない", async () => {
  let receiver;
  const mockFetch = async function () {
    "use strict";
    receiver = this;
    return response({ items: [] });
  };
  const client = new YouTubeApiClient({ fetchImpl: mockFetch });
  await client.search({ apiKey: "test-only-key", query: "RPG" });
  assert.equal(receiver, undefined);
});

test("代表的なAPIエラー理由を初心者向け分類へ変換する", () => {
  assert.equal(classifyApiFailure({ status: 400, reason: "keyInvalid" }), "invalidKey");
  assert.equal(classifyApiFailure({ status: 403, reason: "accessNotConfigured" }), "apiNotEnabled");
  assert.equal(classifyApiFailure({ status: 403, reason: "ipRefererBlocked" }), "referrerBlocked");
  assert.equal(classifyApiFailure({ status: 403, reason: "quotaExceeded" }), "quotaExceeded");
  assert.equal(classifyApiFailure({ status: 503, reason: "backendError" }), "temporaryFailure");
});

test("HTTPステータスと理由を保持し、APIレスポンス全文は例外へ入れない", async () => {
  const client = new YouTubeApiClient({
    fetchImpl: async () => response({
      error: { message: "Quota exceeded", errors: [{ reason: "quotaExceeded" }] },
      secretLikeField: "must-not-be-copied"
    }, { ok: false, status: 403 })
  });
  await assert.rejects(
    () => client.search({ apiKey: "test-only-key", query: "RPG" }),
    (error) => {
      assert.equal(error.kind, "quotaExceeded");
      assert.equal(error.status, 403);
      assert.equal(error.reason, "quotaExceeded");
      assert.equal(JSON.stringify(error).includes("must-not-be-copied"), false);
      return true;
    }
  );
});

test("ネットワーク失敗と予期しないレスポンスを区別する", async () => {
  const networkClient = new YouTubeApiClient({ fetchImpl: async () => { throw new TypeError("offline"); } });
  await assert.rejects(() => networkClient.search({ apiKey: "test-only-key", query: "RPG" }), { kind: "networkFailure" });

  const malformedClient = new YouTubeApiClient({ fetchImpl: async () => response({ unexpected: true }) });
  await assert.rejects(() => malformedClient.search({ apiKey: "test-only-key", query: "RPG" }), { kind: "unexpectedResponse" });
});

test("日本語エラー文に次の確認内容を含める", () => {
  const invalid = getApiErrorMessage({ kind: "invalidKey", status: 400, reason: "keyInvalid" });
  assert.match(invalid.title, /APIキーが無効/);
  assert.match(invalid.action, /確認/);
  assert.match(invalid.detail, /HTTP 400/);
  const disabled = getApiErrorMessage({ kind: "apiNotEnabled" });
  assert.match(disabled.action, /YouTube Data API v3を有効/);
});

test("接続確認だけは候補1件で呼び出す", async () => {
  let maxResults;
  const client = new YouTubeApiClient({
    fetchImpl: async (url) => {
      maxResults = url.searchParams.get("maxResults");
      return response({ items: [] });
    }
  });
  await client.validateApiKey("test-only-key");
  assert.equal(maxResults, "1");
});
