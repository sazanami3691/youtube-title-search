function emit(onStatus, state, message) {
  onStatus?.({ state, message });
}

function waitForState(worker, expectedState, timeoutMs = 20000) {
  if (!worker) {
    return Promise.resolve(false);
  }
  if (worker.state === expectedState) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(false), timeoutMs);
    worker.addEventListener("statechange", () => {
      if (worker.state === expectedState) {
        clearTimeout(timeoutId);
        resolve(true);
      } else if (worker.state === "redundant") {
        clearTimeout(timeoutId);
        resolve(false);
      }
    });
  });
}

export async function registerServiceWorker(serviceWorker = globalThis.navigator?.serviceWorker) {
  if (!serviceWorker) {
    return null;
  }
  return serviceWorker.register("./service-worker.js", { scope: "./" });
}

export async function updateApp({
  serviceWorker = globalThis.navigator?.serviceWorker,
  onStatus,
  reload = () => globalThis.location.reload()
} = {}) {
  if (!serviceWorker) {
    emit(onStatus, "unavailable", "このブラウザではアプリ更新機能を利用できません。");
    return "unavailable";
  }

  emit(onStatus, "checking", "更新を確認しています…");
  const registration = (await serviceWorker.getRegistration()) ?? (await registerServiceWorker(serviceWorker));
  if (!registration) {
    emit(onStatus, "failed", "更新機能を準備できませんでした。");
    return "failed";
  }

  let reloaded = false;
  const controllerChanged = () => {
    if (!reloaded) {
      reloaded = true;
      emit(onStatus, "ready", "更新が完了しました。新しい版を開きます…");
      reload();
    }
  };
  serviceWorker.addEventListener("controllerchange", controllerChanged, { once: true });

  try {
    await registration.update();
    let waiting = registration.waiting;
    if (!waiting && registration.installing) {
      emit(onStatus, "installing", "新しいアプリを安全に準備しています…");
      const installed = await waitForState(registration.installing, "installed");
      if (!installed) {
        throw new Error("Service worker installation did not complete.");
      }
      waiting = registration.waiting ?? registration.installing;
    }

    if (!waiting) {
      serviceWorker.removeEventListener?.("controllerchange", controllerChanged);
      emit(onStatus, "current", "現在のアプリは最新版です。");
      return "current";
    }

    emit(onStatus, "activating", "新しいアプリへ切り替えています…");
    waiting.postMessage({ type: "SKIP_WAITING" });
    return "activating";
  } catch {
    serviceWorker.removeEventListener?.("controllerchange", controllerChanged);
    emit(onStatus, "failed", "更新できませんでした。現在の正常な版をそのまま使用します。");
    return "failed";
  }
}
