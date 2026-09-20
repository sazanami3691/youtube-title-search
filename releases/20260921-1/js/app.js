import { addSearchHistory, clearSearchHistory, getSearchHistory, removeSearchHistory } from "./history.js";
import { SearchManager } from "./searchManager.js";
import { deleteApiKey, getApiKey, hasApiKey, saveApiKey } from "./settings.js";
import { registerServiceWorker, updateApp } from "./pwaUpdate.js";
import { getApiErrorMessage, YouTubeApiClient } from "./youtubeApi.js";

const apiClient = new YouTubeApiClient();
const searchManager = new SearchManager({ apiClient });

const elements = {
  appUpdateButton: document.querySelector("#app-update-button"),
  apiSettingsButton: document.querySelector("#api-settings-button"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  searchButton: document.querySelector("#search-button"),
  searchProgress: document.querySelector("#search-progress"),
  statusCounts: document.querySelector("#status-counts"),
  statusMessage: document.querySelector("#status-message"),
  results: document.querySelector("#results"),
  loadMoreButton: document.querySelector("#load-more-button"),
  historyList: document.querySelector("#history-list"),
  clearHistoryButton: document.querySelector("#clear-history-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsPanel: document.querySelector("#settings-panel"),
  settingsCloseButton: document.querySelector("#settings-close-button"),
  keyForm: document.querySelector("#key-form"),
  apiKeyInput: document.querySelector("#api-key-input"),
  toggleKeyButton: document.querySelector("#toggle-key-button"),
  saveKeyButton: document.querySelector("#save-key-button"),
  changeKeyButton: document.querySelector("#change-key-button"),
  deleteKeyButton: document.querySelector("#delete-key-button"),
  keyFormFields: document.querySelector("#key-form-fields"),
  keyStatus: document.querySelector("#key-status"),
  keyMessage: document.querySelector("#key-message"),
  updateStatus: document.querySelector("#update-status")
};

function setMessage(type, title, action = "", detail = "") {
  elements.statusMessage.dataset.type = type;
  elements.statusMessage.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = title;
  elements.statusMessage.append(heading);
  if (action) {
    const paragraph = document.createElement("span");
    paragraph.textContent = action;
    elements.statusMessage.append(paragraph);
  }
  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    elements.statusMessage.append(small);
  }
  elements.statusMessage.hidden = false;
}

function clearMessage() {
  elements.statusMessage.hidden = true;
  elements.statusMessage.replaceChildren();
  delete elements.statusMessage.dataset.type;
}

function setLoading(isLoading) {
  elements.searchButton.disabled = isLoading;
  elements.loadMoreButton.disabled = isLoading;
  elements.searchProgress.hidden = !isLoading;
  document.body.setAttribute("aria-busy", String(isLoading));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "投稿日不明";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function createYouTubeLink(url, className, label) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer external";
  link.className = className;
  if (label) {
    link.setAttribute("aria-label", label);
  }
  return link;
}

function createResultCard(video) {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
  const article = document.createElement("article");
  article.className = "result-card";

  const overlay = createYouTubeLink(url, "result-card__overlay", `${video.title} をYouTubeで開く`);
  article.append(overlay);

  const thumbnailLink = createYouTubeLink(url, "result-card__thumbnail-link", `${video.title} の動画を開く`);
  const image = document.createElement("img");
  image.className = "result-card__thumbnail";
  image.src = video.thumbnailUrl || "./releases/20260921-1/icons/app-icon.svg";
  image.alt = "";
  image.loading = "lazy";
  image.referrerPolicy = "strict-origin-when-cross-origin";
  thumbnailLink.append(image);
  article.append(thumbnailLink);

  const body = document.createElement("div");
  body.className = "result-card__body";
  const title = document.createElement("h2");
  title.className = "result-card__title";
  const titleLink = createYouTubeLink(url, "result-card__title-link", "");
  titleLink.textContent = video.title;
  title.append(titleLink);
  body.append(title);

  const meta = document.createElement("dl");
  meta.className = "result-card__meta";
  const channelTerm = document.createElement("dt");
  channelTerm.textContent = "チャンネル";
  const channelValue = document.createElement("dd");
  channelValue.textContent = video.channelTitle || "チャンネル名不明";
  const dateTerm = document.createElement("dt");
  dateTerm.textContent = "投稿日";
  const dateValue = document.createElement("dd");
  dateValue.textContent = formatDate(video.publishedAt);
  meta.append(channelTerm, channelValue, dateTerm, dateValue);
  body.append(meta);

  const openButton = createYouTubeLink(url, "button button--accent result-card__button", "");
  openButton.textContent = "YouTubeで開く";
  body.append(openButton);
  article.append(body);
  return article;
}

function renderSearchState() {
  const state = searchManager.snapshot();
  elements.statusCounts.textContent = state.query
    ? `API候補 ${state.checkedCount}件 / タイトル一致 ${state.displayedCount}件`
    : "まだ検索していません";
  elements.results.replaceChildren(...state.results.map(createResultCard));
  elements.loadMoreButton.hidden = !state.nextPageToken;
}

function renderHistory() {
  const history = getSearchHistory();
  elements.historyList.replaceChildren();
  elements.clearHistoryButton.disabled = history.length === 0;
  if (history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "検索履歴はまだありません。";
    elements.historyList.append(empty);
    return;
  }
  for (const term of history) {
    const item = document.createElement("li");
    item.className = "history-item";
    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.className = "history-term";
    useButton.textContent = term;
    useButton.addEventListener("click", () => {
      elements.searchInput.value = term;
      elements.searchInput.focus();
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "history-delete";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("aria-label", `検索履歴「${term}」を削除`);
    deleteButton.addEventListener("click", () => {
      removeSearchHistory(term);
      renderHistory();
    });
    item.append(useButton, deleteButton);
    elements.historyList.append(item);
  }
}

function renderKeyStatus() {
  const configured = hasApiKey();
  elements.keyStatus.textContent = configured ? "この端末にはAPIキーが保存されています。" : "APIキーは未設定です。";
  elements.changeKeyButton.hidden = !configured;
  elements.deleteKeyButton.hidden = !configured;
  elements.keyFormFields.hidden = configured;
}

function openSettings({ forceInput = false } = {}) {
  elements.apiKeyInput.value = "";
  elements.apiKeyInput.type = "password";
  elements.toggleKeyButton.textContent = "表示";
  elements.keyMessage.textContent = "";
  elements.settingsDialog.hidden = false;
  document.body.classList.add("modal-open");
  renderKeyStatus();
  if (forceInput || !hasApiKey()) {
    elements.keyFormFields.hidden = false;
    setTimeout(() => elements.apiKeyInput.focus(), 0);
  } else {
    setTimeout(() => elements.settingsCloseButton.focus(), 0);
  }
}

function closeSettings() {
  elements.settingsDialog.hidden = true;
  document.body.classList.remove("modal-open");
  elements.apiSettingsButton.focus();
}

async function executeSearch(loadMore = false) {
  clearMessage();
  const apiKey = getApiKey();
  if (!apiKey) {
    const message = getApiErrorMessage({ kind: "missingKey" });
    setMessage("error", message.title, message.action);
    openSettings({ forceInput: true });
    return;
  }

  setLoading(true);
  try {
    const outcome = loadMore
      ? await searchManager.loadMore(apiKey)
      : await searchManager.searchNew(elements.searchInput.value, apiKey);

    if (outcome.emptyQuery) {
      setMessage("guide", "検索語句を入力してください。", "空欄や空白だけでは検索を実行しません。");
      return;
    }
    if (outcome.noNextPage) {
      setMessage("guide", "次のページはありません。", "別の検索語句を試してください。");
      return;
    }
    if (!loadMore) {
      addSearchHistory(searchManager.query);
      renderHistory();
    }
    renderSearchState();
    const state = searchManager.snapshot();
    if (state.displayedCount === 0) {
      setMessage(
        "empty",
        "検索結果は取得できましたが、タイトル条件を満たす動画は0件です。",
        state.nextPageToken ? "「さらに読み込む」で次の候補も確認できます。" : "別のキーワードを試してください。"
      );
    } else {
      setMessage(
        "success",
        `${loadMore ? "候補を追加確認しました。" : "検索が完了しました。"}`,
        "表示結果はYouTube APIが返した候補内の一致であり、YouTube全体を完全に網羅するものではありません。"
      );
    }
  } catch (error) {
    renderSearchState();
    const message = getApiErrorMessage(error);
    setMessage("error", message.title, message.action, message.detail);
  } finally {
    setLoading(false);
  }
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void executeSearch(false);
});
elements.loadMoreButton.addEventListener("click", () => void executeSearch(true));
elements.clearHistoryButton.addEventListener("click", () => {
  clearSearchHistory();
  renderHistory();
});
elements.apiSettingsButton.addEventListener("click", () => openSettings());
elements.settingsCloseButton.addEventListener("click", closeSettings);
elements.settingsDialog.addEventListener("click", (event) => {
  if (event.target === elements.settingsDialog && hasApiKey()) {
    closeSettings();
  }
});
document.addEventListener("keydown", (event) => {
  if (elements.settingsDialog.hidden) {
    return;
  }
  if (event.key === "Escape" && hasApiKey()) {
    closeSettings();
    return;
  }
  if (event.key === "Tab") {
    const focusable = [...elements.settingsPanel.querySelectorAll("button:not([hidden]):not(:disabled), input:not([hidden]):not(:disabled)")]
      .filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      elements.settingsPanel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
elements.toggleKeyButton.addEventListener("click", () => {
  const visible = elements.apiKeyInput.type === "text";
  elements.apiKeyInput.type = visible ? "password" : "text";
  elements.toggleKeyButton.textContent = visible ? "表示" : "非表示";
});
elements.changeKeyButton.addEventListener("click", () => {
  elements.keyFormFields.hidden = false;
  elements.apiKeyInput.value = "";
  elements.apiKeyInput.focus();
});
elements.deleteKeyButton.addEventListener("click", () => {
  const confirmed = globalThis.confirm("この端末に保存したAPIキーだけを削除します。検索履歴は残ります。よろしいですか？");
  if (!confirmed) {
    return;
  }
  deleteApiKey();
  elements.keyMessage.textContent = "APIキーを削除しました。検索履歴は削除していません。";
  renderKeyStatus();
  setMessage("guide", "APIキーを削除しました。", "次に検索する前に、新しいAPIキーを設定してください。");
});
elements.keyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const candidate = elements.apiKeyInput.value.trim();
  if (!candidate) {
    elements.keyMessage.textContent = "APIキーを入力してください。";
    return;
  }
  elements.saveKeyButton.disabled = true;
  elements.keyMessage.textContent = "接続を確認しています。APIキー自体は画面やログへ表示しません…";
  try {
    await apiClient.validateApiKey(candidate);
    saveApiKey(candidate);
    elements.apiKeyInput.value = "";
    elements.keyMessage.textContent = "接続を確認し、この端末のブラウザへ保存しました。";
    renderKeyStatus();
    setTimeout(closeSettings, 500);
  } catch (error) {
    const message = getApiErrorMessage(error);
    elements.keyMessage.textContent = `${message.title} ${message.action} ${message.detail}`.trim();
  } finally {
    elements.saveKeyButton.disabled = false;
  }
});
elements.appUpdateButton.addEventListener("click", async () => {
  elements.appUpdateButton.disabled = true;
  await updateApp({
    onStatus: ({ message }) => {
      elements.updateStatus.textContent = message;
    }
  });
  elements.appUpdateButton.disabled = false;
});

renderHistory();
renderSearchState();
setLoading(false);
void registerServiceWorker().catch(() => {
  elements.updateStatus.textContent = "オフライン利用の準備に失敗しました。オンラインでは検索できます。";
});

if (!hasApiKey()) {
  const message = getApiErrorMessage({ kind: "missingKey" });
  setMessage("guide", message.title, message.action);
  openSettings({ forceInput: true });
}
