import test from "node:test";
import assert from "node:assert/strict";
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  HISTORY_STORAGE_KEY,
  removeSearchHistory
} from "../releases/20260921-1/js/history.js";
import {
  API_KEY_STORAGE_KEY,
  deleteApiKey,
  getApiKey,
  saveApiKey
} from "../releases/20260921-1/js/settings.js";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

test("検索履歴を最大10件に制限する", () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 12; index += 1) {
    addSearchHistory(`検索 ${index}`, storage);
  }
  const history = getSearchHistory(storage);
  assert.equal(history.length, 10);
  assert.equal(history[0], "検索 11");
  assert.equal(history.at(-1), "検索 2");
});

test("同じ検索語句は重複せず再使用時に先頭へ移動する", () => {
  const storage = new MemoryStorage();
  addSearchHistory("RPG", storage);
  addSearchHistory("ツクール", storage);
  addSearchHistory("ｒｐｇ", storage);
  assert.deepEqual(getSearchHistory(storage), ["rpg", "ツクール"]);
});

test("履歴を個別削除・全削除できる", () => {
  const storage = new MemoryStorage();
  addSearchHistory("RPG", storage);
  addSearchHistory("MZ", storage);
  removeSearchHistory("RPG", storage);
  assert.deepEqual(getSearchHistory(storage), ["MZ"]);
  clearSearchHistory(storage);
  assert.deepEqual(getSearchHistory(storage), []);
});

test("APIキー削除で検索履歴が消えない", () => {
  const storage = new MemoryStorage();
  saveApiKey("test-only-key", storage);
  addSearchHistory("RPG ツクール", storage);
  deleteApiKey(storage);
  assert.equal(getApiKey(storage), "");
  assert.deepEqual(getSearchHistory(storage), ["RPG ツクール"]);
});

test("APIキーと検索履歴は異なる保存キーを使う", () => {
  assert.notEqual(API_KEY_STORAGE_KEY, HISTORY_STORAGE_KEY);
});

test("壊れた履歴データは空配列として安全に扱う", () => {
  const storage = new MemoryStorage();
  storage.setItem(HISTORY_STORAGE_KEY, "not-json");
  assert.deepEqual(getSearchHistory(storage), []);
});
