import test from "node:test";
import assert from "node:assert/strict";
import { SearchManager } from "../releases/20260921-1/js/searchManager.js";

function video(videoId, title) {
  return { videoId, title, channelTitle: "channel", publishedAt: "2026-01-01T00:00:00Z", thumbnailUrl: "https://example.invalid/thumb.jpg" };
}

test("動画IDを重複表示せず、一致した結果だけを追加する", async () => {
  const apiClient = {
    async search() {
      return {
        nextPageToken: null,
        items: [video("one", "RPG ツクール"), video("one", "RPG ツクール"), video("two", "RPGだけ")]
      };
    }
  };
  const manager = new SearchManager({ apiClient });
  await manager.searchNew("RPG ツクール", "test-key");
  assert.equal(manager.snapshot().checkedCount, 3);
  assert.deepEqual(manager.snapshot().results.map((item) => item.videoId), ["one"]);
});

test("さらに読み込むで結果を追記し、取得済みIDを除外する", async () => {
  const calls = [];
  const apiClient = {
    async search(request) {
      calls.push(request);
      if (!request.pageToken) {
        return { nextPageToken: "page-2", items: [video("one", "RPG ツクール入門")] };
      }
      return {
        nextPageToken: null,
        items: [video("one", "RPG ツクール入門"), video("two", "ツクールでRPG制作")]
      };
    }
  };
  const manager = new SearchManager({ apiClient });
  await manager.searchNew("RPG ツクール", "test-key");
  await manager.loadMore("test-key");
  assert.equal(calls[1].pageToken, "page-2");
  assert.deepEqual(manager.snapshot().results.map((item) => item.videoId), ["one", "two"]);
  assert.equal(manager.snapshot().checkedCount, 3);
});

test("新しい検索で前回の結果、動画ID、ページトークン、件数を初期化する", async () => {
  let call = 0;
  const apiClient = {
    async search() {
      call += 1;
      return call === 1
        ? { nextPageToken: "old-token", items: [video("same", "RPG ツクール")] }
        : { nextPageToken: null, items: [video("same", "MZ 講座")] };
    }
  };
  const manager = new SearchManager({ apiClient });
  await manager.searchNew("RPG ツクール", "test-key");
  await manager.searchNew("MZ 講座", "test-key");
  const state = manager.snapshot();
  assert.equal(state.nextPageToken, null);
  assert.equal(state.checkedCount, 1);
  assert.equal(state.displayedCount, 1);
  assert.equal(state.results[0].videoId, "same");
});

test("通信中の連打を無視する", async () => {
  let release;
  let callCount = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const apiClient = {
    async search() {
      callCount += 1;
      await pending;
      return { nextPageToken: null, items: [] };
    }
  };
  const manager = new SearchManager({ apiClient });
  const first = manager.searchNew("RPG", "test-key");
  const second = await manager.searchNew("MZ", "test-key");
  assert.equal(second.ignoredBusy, true);
  assert.equal(callCount, 1);
  release();
  await first;
  assert.equal(manager.snapshot().isLoading, false);
});

test("APIキー未設定時は通信しない", async () => {
  let callCount = 0;
  const manager = new SearchManager({ apiClient: { async search() { callCount += 1; } } });
  await assert.rejects(() => manager.searchNew("RPG", ""), { kind: "missingKey" });
  assert.equal(callCount, 0);
});

test("空欄では通信せず現在の結果も変更しない", async () => {
  let callCount = 0;
  const manager = new SearchManager({ apiClient: { async search() { callCount += 1; } } });
  const outcome = await manager.searchNew("　 ", "test-key");
  assert.equal(outcome.emptyQuery, true);
  assert.equal(callCount, 0);
});

test("次ページがなければ通信せず案内状態を返す", async () => {
  let callCount = 0;
  const manager = new SearchManager({
    apiClient: {
      async search() {
        callCount += 1;
        return { nextPageToken: null, items: [] };
      }
    }
  });
  await manager.searchNew("RPG", "test-key");
  const outcome = await manager.loadMore("test-key");
  assert.equal(outcome.noNextPage, true);
  assert.equal(callCount, 1);
});
