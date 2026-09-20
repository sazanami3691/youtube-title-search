import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
const scopeUrl = "https://example.test/youtube-title-search/";

class MockRequest {
  constructor(url, options = {}) {
    this.url = new URL(url, scopeUrl).href;
    this.method = options.method ?? "GET";
    this.mode = options.mode ?? "same-origin";
  }
}

function responseFor(url) {
  return { url, clone() { return responseFor(url); } };
}

function createEnvironment({ failAddAll = false } = {}) {
  const handlers = new Map();
  const stores = new Map([["youtube-title-search-shell-old", new Map([["old", responseFor("old")]])]]);
  const normalize = (request) => request instanceof MockRequest ? request.url : new URL(request, scopeUrl).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) {
          if (failAddAll) throw new Error("fetch failed");
          for (const request of requests) store.set(normalize(request), responseFor(normalize(request)));
        },
        async match(request) { return store.get(normalize(request)); },
        async put(request, response) { store.set(normalize(request), response); }
      };
    },
    async delete(name) { return stores.delete(name); },
    async keys() { return [...stores.keys()]; }
  };
  let claimCount = 0;
  let skipCount = 0;
  const self = {
    location: new URL(scopeUrl),
    registration: { scope: scopeUrl },
    clients: { async claim() { claimCount += 1; } },
    async skipWaiting() { skipCount += 1; },
    addEventListener(type, handler) { handlers.set(type, handler); }
  };
  const context = {
    self,
    caches,
    Request: MockRequest,
    URL,
    Promise,
    Set,
    Error,
    fetch: async (request) => responseFor(normalize(request))
  };
  vm.runInNewContext(source, context, { filename: "service-worker.js" });
  return { handlers, stores, get claimCount() { return claimCount; }, get skipCount() { return skipCount; } };
}

async function runWaitUntil(handler, event = {}) {
  let promise;
  handler({ ...event, waitUntil(value) { promise = value; } });
  return promise;
}

test("新版アプリシェルの全取得成功後にだけ完成キャッシュを作る", async () => {
  const env = createEnvironment();
  await runWaitUntil(env.handlers.get("install"));
  const current = env.stores.get("youtube-title-search-shell-20260921-1");
  assert.ok(current);
  assert.equal(current.size, 14);
  assert.equal(env.stores.has("youtube-title-search-shell-20260921-1-staging"), false);
  assert.equal(env.stores.has("youtube-title-search-shell-old"), true);
});

test("更新途中の取得失敗で旧キャッシュを壊さない", async () => {
  const env = createEnvironment({ failAddAll: true });
  await assert.rejects(() => runWaitUntil(env.handlers.get("install")), /fetch failed/);
  assert.equal(env.stores.has("youtube-title-search-shell-old"), true);
  assert.equal(env.stores.has("youtube-title-search-shell-20260921-1"), false);
  assert.equal(env.stores.has("youtube-title-search-shell-20260921-1-staging"), false);
});

test("同じリリースの正常キャッシュも取得失敗時に維持する", async () => {
  const env = createEnvironment({ failAddAll: true });
  const current = new Map([["sentinel", { clone() { return this; } }]]);
  env.stores.set("youtube-title-search-shell-20260921-1", current);
  await assert.rejects(() => runWaitUntil(env.handlers.get("install")), /fetch failed/);
  assert.equal(env.stores.get("youtube-title-search-shell-20260921-1"), current);
  assert.equal(env.stores.get("youtube-title-search-shell-20260921-1").has("sentinel"), true);
});

test("完成キャッシュを確認してから旧キャッシュを削除しclients.claimする", async () => {
  const env = createEnvironment();
  await runWaitUntil(env.handlers.get("install"));
  await runWaitUntil(env.handlers.get("activate"));
  assert.equal(env.stores.has("youtube-title-search-shell-old"), false);
  assert.equal(env.stores.has("youtube-title-search-shell-20260921-1"), true);
  assert.equal(env.claimCount, 1);
});

test("明示メッセージを受け取った場合だけskipWaitingする", async () => {
  const env = createEnvironment();
  env.handlers.get("message")({ data: { type: "OTHER" } });
  assert.equal(env.skipCount, 0);
  env.handlers.get("message")({ data: { type: "SKIP_WAITING" } });
  await Promise.resolve();
  assert.equal(env.skipCount, 1);
});

test("外部APIとサムネイルのGETをService Workerで処理しない", () => {
  const env = createEnvironment();
  for (const url of [
    "https://www.googleapis.com/youtube/v3/search",
    "https://i.ytimg.com/vi/example/mqdefault.jpg"
  ]) {
    let handled = false;
    env.handlers.get("fetch")({
      request: new MockRequest(url),
      respondWith() { handled = true; }
    });
    assert.equal(handled, false);
  }
});
