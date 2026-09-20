import test from "node:test";
import assert from "node:assert/strict";
import { updateApp } from "../releases/20260921-1/js/pwaUpdate.js";

function serviceWorkerMock(registration) {
  const listeners = new Map();
  return {
    controller: {},
    async getRegistration() { return registration; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); }
  };
}

test("待機中Service Workerへ切替を依頼しcontrollerchange後だけ再読込する", async () => {
  let message;
  let reloadCount = 0;
  const waiting = { postMessage(value) { message = value; } };
  const registration = { waiting, installing: null, async update() {} };
  const serviceWorker = serviceWorkerMock(registration);
  const result = await updateApp({ serviceWorker, reload: () => { reloadCount += 1; } });
  assert.equal(result, "activating");
  assert.deepEqual(message, { type: "SKIP_WAITING" });
  assert.equal(reloadCount, 0);
  serviceWorker.dispatch("controllerchange");
  assert.equal(reloadCount, 1);
});

test("更新がない場合は再読込せず最新版と通知する", async () => {
  let reloadCount = 0;
  const states = [];
  const registration = { waiting: null, installing: null, async update() {} };
  const serviceWorker = serviceWorkerMock(registration);
  const result = await updateApp({
    serviceWorker,
    reload: () => { reloadCount += 1; },
    onStatus: ({ state }) => states.push(state)
  });
  assert.equal(result, "current");
  assert.equal(reloadCount, 0);
  assert.deepEqual(states, ["checking", "current"]);
});

test("更新確認失敗時は再読込せず現在版を維持する案内を返す", async () => {
  let reloadCount = 0;
  let finalMessage = "";
  const registration = { waiting: null, installing: null, async update() { throw new Error("offline"); } };
  const result = await updateApp({
    serviceWorker: serviceWorkerMock(registration),
    reload: () => { reloadCount += 1; },
    onStatus: ({ message }) => { finalMessage = message; }
  });
  assert.equal(result, "failed");
  assert.equal(reloadCount, 0);
  assert.match(finalMessage, /現在の正常な版/);
});
