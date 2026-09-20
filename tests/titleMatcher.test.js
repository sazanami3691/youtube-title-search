import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchText,
  parseKeywords,
  titleMatchesKeywords
} from "../releases/20260921-1/js/titleMatcher.js";

test("単一キーワードを部分一致で判定する", () => {
  assert.equal(titleMatchesKeywords("RPGツクールMZの使い方", "ツクール"), true);
});

test("複数キーワードをAND判定し、順番が異なっても一致する", () => {
  assert.equal(titleMatchesKeywords("ツクールMZでRPGを作ってみる", "RPG ツクール"), true);
});

test("キーワードが1つ不足するタイトルを除外する", () => {
  assert.equal(titleMatchesKeywords("RPGの作り方", "RPG ツクール"), false);
});

test("半角空白、全角空白、タブ、連続空白で分割する", () => {
  assert.deepEqual(parseKeywords("RPG　　ツクール\tMZ"), ["rpg", "ツクール", "mz"]);
});

test("英字の大文字小文字を区別しない", () => {
  assert.equal(titleMatchesKeywords("Beginner rPg Guide", "RPG"), true);
});

test("NFKC正規化で全角英数字と互換文字を揃える", () => {
  assert.equal(titleMatchesKeywords("RPG MZ IV", "ＲＰＧ Ⅳ"), true);
});

test("入力前後の空白を除去する", () => {
  assert.equal(normalizeSearchText("  RPG ツクール　"), "RPG ツクール");
});

test("重複キーワードを大文字小文字を無視してまとめる", () => {
  assert.deepEqual(parseKeywords("RPG rpg ＲＰＧ ツクール"), ["rpg", "ツクール"]);
});

test("空欄と空白だけはキーワードを返さず一致しない", () => {
  assert.deepEqual(parseKeywords(" \t　"), []);
  assert.equal(titleMatchesKeywords("何らかのタイトル", "   "), false);
});

test("空白なしの入力全体を1キーワードとして扱う", () => {
  assert.deepEqual(parseKeywords("RPGツクール"), ["rpgツクール"]);
  assert.equal(titleMatchesKeywords("RPGでツクールを解説", "RPGツクール"), false);
});
