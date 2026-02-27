const STORAGE_KEY = "stock_dashboard_cards_v1";
const MAX_HISTORY_POINTS = 36;
const STATE_ENDPOINT = "/api/state";
const REMOTE_SAVE_DEBOUNCE_MS = 350;
const HN_DEFAULT_LIMIT = 8;
const HN_MIN_LIMIT = 3;
const HN_MAX_LIMIT = 20;
const QUOTE_DEFAULT_TOPIC = "mixed";
const QUOTE_TOPICS = new Set(["mixed", "economics", "philosophy", "engineering"]);
const DEFAULT_CARD_VISUAL_SIZE = "standard";
const CARD_VISUAL_SIZES = new Set(["compact", "standard", "expanded"]);
const LONG_PRESS_MS = 380;
const LONG_PRESS_MOVE_TOLERANCE = 10;
const QUOTE_FALLBACK_LIBRARY = {
  economics: [
    {
      text: "价格是多方预期的交汇点，不是任何一方观点的胜利。",
      author: "Signal Notebook",
      source: "Economics Fragment",
    },
    {
      text: "当你无法判断方向时，先判断风险边界，收益往往是边界管理后的副产品。",
      author: "Signal Notebook",
      source: "Economics Fragment",
    },
  ],
  philosophy: [
    {
      text: "复杂世界中，最有效的进步常来自于持续修正，而不是一次性正确。",
      author: "Signal Notebook",
      source: "Philosophy Fragment",
    },
    {
      text: "思考的质量，取决于你能否同时容纳不确定性与行动需求。",
      author: "Signal Notebook",
      source: "Philosophy Fragment",
    },
  ],
  engineering: [
    {
      text: "可靠系统的核心不是永不出错，而是出错后仍能快速定位并恢复。",
      author: "Signal Notebook",
      source: "Engineering Fragment",
    },
    {
      text: "可维护性是性能的一部分，未来修改成本也应计入今天的设计。",
      author: "Signal Notebook",
      source: "Engineering Fragment",
    },
  ],
};

const MARKET_PROFILES = {
  CN: {
    label: "A股",
    timeZone: "Asia/Shanghai",
    sessions: [
      [9 * 60 + 30, 11 * 60 + 30],
      [13 * 60, 15 * 60],
    ],
  },
  HK: {
    label: "港股",
    timeZone: "Asia/Hong_Kong",
    sessions: [
      [9 * 60 + 30, 12 * 60],
      [13 * 60, 16 * 60],
    ],
  },
  US: {
    label: "美股",
    timeZone: "America/New_York",
    sessions: [[9 * 60 + 30, 16 * 60]],
  },
};

const WEEKDAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const STOCK_PERMISSION_KEYS = [
  "showPrice",
  "showChange",
  "showHighLow",
  "showVolume",
  "showTimestamp",
  "showPnL",
  "showChart",
  "showVolumeChart",
];

const HN_PERMISSION_KEYS = [
  "showHnScore",
  "showHnComments",
  "showHnAuthor",
  "showHnTime",
  "showHnDomain",
];

const QUOTE_PERMISSION_KEYS = [
  "showQuoteTopic",
  "showQuoteAuthor",
  "showQuoteSource",
  "showQuoteTimestamp",
];

const COMMON_PERMISSION_KEYS = ["allowManualRefresh", "allowEdit", "allowDelete", "autoRefresh"];

const PERMISSION_KEYS_BY_TYPE = {
  stock: [...STOCK_PERMISSION_KEYS, ...COMMON_PERMISSION_KEYS],
  hn: [...HN_PERMISSION_KEYS, ...COMMON_PERMISSION_KEYS],
  quote: [...QUOTE_PERMISSION_KEYS, ...COMMON_PERMISSION_KEYS],
};

const defaultPermissions = {
  showPrice: true,
  showChange: true,
  showHighLow: true,
  showVolume: true,
  showTimestamp: true,
  showPnL: true,
  showChart: true,
  showVolumeChart: true,
  showHnScore: true,
  showHnComments: true,
  showHnAuthor: true,
  showHnTime: true,
  showHnDomain: true,
  showQuoteTopic: true,
  showQuoteAuthor: true,
  showQuoteSource: true,
  showQuoteTimestamp: true,
  allowManualRefresh: true,
  allowEdit: true,
  allowDelete: true,
  autoRefresh: true,
};

const permissionLabels = {
  showPrice: "显示最新价",
  showChange: "显示涨跌",
  showHighLow: "显示当日高低",
  showVolume: "显示成交量",
  showTimestamp: "显示更新时间",
  showPnL: "显示盈亏比例",
  showChart: "显示行情曲线",
  showVolumeChart: "显示分时量图",
  showHnScore: "显示点赞分数",
  showHnComments: "显示评论数",
  showHnAuthor: "显示作者",
  showHnTime: "显示发布时间",
  showHnDomain: "显示来源域名",
  showQuoteTopic: "显示主题",
  showQuoteAuthor: "显示作者",
  showQuoteSource: "显示来源",
  showQuoteTimestamp: "显示更新时间",
  allowManualRefresh: "允许手动刷新",
  allowEdit: "允许编辑权限",
  allowDelete: "允许删除卡片",
  autoRefresh: "启用自动刷新",
};

const timeFormatterCache = {};

const state = {
  cards: [],
  refreshTimer: null,
  remoteSaveTimer: null,
  stockSuggestions: [],
  isReordering: false,
};

const refs = {
  grid: document.getElementById("cardGrid"),
  empty: document.getElementById("emptyState"),
  cardCount: document.getElementById("cardCount"),
  autoRefreshCount: document.getElementById("autoRefreshCount"),
  createCardBtn: document.getElementById("createCardBtn"),
  createDialog: document.getElementById("createDialog"),
  createForm: document.getElementById("createForm"),
  cardType: document.getElementById("cardType"),
  symbolInput: document.getElementById("symbolInput"),
  stockSuggestList: document.getElementById("stockSuggestList"),
  nameInput: document.getElementById("nameInput"),
  refreshInterval: document.getElementById("refreshInterval"),
  createCardVisualField: document.getElementById("createCardVisualField"),
  cardVisualSize: document.getElementById("cardVisualSize"),
  costInput: document.getElementById("costInput"),
  hnLimitInput: document.getElementById("hnLimitInput"),
  quoteTopicInput: document.getElementById("quoteTopicInput"),
  stockSymbolField: document.getElementById("stockSymbolField"),
  stockCostField: document.getElementById("stockCostField"),
  hnLimitField: document.getElementById("hnLimitField"),
  quoteTopicField: document.getElementById("quoteTopicField"),
  createPermissionContainer: document.getElementById("createPermissionContainer"),
  closeCreateDialog: document.getElementById("closeCreateDialog"),
  permissionDialog: document.getElementById("permissionDialog"),
  permissionForm: document.getElementById("permissionForm"),
  permissionCardId: document.getElementById("permissionCardId"),
  permissionContainer: document.getElementById("permissionContainer"),
  permissionRefreshInterval: document.getElementById("permissionRefreshInterval"),
  permissionCardVisualField: document.getElementById("permissionCardVisualField"),
  permissionCardVisualSize: document.getElementById("permissionCardVisualSize"),
  permissionCostField: document.getElementById("permissionCostField"),
  permissionCostInput: document.getElementById("permissionCostInput"),
  permissionHnLimitField: document.getElementById("permissionHnLimitField"),
  permissionHnLimitInput: document.getElementById("permissionHnLimitInput"),
  permissionQuoteTopicField: document.getElementById("permissionQuoteTopicField"),
  permissionQuoteTopicInput: document.getElementById("permissionQuoteTopicInput"),
  closePermissionDialog: document.getElementById("closePermissionDialog"),
  template: document.getElementById("cardTemplate"),
};

const dragState = {
  timer: null,
  activePointerId: null,
  pressedCardEl: null,
  pressedCardId: null,
  pointerStartX: 0,
  pointerStartY: 0,
  pointerOffsetX: 0,
  pointerOffsetY: 0,
  draggingEl: null,
  placeholderEl: null,
  isDragging: false,
  suppressClickUntil: 0,
};

async function init() {
  bindEvents();
  syncCreateFormByType(refs.cardType.value);
  await loadCards();
  render();
  startRefreshLoop();
}

function bindEvents() {
  const debouncedSuggest = debounce(async () => {
    await refreshStockSuggestions(refs.symbolInput.value.trim());
  }, 220);

  refs.createCardBtn.addEventListener("click", () => {
    syncCreateFormByType(refs.cardType.value);
    refs.createDialog.showModal();
  });

  refs.cardType.addEventListener("change", () => {
    syncCreateFormByType(refs.cardType.value);
  });

  refs.symbolInput.addEventListener("input", () => {
    if (refs.cardType.value !== "stock") return;
    void debouncedSuggest();
  });

  refs.symbolInput.addEventListener("change", () => {
    if (refs.cardType.value !== "stock") return;
    tryApplySuggestionMeta(refs.symbolInput.value.trim());
  });

  refs.closeCreateDialog.addEventListener("click", () => refs.createDialog.close());
  refs.closePermissionDialog.addEventListener("click", () => refs.permissionDialog.close());

  refs.createForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const type = refs.cardType.value;
    const refreshInterval = Number(refs.refreshInterval.value);
    const visualSize = type === "hn" ? parseCardVisualSize(refs.cardVisualSize.value) : DEFAULT_CARD_VISUAL_SIZE;
    const permissions = collectPermissions(refs.createForm, type);

    let card;
    if (type === "hn") {
      card = buildHnCard({
        title: refs.nameInput.value.trim(),
        refreshInterval,
        visualSize,
        permissions,
        hnLimit: parseHnLimit(refs.hnLimitInput.value),
      });
    } else if (type === "quote") {
      card = buildQuoteCard({
        title: refs.nameInput.value.trim(),
        refreshInterval,
        visualSize,
        permissions,
        quoteTopic: parseQuoteTopic(refs.quoteTopicInput.value),
      });
    } else {
      const rawInput = refs.symbolInput.value.trim();
      const resolved = await resolveStockIdentity(rawInput);
      if (!resolved) {
        refs.symbolInput.setCustomValidity("未找到对应股票，请输入更准确的代码或名称");
        refs.symbolInput.reportValidity();
        refs.symbolInput.setCustomValidity("");
        return;
      }

      if (!refs.nameInput.value.trim()) {
        refs.nameInput.value = resolved.name;
      }
      refs.symbolInput.value = resolved.code || rawInput;

      card = buildStockCard({
        symbol: resolved.code || rawInput,
        querySymbol: resolved.querySymbol || toYahooSymbol(rawInput),
        resolvedName: resolved.name,
        title: refs.nameInput.value.trim(),
        refreshInterval,
        visualSize,
        costPrice: parseOptionalNonNegative(refs.costInput.value),
        permissions,
      });
    }

    if (!card) return;

    state.cards.unshift(card);
    saveCards();
    render();

    refs.createDialog.close();
    refs.createForm.reset();
    refs.cardType.value = "stock";
    refs.cardVisualSize.value = DEFAULT_CARD_VISUAL_SIZE;
    refs.hnLimitInput.value = String(HN_DEFAULT_LIMIT);
    refs.quoteTopicInput.value = QUOTE_DEFAULT_TOPIC;
    clearStockSuggestions();
    syncCreateFormByType("stock");

    await refreshCard(card.id, true);
  });

  refs.permissionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const card = state.cards.find((item) => item.id === refs.permissionCardId.value);
    if (!card) return;

    card.permissions = collectPermissions(refs.permissionForm, card.type);
    card.refreshInterval = Number(refs.permissionRefreshInterval.value);
    if (card.type === "hn" || card.type === "quote") {
      card.visualSize = parseCardVisualSize(refs.permissionCardVisualSize.value);
    } else {
      card.visualSize = DEFAULT_CARD_VISUAL_SIZE;
    }

    if (card.type === "stock") {
      card.costPrice = parseOptionalNonNegative(refs.permissionCostInput.value);
    }

    if (card.type === "hn") {
      card.hnLimit = parseHnLimit(refs.permissionHnLimitInput.value);
    }

    if (card.type === "quote") {
      card.quoteTopic = parseQuoteTopic(refs.permissionQuoteTopicInput.value);
    }

    saveCards();
    render();
    refs.permissionDialog.close();
  });

  refs.grid.addEventListener("click", async (event) => {
    if (Date.now() < dragState.suppressClickUntil) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest("[data-action]");
    if (!button) return;

    const cardId = button.getAttribute("data-card-id");
    const action = button.getAttribute("data-action");
    if (!cardId || !action) return;

    if (action === "refresh") {
      await refreshCard(cardId, true);
      return;
    }

    if (action === "edit") {
      openPermissionDialog(cardId);
      return;
    }

    if (action === "delete") {
      state.cards = state.cards.filter((card) => card.id !== cardId);
      saveCards();
      render();
    }
  });

  setupCardLongPressDrag();
}

function syncCreateFormByType(type) {
  const isStock = type === "stock";
  const isHn = type === "hn";
  const isQuote = type === "quote";

  refs.stockSymbolField.classList.toggle("is-hidden", !isStock);
  refs.stockCostField.classList.toggle("is-hidden", !isStock);
  refs.createCardVisualField.classList.toggle("is-hidden", isStock);
  refs.hnLimitField.classList.toggle("is-hidden", !isHn);
  refs.quoteTopicField.classList.toggle("is-hidden", !isQuote);

  refs.symbolInput.required = isStock;
  if (!isStock) {
    refs.symbolInput.value = "";
    refs.costInput.value = "";
    clearStockSuggestions();
    const currentName = refs.nameInput.value.trim();
    if ((isHn && (!currentName || currentName === "思维片段")) || (isQuote && (!currentName || currentName === "Hacker News 热门"))) {
      refs.nameInput.value = isHn ? "Hacker News 热门" : "思维片段";
    }
    if (Number(refs.refreshInterval.value) < 30000) {
      refs.refreshInterval.value = "60000";
    }
  }

  if (isStock && (refs.nameInput.value.trim() === "Hacker News 热门" || refs.nameInput.value.trim() === "思维片段")) {
    refs.nameInput.value = "";
  }

  refs.cardVisualSize.value = DEFAULT_CARD_VISUAL_SIZE;
  renderPermissionInputs(refs.createPermissionContainer, type, null);
}

function renderPermissionInputs(container, type, selectedPermissions) {
  container.innerHTML = "<legend>权限开关</legend>";
  getPermissionKeys(type).forEach((key) => {
    const row = document.createElement("label");
    const checked =
      selectedPermissions && typeof selectedPermissions[key] === "boolean"
        ? selectedPermissions[key]
        : defaultPermissions[key];

    row.innerHTML = `<input type="checkbox" data-permission="${key}" ${checked ? "checked" : ""}> ${
      permissionLabels[key] || key
    }`;
    container.appendChild(row);
  });
}

function collectPermissions(form, type) {
  const permissions = { ...defaultPermissions };
  getPermissionKeys(type).forEach((key) => {
    const input = form.querySelector(`[data-permission="${key}"]`);
    if (input instanceof HTMLInputElement) {
      permissions[key] = input.checked;
    }
  });
  return permissions;
}

function getPermissionKeys(type) {
  return PERMISSION_KEYS_BY_TYPE[type] || PERMISSION_KEYS_BY_TYPE.stock;
}

function buildStockCard({
  symbol,
  querySymbol,
  resolvedName,
  title,
  refreshInterval,
  visualSize,
  costPrice,
  permissions,
}) {
  if (!symbol) return null;

  const normalizedQuerySymbol = querySymbol || toYahooSymbol(symbol);
  return {
    id: crypto.randomUUID(),
    type: "stock",
    symbol,
    querySymbol: normalizedQuerySymbol,
    name: title || resolvedName || symbol.toUpperCase(),
    refreshInterval,
    visualSize: DEFAULT_CARD_VISUAL_SIZE,
    costPrice,
    permissions,
    history: [],
    volumeHistory: [],
    prevCumulativeVolume: null,
    quote: null,
    status: "等待刷新",
    lastUpdatedAt: 0,
    isRefreshing: false,
  };
}

function buildHnCard({ title, refreshInterval, visualSize, permissions, hnLimit }) {
  return {
    id: crypto.randomUUID(),
    type: "hn",
    name: title || "Hacker News 热门",
    refreshInterval,
    visualSize,
    permissions,
    hnLimit,
    news: [],
    status: "等待刷新",
    lastUpdatedAt: 0,
    isRefreshing: false,
  };
}

function buildQuoteCard({ title, refreshInterval, visualSize, permissions, quoteTopic }) {
  return {
    id: crypto.randomUUID(),
    type: "quote",
    name: title || "思维片段",
    refreshInterval,
    visualSize,
    permissions,
    quoteTopic: parseQuoteTopic(quoteTopic),
    quoteItem: null,
    status: "等待刷新",
    lastUpdatedAt: 0,
    isRefreshing: false,
  };
}

function openPermissionDialog(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;

  refs.permissionCardId.value = card.id;
  refs.permissionRefreshInterval.value = String(card.refreshInterval);
  refs.permissionCardVisualField.classList.toggle("is-hidden", card.type === "stock");
  refs.permissionCardVisualSize.value = parseCardVisualSize(card.visualSize);

  const isStock = card.type === "stock";
  const isHn = card.type === "hn";
  const isQuote = card.type === "quote";
  refs.permissionCostField.classList.toggle("is-hidden", !isStock);
  refs.permissionHnLimitField.classList.toggle("is-hidden", !isHn);
  refs.permissionQuoteTopicField.classList.toggle("is-hidden", !isQuote);

  refs.permissionCostInput.value = isStock && card.costPrice != null ? card.costPrice.toFixed(4) : "";
  refs.permissionHnLimitInput.value = String(parseHnLimit(card.hnLimit));
  refs.permissionQuoteTopicInput.value = parseQuoteTopic(card.quoteTopic);

  renderPermissionInputs(refs.permissionContainer, card.type, card.permissions);
  refs.permissionDialog.showModal();
}

function startRefreshLoop() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);

  state.refreshTimer = setInterval(async () => {
    if (state.isReordering) return;

    const now = Date.now();
    const dueCards = state.cards.filter(
      (card) =>
        card.permissions.autoRefresh &&
        !card.isRefreshing &&
        now - card.lastUpdatedAt >= card.refreshInterval
    );

    if (!dueCards.length) return;

    const refreshTargets = [];
    let hasLocalUpdate = false;

    dueCards.forEach((card) => {
      if (card.type !== "stock") {
        refreshTargets.push(card);
        return;
      }

      const marketState = getMarketSessionState(card.querySymbol, now);
      if (marketState.isOpen) {
        refreshTargets.push(card);
        return;
      }

      const nextStatus = buildMarketClosedStatus(marketState.label);
      if (card.status !== nextStatus) {
        card.status = nextStatus;
        renderCard(card, { statusOnly: true });
        hasLocalUpdate = true;
      }
    });

    if (hasLocalUpdate) {
      saveCards();
      renderSummary();
    }

    if (refreshTargets.length) {
      await Promise.all(refreshTargets.map((card) => refreshCard(card.id, false)));
    }
  }, 1200);
}

async function refreshCard(cardId, manual = false) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;

  if (!manual && !card.permissions.autoRefresh) return;
  if (card.isRefreshing) return;

  if (card.type === "stock") {
    const marketState = getMarketSessionState(card.querySymbol, Date.now());
    if (!marketState.isOpen) {
      card.status = buildMarketClosedStatus(marketState.label);
      saveCards();
      renderCard(card, { statusOnly: true });
      return;
    }
  }

  card.isRefreshing = true;
  card.status = "刷新中...";
  renderCard(card, { statusOnly: true });

  try {
    if (card.type === "hn") {
      await refreshHnCardData(card);
    } else if (card.type === "quote") {
      await refreshQuoteCardData(card);
    } else {
      await refreshStockCardData(card);
    }
  } catch (error) {
    card.status = `刷新失败：${normalizeErrorMessage(error)}`;
  } finally {
    card.lastUpdatedAt = Date.now();
    card.isRefreshing = false;
    saveCards();
    renderCard(card);
    renderSummary();
  }
}

async function refreshStockCardData(card) {
  const quote = await fetchStockQuote(card.querySymbol);
  card.quote = quote;
  card.history.push(quote.price);
  appendVolumeDelta(card, quote.volume);

  if (card.history.length > MAX_HISTORY_POINTS) {
    card.history.splice(0, card.history.length - MAX_HISTORY_POINTS);
  }

  if (card.volumeHistory.length > MAX_HISTORY_POINTS) {
    card.volumeHistory.splice(0, card.volumeHistory.length - MAX_HISTORY_POINTS);
  }

  card.status = `已更新 ${formatTime(quote.timestamp)}`;
}

async function refreshHnCardData(card) {
  const stories = await fetchHnTopStories(card.hnLimit);
  card.news = stories;
  card.status = `已更新 ${formatTime(Date.now())}`;
}

async function refreshQuoteCardData(card) {
  const item = await fetchQuoteSnippet(card.quoteTopic);
  card.quoteItem = item;
  card.status = `已更新 ${formatTime(Date.now())}`;
}

async function fetchStockQuote(symbol) {
  const localErrors = [];
  const remoteErrors = [];

  if (isHttpOrigin()) {
    try {
      return await fetchLocalQuote(symbol);
    } catch (error) {
      localErrors.push(normalizeErrorMessage(error));
    }
  } else {
    localErrors.push("请用 node server.js 启动后访问 http://127.0.0.1:8000");
  }

  const endpoint = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const backup = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`;

  try {
    const quote = await fetchYahoo(endpoint);
    return convertYahooQuote(quote);
  } catch {
    remoteErrors.push("Yahoo 直连失败");
  }

  try {
    const quote = await fetchYahoo(backup);
    return convertYahooQuote(quote);
  } catch {
    remoteErrors.push("公共代理失败");
  }

  const reasons = [...localErrors, ...remoteErrors].filter(Boolean);
  throw new Error(reasons.length ? reasons.join("；") : "未获取到行情");
}

async function refreshStockSuggestions(query) {
  if (!query || refs.cardType.value !== "stock") {
    clearStockSuggestions();
    return;
  }

  const items = await fetchStockSuggestions(query, 10);
  state.stockSuggestions = items;
  renderStockSuggestions(items);
}

async function fetchStockSuggestions(query, limit = 10) {
  if (!isHttpOrigin()) return [];
  try {
    const response = await fetch(
      `/api/stock/search?q=${encodeURIComponent(query)}&limit=${Math.min(20, Math.max(3, limit))}`,
      { cache: "no-store" }
    );
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch {
    return [];
  }
}

function renderStockSuggestions(items) {
  refs.stockSuggestList.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code || "";
    option.label = `${item.name || ""} · ${item.querySymbol || item.code || ""}`;
    refs.stockSuggestList.appendChild(option);
  });
}

function clearStockSuggestions() {
  state.stockSuggestions = [];
  refs.stockSuggestList.innerHTML = "";
}

async function resolveStockIdentity(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return null;

  const lower = input.toLowerCase();
  const matched = state.stockSuggestions.find(
    (item) =>
      String(item.code || "").toLowerCase() === lower ||
      String(item.name || "").toLowerCase() === lower ||
      String(item.querySymbol || "").toLowerCase() === lower
  );
  if (matched) {
    return matched;
  }

  if (!isHttpOrigin()) {
    return {
      code: input.toUpperCase(),
      name: input.toUpperCase(),
      querySymbol: toYahooSymbol(input),
    };
  }

  const suggestions = await fetchStockSuggestions(input, 8);
  if (suggestions.length) {
    return pickBestStockSuggestion(input, suggestions);
  }

  const codeLike =
    /^\d{6}$/.test(input) ||
    /^\d{6}\.(SH|SS|SZ)$/i.test(input) ||
    /^(SH|SZ)\d{6}$/i.test(input) ||
    /^[A-Za-z]{1,5}$/.test(input);
  if (!codeLike) return null;

  return {
    code: input.toUpperCase(),
    name: input.toUpperCase(),
    querySymbol: toYahooSymbol(input),
  };
}

function tryApplySuggestionMeta(currentInput) {
  if (!currentInput) return;
  const lower = currentInput.toLowerCase();
  const matched = state.stockSuggestions.find(
    (item) =>
      String(item.code || "").toLowerCase() === lower ||
      String(item.name || "").toLowerCase() === lower ||
      String(item.querySymbol || "").toLowerCase() === lower
  );
  if (!matched) return;

  refs.symbolInput.value = matched.code || currentInput;
  if (!refs.nameInput.value.trim()) {
    refs.nameInput.value = matched.name || "";
  }
}

function pickBestStockSuggestion(input, suggestions) {
  const normalizedInput = input.trim().toLowerCase();
  const exact = suggestions.find((item) => {
    const code = String(item.code || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    const symbol = String(item.querySymbol || "").toLowerCase();
    return code === normalizedInput || name === normalizedInput || symbol === normalizedInput;
  });
  return exact || suggestions[0];
}

async function fetchLocalQuote(symbol) {
  let response;
  try {
    response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  } catch {
    throw new Error("本地代理不可用，请通过 node server.js 启动");
  }

  if (!response.ok) {
    let message = `本地代理错误 ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      // Keep generic message.
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (!data || data.price == null) {
    throw new Error("本地代理未返回有效行情");
  }
  return data;
}

async function fetchHnTopStories(limit) {
  const cappedLimit = parseHnLimit(limit);

  if (isHttpOrigin()) {
    try {
      const response = await fetch(`/api/hn/top?limit=${cappedLimit}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`本地 HN 代理错误 ${response.status}`);
      }
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      return items.map(normalizeHnStory).filter(Boolean);
    } catch {
      // Fallback to direct API.
    }
  }

  const topIds = await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json");
  if (!Array.isArray(topIds) || !topIds.length) {
    throw new Error("HN 热门列表为空");
  }

  const ids = topIds.slice(0, cappedLimit);
  const stories = await Promise.all(
    ids.map(async (id) => {
      try {
        const item = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return normalizeHnStory(item);
      } catch {
        return null;
      }
    })
  );

  const validStories = stories.filter(Boolean);
  if (!validStories.length) {
    throw new Error("未获取到 HN 热门新闻");
  }

  return validStories;
}

async function fetchQuoteSnippet(topic) {
  const normalizedTopic = parseQuoteTopic(topic);

  if (isHttpOrigin()) {
    try {
      const response = await fetch(
        `/api/quote/snippet?topic=${encodeURIComponent(normalizedTopic)}&count=1`,
        { cache: "no-store" }
      );
      if (response.ok) {
        const payload = await response.json();
        const item = Array.isArray(payload?.items) ? payload.items[0] : null;
        if (item && item.text) {
          return normalizeQuoteItem({ ...item, topic: item.topic || normalizedTopic });
        }
      }
    } catch {
      // Fallback below.
    }
  }

  const fallbackPool = getLocalQuotePool(normalizedTopic);
  const picked = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  return normalizeQuoteItem({ ...picked, topic: normalizedTopic, timestamp: Date.now() });
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`接口错误 ${response.status}`);
  }
  return response.json();
}

function normalizeHnStory(item) {
  if (!item || item.deleted || item.dead || !item.id || !item.title) {
    return null;
  }

  const fallbackUrl = `https://news.ycombinator.com/item?id=${item.id}`;
  return {
    id: item.id,
    title: String(item.title),
    url: item.url || fallbackUrl,
    by: item.by || "unknown",
    score: Number.isFinite(item.score) ? item.score : 0,
    descendants: Number.isFinite(item.descendants) ? item.descendants : 0,
    time: Number.isFinite(item.time) ? item.time * 1000 : Date.now(),
    domain: extractDomain(item.url),
  };
}

function extractDomain(url) {
  if (!url) return "news.ycombinator.com";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "news.ycombinator.com";
  }
}

function convertYahooQuote(quote) {
  const timestamp = quote.regularMarketTime ? quote.regularMarketTime * 1000 : Date.now();
  return {
    symbol: quote.symbol,
    price: quote.regularMarketPrice,
    prevClose: quote.regularMarketPreviousClose,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
    high: quote.regularMarketDayHigh,
    low: quote.regularMarketDayLow,
    volume: quote.regularMarketVolume,
    currency: quote.currency || "",
    timestamp,
  };
}

async function fetchYahoo(url) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("网络不可达或被浏览器跨域策略拦截");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("接口限流（429），请稍后重试");
    }
    throw new Error(`接口错误 ${response.status}`);
  }

  const data = await response.json();
  const result = data?.quoteResponse?.result?.[0];
  if (!result || result.regularMarketPrice == null) {
    throw new Error("代码无效或暂无数据");
  }
  return result;
}

async function loadCards() {
  const localCards = readLocalCards();
  let remoteCards = null;

  if (isHttpOrigin()) {
    remoteCards = await readRemoteCards();
  }

  if (Array.isArray(remoteCards) && remoteCards.length > 0) {
    state.cards = hydrateCards(remoteCards);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteCards));
    return;
  }

  state.cards = hydrateCards(localCards);

  if (isHttpOrigin() && Array.isArray(remoteCards) && remoteCards.length === 0 && localCards.length > 0) {
    const snapshot = JSON.stringify({ cards: serializeCards() });
    void persistRemoteState(snapshot);
  }
}

function saveCards() {
  const payload = serializeCards();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  scheduleRemoteSave(payload);
}

function hydrateCards(cards) {
  if (!Array.isArray(cards)) return [];

  return cards.map((card) => {
    const type = card?.type === "hn" ? "hn" : card?.type === "quote" ? "quote" : "stock";
    const hydrated = {
      ...card,
      type,
      permissions: { ...defaultPermissions, ...(card.permissions || {}) },
      status: card.status || "等待刷新",
      lastUpdatedAt: card.lastUpdatedAt || 0,
      isRefreshing: false,
    };

    if (type === "hn") {
      hydrated.name = card.name || "Hacker News 热门";
      hydrated.visualSize = parseCardVisualSize(card.visualSize);
      hydrated.hnLimit = parseHnLimit(card.hnLimit);
      hydrated.news = Array.isArray(card.news) ? card.news.map(normalizeHnStory).filter(Boolean) : [];
      return hydrated;
    }

    if (type === "quote") {
      hydrated.name = card.name || "思维片段";
      hydrated.visualSize = parseCardVisualSize(card.visualSize);
      hydrated.quoteTopic = parseQuoteTopic(card.quoteTopic);
      hydrated.quoteItem = card.quoteItem ? normalizeQuoteItem(card.quoteItem) : null;
      return hydrated;
    }

    hydrated.symbol = card.symbol || "";
    hydrated.querySymbol = card.querySymbol || toYahooSymbol(card.symbol || "");
    hydrated.visualSize = DEFAULT_CARD_VISUAL_SIZE;
    hydrated.costPrice = parseOptionalNonNegative(card.costPrice);
    hydrated.history = Array.isArray(card.history) ? card.history : [];
    hydrated.volumeHistory = Array.isArray(card.volumeHistory) ? card.volumeHistory : [];
    hydrated.prevCumulativeVolume =
      Number.isFinite(Number(card.prevCumulativeVolume)) ? Number(card.prevCumulativeVolume) : null;
    hydrated.quote = card.quote || null;
    hydrated.name = card.name || (hydrated.symbol ? hydrated.symbol.toUpperCase() : "股票卡片");
    return hydrated;
  });
}

function serializeCards() {
  return state.cards.map((card) => {
    const { isRefreshing, ...rest } = card;
    return rest;
  });
}

function readLocalCards() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readRemoteCards() {
  try {
    const response = await fetch(STATE_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return Array.isArray(payload?.cards) ? payload.cards : [];
  } catch {
    return null;
  }
}

function scheduleRemoteSave(cardsPayload) {
  if (!isHttpOrigin()) return;
  if (state.remoteSaveTimer) clearTimeout(state.remoteSaveTimer);

  const snapshot = JSON.stringify({ cards: cardsPayload });
  state.remoteSaveTimer = setTimeout(() => {
    void persistRemoteState(snapshot);
  }, REMOTE_SAVE_DEBOUNCE_MS);
}

async function persistRemoteState(snapshot) {
  try {
    await fetch(STATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: snapshot,
      cache: "no-store",
    });
  } catch {
    // Keep localStorage as durable fallback.
  }
}

function render() {
  refs.grid.innerHTML = "";
  state.cards.forEach((card) => {
    refs.grid.appendChild(buildCardElement(card));
  });
  refs.empty.hidden = state.cards.length > 0;
  renderSummary();
}

function renderCard(card, options = {}) {
  const cardEl = refs.grid.querySelector(`[data-card-wrap-id="${card.id}"]`);
  if (!cardEl) {
    refs.grid.prepend(buildCardElement(card));
  } else {
    populateCardElement(cardEl, card, options);
  }
  refs.empty.hidden = state.cards.length > 0;
}

function renderSummary() {
  refs.cardCount.textContent = String(state.cards.length);
  refs.autoRefreshCount.textContent = String(
    state.cards.filter((card) => card.permissions.autoRefresh).length
  );
}

function setupCardLongPressDrag() {
  refs.grid.addEventListener("pointerdown", handleCardPointerDown);
  window.addEventListener("pointermove", handleCardPointerMove, { passive: false });
  window.addEventListener("pointerup", handleCardPointerUp);
  window.addEventListener("pointercancel", handleCardPointerUp);
}

function handleCardPointerDown(event) {
  if (state.isReordering) return;
  if (event.button !== 0 && event.pointerType !== "touch") return;
  if (!(event.target instanceof Element)) return;
  if (isInteractiveTarget(event.target)) return;

  const cardEl = event.target.closest("[data-card-wrap-id]");
  if (!(cardEl instanceof HTMLElement)) return;

  const cardId = cardEl.getAttribute("data-card-wrap-id");
  if (!cardId) return;

  clearDragPressTimer();
  resetDragTransientState();

  dragState.activePointerId = event.pointerId;
  dragState.pressedCardEl = cardEl;
  dragState.pressedCardId = cardId;
  dragState.pointerStartX = event.clientX;
  dragState.pointerStartY = event.clientY;

  dragState.timer = setTimeout(() => {
    activateCardDrag(event.clientX, event.clientY);
  }, LONG_PRESS_MS);
}

function handleCardPointerMove(event) {
  if (dragState.activePointerId == null || event.pointerId !== dragState.activePointerId) return;

  if (!dragState.isDragging) {
    const dx = Math.abs(event.clientX - dragState.pointerStartX);
    const dy = Math.abs(event.clientY - dragState.pointerStartY);
    if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
      clearDragPressTimer();
      resetDragTransientState();
    }
    return;
  }

  event.preventDefault();
  moveDraggedCard(event.clientX, event.clientY);
  movePlaceholderByPointer(event.clientX, event.clientY);
}

function handleCardPointerUp(event) {
  if (dragState.activePointerId == null || event.pointerId !== dragState.activePointerId) return;

  clearDragPressTimer();

  if (!dragState.isDragging) {
    resetDragTransientState();
    return;
  }

  finalizeCardDrag();
}

function activateCardDrag(clientX, clientY) {
  if (!(dragState.pressedCardEl instanceof HTMLElement)) return;

  const cardEl = dragState.pressedCardEl;
  const rect = cardEl.getBoundingClientRect();

  dragState.isDragging = true;
  state.isReordering = true;
  refs.grid.classList.add("reorder-mode");
  document.body.classList.add("is-reordering");

  const placeholder = document.createElement("div");
  placeholder.className = "card-placeholder";
  placeholder.style.height = `${rect.height}px`;
  placeholder.style.width = `${rect.width}px`;
  cardEl.after(placeholder);

  dragState.placeholderEl = placeholder;
  dragState.draggingEl = cardEl;
  dragState.pointerOffsetX = clientX - rect.left;
  dragState.pointerOffsetY = clientY - rect.top;

  cardEl.classList.add("is-dragging");
  cardEl.style.width = `${rect.width}px`;
  cardEl.style.height = `${rect.height}px`;
  cardEl.style.left = `${rect.left}px`;
  cardEl.style.top = `${rect.top}px`;
  cardEl.style.position = "fixed";
  document.body.appendChild(cardEl);

  moveDraggedCard(clientX, clientY);
  movePlaceholderByPointer(clientX, clientY);
}

function moveDraggedCard(clientX, clientY) {
  if (!(dragState.draggingEl instanceof HTMLElement)) return;
  const left = clientX - dragState.pointerOffsetX;
  const top = clientY - dragState.pointerOffsetY;
  dragState.draggingEl.style.left = `${left}px`;
  dragState.draggingEl.style.top = `${top}px`;
}

function movePlaceholderByPointer(clientX, clientY) {
  if (!(dragState.placeholderEl instanceof HTMLElement)) return;

  const hovered = document.elementFromPoint(clientX, clientY);
  const targetCard = hovered instanceof Element ? hovered.closest("[data-card-wrap-id]") : null;

  if (targetCard instanceof HTMLElement && targetCard !== dragState.draggingEl) {
    const rect = targetCard.getBoundingClientRect();
    const insertAfter = clientY > rect.top + rect.height / 2;
    if (insertAfter) {
      targetCard.after(dragState.placeholderEl);
    } else {
      targetCard.before(dragState.placeholderEl);
    }
    return;
  }

  const gridRect = refs.grid.getBoundingClientRect();
  if (clientY < gridRect.top + 20) {
    refs.grid.prepend(dragState.placeholderEl);
  } else if (clientY > gridRect.bottom - 20) {
    refs.grid.append(dragState.placeholderEl);
  }
}

function finalizeCardDrag() {
  const dragEl = dragState.draggingEl;
  const placeholder = dragState.placeholderEl;

  if (dragEl instanceof HTMLElement && placeholder instanceof HTMLElement) {
    placeholder.replaceWith(dragEl);

    dragEl.classList.remove("is-dragging");
    dragEl.style.width = "";
    dragEl.style.height = "";
    dragEl.style.left = "";
    dragEl.style.top = "";
    dragEl.style.position = "";

    reorderCardsByDom();
    saveCards();
    renderSummary();
  }

  refs.grid.classList.remove("reorder-mode");
  document.body.classList.remove("is-reordering");
  state.isReordering = false;
  dragState.suppressClickUntil = Date.now() + 280;
  resetDragTransientState();
}

function reorderCardsByDom() {
  const order = Array.from(refs.grid.querySelectorAll("[data-card-wrap-id]")).map((el, index) => [
    el.getAttribute("data-card-wrap-id"),
    index,
  ]);

  const orderMap = new Map(order);
  state.cards.sort((a, b) => {
    const ai = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

function isInteractiveTarget(target) {
  return Boolean(target.closest("button, a, input, select, textarea, label, [data-action]"));
}

function clearDragPressTimer() {
  if (dragState.timer) {
    clearTimeout(dragState.timer);
    dragState.timer = null;
  }
}

function resetDragTransientState() {
  dragState.activePointerId = null;
  dragState.pressedCardEl = null;
  dragState.pressedCardId = null;
  dragState.pointerStartX = 0;
  dragState.pointerStartY = 0;
  dragState.pointerOffsetX = 0;
  dragState.pointerOffsetY = 0;
  dragState.draggingEl = null;
  dragState.placeholderEl = null;
  dragState.isDragging = false;
}

function buildCardElement(card) {
  const node = refs.template.content.firstElementChild.cloneNode(true);
  node.setAttribute("data-card-wrap-id", card.id);
  populateCardElement(node, card, { statusOnly: false });
  return node;
}

function populateCardElement(node, card, options = {}) {
  const statusOnly = Boolean(options.statusOnly);
  const symbolEl = node.querySelector(".symbol");
  const nameEl = node.querySelector(".name");
  const metrics = node.querySelector(".metrics");
  const chartWrap = node.querySelector(".chart-wrap");
  const volumeWrap = node.querySelector(".volume-wrap");
  const newsWrap = node.querySelector(".news-wrap");
  const quoteWrap = node.querySelector(".quote-wrap");
  const actions = node.querySelector(".card-actions");
  const statusEl = node.querySelector(".status-text");

  node.classList.remove(
    "card-type-stock",
    "card-type-hn",
    "card-type-quote",
    "card-size-compact",
    "card-size-standard",
    "card-size-expanded"
  );
  node.classList.add(
    card.type === "hn" ? "card-type-hn" : card.type === "quote" ? "card-type-quote" : "card-type-stock"
  );
  const visualSizeClass =
    card.type === "stock" ? DEFAULT_CARD_VISUAL_SIZE : parseCardVisualSize(card.visualSize);
  node.classList.add(`card-size-${visualSizeClass}`);

  symbolEl.textContent =
    card.type === "hn" ? "HN TOP" : card.type === "quote" ? "QUOTE" : card.querySymbol;
  nameEl.textContent = card.name;
  statusEl.textContent = card.status;

  if (statusOnly) return;

  actions.innerHTML = "";
  if (card.permissions.allowManualRefresh) {
    actions.appendChild(actionButton("refresh", card.id));
  }
  if (card.permissions.allowEdit) {
    actions.appendChild(actionButton("edit", card.id));
  }
  if (card.permissions.allowDelete) {
    actions.appendChild(actionButton("delete", card.id));
  }

  if (card.type === "hn") {
    renderHnBody(card, metrics, chartWrap, volumeWrap, newsWrap, quoteWrap);
  } else if (card.type === "quote") {
    renderQuoteBody(card, metrics, chartWrap, volumeWrap, newsWrap, quoteWrap);
  } else {
    renderStockBody(card, metrics, chartWrap, volumeWrap, newsWrap, quoteWrap);
  }
}

function renderStockBody(card, metrics, chartWrap, volumeWrap, newsWrap, quoteWrap) {
  const neutralSeriesColor = "#1f2328";
  const neutralVolumeColor = "#5f6670";
  newsWrap.hidden = true;
  quoteWrap.hidden = true;

  const quote = card.quote;
  if (!quote) {
    metrics.innerHTML = '<p class="status-text">暂无行情，点击刷新获取。</p>';
  } else {
    const keyRows = [];
    const metaRows = [];

    if (card.permissions.showChange) {
      keyRows.push(
        stockMetricItem(
          "涨跌",
          `${formatSigned(quote.change)} (${formatSigned(quote.changePercent)}%)`,
          "stock-key-item"
        )
      );
    }

    if (card.permissions.showPnL) {
      keyRows.push(stockMetricItem("盈亏比例", buildPnlRatioValue(quote.price, card.costPrice), "stock-key-item"));
    }

    if (card.permissions.showPrice) {
      metaRows.push(stockMetricItem("最新价", `${formatNumber(quote.price)} ${quote.currency || ""}`));
    }

    if (card.permissions.showHighLow) {
      metaRows.push(stockMetricItem("当日高/低", `${formatNumber(quote.high)} / ${formatNumber(quote.low)}`));
    }

    if (card.permissions.showVolume) {
      metaRows.push(stockMetricItem("成交量", formatCompact(quote.volume)));
    }

    if (card.permissions.showTimestamp) {
      metaRows.push(stockMetricItem("更新时间", formatTime(quote.timestamp)));
    }

    if (card.permissions.showPnL) {
      metaRows.push(
        stockMetricItem(
          "成本价",
          card.costPrice == null ? "未设置" : `${formatNumber(card.costPrice, 4, 4)} ${quote.currency || ""}`
        )
      );
    }

    metrics.innerHTML = [
      keyRows.length ? `<div class="stock-key-metrics">${keyRows.join("")}</div>` : "",
      metaRows.length ? `<div class="stock-meta-metrics">${metaRows.join("")}</div>` : "",
    ]
      .filter(Boolean)
      .join("");
  }

  if (card.permissions.showChart && card.history.length > 1) {
    chartWrap.hidden = false;
    chartWrap.innerHTML = buildSparkline(card.history, neutralSeriesColor, {
      min: quote?.low,
      max: quote?.high,
      minLabel: quote?.low,
      maxLabel: quote?.high,
      reference: quote?.prevClose,
      current: quote?.price,
    });
  } else if (!card.permissions.showChart) {
    chartWrap.hidden = true;
  } else {
    chartWrap.hidden = false;
    chartWrap.innerHTML = '<p class="status-text">行情曲线需要至少两次刷新数据。</p>';
  }

  if (card.permissions.showVolumeChart && card.volumeHistory.length > 1) {
    volumeWrap.hidden = false;
    volumeWrap.innerHTML = buildVolumeBars(card.volumeHistory, neutralVolumeColor);
  } else if (!card.permissions.showVolumeChart) {
    volumeWrap.hidden = true;
  } else {
    volumeWrap.hidden = false;
    volumeWrap.innerHTML = '<p class="status-text">分时量图需要至少两次刷新数据。</p>';
  }
}

function renderHnBody(card, metrics, chartWrap, volumeWrap, newsWrap, quoteWrap) {
  chartWrap.hidden = true;
  volumeWrap.hidden = true;
  newsWrap.hidden = false;
  quoteWrap.hidden = true;

  const stories = Array.isArray(card.news) ? card.news : [];
  if (!stories.length) {
    metrics.innerHTML = '<p class="status-text">暂无新闻，点击刷新获取。</p>';
    newsWrap.innerHTML = '<p class="status-text">等待抓取 Hacker News 热门新闻。</p>';
    return;
  }

  const topScore = Math.max(...stories.map((item) => item.score || 0), 0);
  metrics.innerHTML = [
    metricItem("热门条数", String(stories.length)),
    card.permissions.showHnScore ? metricItem("最高分", String(topScore)) : "",
    card.permissions.showHnComments
      ? metricItem(
          "总评论",
          String(stories.reduce((sum, item) => sum + (Number(item.descendants) || 0), 0))
        )
      : "",
  ]
    .filter(Boolean)
    .join("");

  newsWrap.innerHTML = buildNewsList(stories, card.permissions);
}

function renderQuoteBody(card, metrics, chartWrap, volumeWrap, newsWrap, quoteWrap) {
  chartWrap.hidden = true;
  volumeWrap.hidden = true;
  newsWrap.hidden = true;
  quoteWrap.hidden = false;

  const quoteItem = normalizeQuoteItem(card.quoteItem);
  const rows = [metricItem("主题", quoteTopicLabel(parseQuoteTopic(card.quoteTopic)))];
  if (quoteItem && card.permissions.showQuoteAuthor) {
    rows.push(metricItem("作者", escapeHtml(quoteItem.author || "--")));
  }
  if (quoteItem && card.permissions.showQuoteSource) {
    rows.push(metricItem("来源", escapeHtml(quoteItem.source || "--")));
  }
  if (quoteItem && card.permissions.showQuoteTimestamp) {
    rows.push(metricItem("更新时间", formatTime(quoteItem.timestamp || Date.now())));
  }
  metrics.innerHTML = rows.join("");

  if (!quoteItem || !quoteItem.text) {
    quoteWrap.innerHTML = '<p class="status-text">暂无思维片段，点击刷新获取。</p>';
    return;
  }

  const meta = [];
  if (card.permissions.showQuoteTopic) {
    meta.push(`<span>${quoteTopicLabel(parseQuoteTopic(quoteItem.topic || card.quoteTopic))}</span>`);
  }
  if (card.permissions.showQuoteAuthor) {
    meta.push(`<span>${escapeHtml(quoteItem.author || "--")}</span>`);
  }
  if (card.permissions.showQuoteSource) {
    meta.push(`<span>${escapeHtml(quoteItem.source || "--")}</span>`);
  }

  quoteWrap.innerHTML = `<blockquote class=\"quote-text\">${escapeHtml(quoteItem.text)}</blockquote>
  <div class=\"quote-meta\">${meta.join("")}</div>`;
}

function buildNewsList(stories, permissions) {
  const items = stories
    .map((story) => {
      const meta = [];
      if (permissions.showHnScore) meta.push(`分数 ${formatCompact(story.score)}`);
      if (permissions.showHnComments) meta.push(`评论 ${formatCompact(story.descendants)}`);
      if (permissions.showHnAuthor) meta.push(`作者 ${escapeHtml(story.by || "unknown")}`);
      if (permissions.showHnDomain) meta.push(escapeHtml(story.domain || "news.ycombinator.com"));
      if (permissions.showHnTime) meta.push(formatRelativeTime(story.time));

      const href = escapeHtml(story.url || `https://news.ycombinator.com/item?id=${story.id}`);
      const title = escapeHtml(story.title || "(无标题)");

      return `<li class="news-item">
        <a class="news-link" href="${href}" target="_blank" rel="noopener noreferrer">${title}</a>
        <div class="news-meta">${meta.map((item) => `<span>${item}</span>`).join("")}</div>
      </li>`;
    })
    .join("");

  return `<ul class="news-list">${items}</ul>`;
}

function actionButton(action, cardId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-icon-btn";
  if (action === "delete") {
    button.classList.add("is-danger");
  }
  button.dataset.action = action;
  button.dataset.cardId = cardId;
  button.ariaLabel = getActionLabel(action);
  button.title = getActionLabel(action);
  button.innerHTML = getActionIcon(action);
  return button;
}

function getActionLabel(action) {
  if (action === "refresh") return "刷新";
  if (action === "edit") return "权限设置";
  if (action === "delete") return "删除";
  return action;
}

function getActionIcon(action) {
  if (action === "refresh") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>`;
  }
  if (action === "edit") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M6 6h12M7 14h10M7 18h10M12 15v6"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"/></svg>`;
}

function metricItem(label, value) {
  return `<div class="metric"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function stockMetricItem(label, value, className = "") {
  const extraClass = className ? ` ${className}` : "";
  return `<div class="stock-metric${extraClass}"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function buildSparkline(series, color, bounds = {}) {
  const width = 300;
  const height = 68;
  const seriesMin = Math.min(...series);
  const seriesMax = Math.max(...series);
  const hasExplicitBounds =
    Number.isFinite(bounds.min) && Number.isFinite(bounds.max) && Number(bounds.max) > Number(bounds.min);
  const min = hasExplicitBounds ? Math.min(Number(bounds.min), seriesMin) : seriesMin;
  const max = hasExplicitBounds ? Math.max(Number(bounds.max), seriesMax) : seriesMax;
  const spread = Math.max(max - min, 1e-6);
  const topPadding = 4;
  const bottomPadding = 4;
  const drawableHeight = height - topPadding - bottomPadding;

  const mapY = (value) => {
    const ratio = (value - min) / spread;
    return topPadding + (1 - ratio) * drawableHeight;
  };

  const points = series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * width;
      const y = mapY(value);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath = `M 0 ${height - bottomPadding} L ${points} L ${width} ${height - bottomPadding} Z`;
  const referenceValue = Number(bounds.reference);
  const hasReference = Number.isFinite(referenceValue) && referenceValue >= min && referenceValue <= max;
  const referenceY = hasReference ? mapY(referenceValue).toFixed(2) : null;
  const currentValue = Number(bounds.current);
  const hasCurrent = Number.isFinite(currentValue) && currentValue >= min && currentValue <= max;
  const currentY = hasCurrent ? mapY(currentValue).toFixed(2) : null;
  const currentLabel = hasCurrent ? formatNumber(currentValue) : "";
  const lastX = width;
  const lastY = mapY(series[series.length - 1]).toFixed(2);
  const maxLabel = Number.isFinite(Number(bounds.maxLabel)) ? formatNumber(Number(bounds.maxLabel)) : formatNumber(max);
  const minLabel = Number.isFinite(Number(bounds.minLabel)) ? formatNumber(Number(bounds.minLabel)) : formatNumber(min);

  return `<div class="price-chart-frame">
    <div class="sparkline-meta">
      <span>${escapeHtml(maxLabel)}</span>
      <span>${escapeHtml(minLabel)}</span>
    </div>
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line class="sparkline-grid" x1="0" y1="${topPadding}" x2="${width}" y2="${topPadding}"></line>
      <line class="sparkline-grid sparkline-grid-mid" x1="0" y1="${(height / 2).toFixed(2)}" x2="${width}" y2="${(
        height / 2
      ).toFixed(2)}"></line>
      <line class="sparkline-grid" x1="0" y1="${height - bottomPadding}" x2="${width}" y2="${height - bottomPadding}"></line>
      ${
        hasReference
          ? `<line class="sparkline-ref" x1="0" y1="${referenceY}" x2="${width}" y2="${referenceY}"></line>`
          : ""
      }
      ${
        hasCurrent
          ? `<line class="sparkline-current" x1="0" y1="${currentY}" x2="${width}" y2="${currentY}"></line>
      <text class="sparkline-current-label" x="${width - 2}" y="${Math.max(8, Number(currentY) - 2).toFixed(
        2
      )}" text-anchor="end">${escapeHtml(currentLabel)}</text>`
          : ""
      }
      <path class="sparkline-area" d="${areaPath}"></path>
      <polyline class="sparkline-line" points="${points}" style="stroke:${color}"></polyline>
      <circle class="sparkline-dot" cx="${lastX}" cy="${lastY}" r="1.8" style="fill:${color}"></circle>
    </svg>
  </div>`;
}

function buildVolumeBars(series, color) {
  const width = 300;
  const height = 56;
  const values = series.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(...values, 1);
  const unit = width / values.length;
  const barWidth = Math.max(unit * 0.72, 1.5);

  const rects = values
    .map((value, index) => {
      const x = index * unit + (unit - barWidth) / 2;
      const barHeight = (value / max) * (height - 2);
      const y = height - barHeight;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(
        2
      )}" height="${barHeight.toFixed(2)}" rx="1.4"></rect>`;
    })
    .join("");

  return `<div class="mini-chart-title">分时量</div>
  <svg class="volume-bars" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="--bar-color:${color}">
    ${rects}
  </svg>`;
}

function appendVolumeDelta(card, cumulativeVolume) {
  const current = Number(cumulativeVolume);
  if (!Number.isFinite(current) || current < 0) {
    card.volumeHistory.push(0);
    return;
  }

  const prev = card.prevCumulativeVolume;
  let delta = 0;
  if (Number.isFinite(prev)) {
    delta = current >= prev ? current - prev : current;
  }

  card.prevCumulativeVolume = current;
  card.volumeHistory.push(delta);
}

function parseHnLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return HN_DEFAULT_LIMIT;
  return Math.min(HN_MAX_LIMIT, Math.max(HN_MIN_LIMIT, Math.round(parsed)));
}

function parseQuoteTopic(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return QUOTE_TOPICS.has(normalized) ? normalized : QUOTE_DEFAULT_TOPIC;
}

function quoteTopicLabel(topic) {
  const normalized = parseQuoteTopic(topic);
  if (normalized === "economics") return "经济学";
  if (normalized === "philosophy") return "哲学";
  if (normalized === "engineering") return "工程";
  return "混合";
}

function normalizeQuoteItem(item) {
  if (!item || !item.text) return null;
  return {
    text: String(item.text),
    author: String(item.author || "Signal Notebook"),
    source: String(item.source || "Quote Fragment"),
    topic: parseQuoteTopic(item.topic),
    timestamp: Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : Date.now(),
  };
}

function getLocalQuotePool(topic) {
  const normalized = parseQuoteTopic(topic);
  if (normalized === "mixed") {
    return [
      ...QUOTE_FALLBACK_LIBRARY.economics,
      ...QUOTE_FALLBACK_LIBRARY.philosophy,
      ...QUOTE_FALLBACK_LIBRARY.engineering,
    ];
  }
  return QUOTE_FALLBACK_LIBRARY[normalized];
}

function parseCardVisualSize(value) {
  return CARD_VISUAL_SIZES.has(value) ? value : DEFAULT_CARD_VISUAL_SIZE;
}

function toYahooSymbol(input) {
  const raw = String(input || "").trim().toUpperCase();

  if (/^\d{6}\.(SH|SS|SZ)$/.test(raw)) {
    const [code, suffix] = raw.split(".");
    return `${code}.${suffix === "SH" ? "SS" : suffix}`;
  }

  if (/^(SH|SZ)\d{6}$/.test(raw)) {
    return `${raw.slice(2)}.${raw.startsWith("SH") ? "SS" : "SZ"}`;
  }

  if (/^\d{6}$/.test(raw)) {
    return `${raw}.${raw.startsWith("6") ? "SS" : "SZ"}`;
  }

  if (/^HK\d{4,5}$/.test(raw)) {
    return `${raw.slice(2).padStart(4, "0")}.HK`;
  }

  if (/^\d{4,5}\.HK$/.test(raw)) {
    const [code] = raw.split(".");
    return `${code.padStart(4, "0")}.HK`;
  }

  if (/^\d{4,5}$/.test(raw)) {
    return `${raw.padStart(4, "0")}.HK`;
  }

  return raw;
}

function normalizeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (!message) return "未知错误";
  if (/failed to fetch/i.test(message)) {
    return "网络不可达、接口被拦截或跨域限制";
  }
  return message;
}

function isHttpOrigin() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function getMarketSessionState(symbol, now = Date.now()) {
  const profile = resolveMarketProfile(symbol);
  if (!profile) {
    return { isOpen: true, label: "未知市场" };
  }

  const parts = getZonedClockParts(now, profile.timeZone);
  if (parts.weekday === 0 || parts.weekday === 6) {
    return { isOpen: false, label: profile.label };
  }

  const minutes = parts.hour * 60 + parts.minute;
  const isOpen = profile.sessions.some(([start, end]) => minutes >= start && minutes < end);
  return { isOpen, label: profile.label };
}

function resolveMarketProfile(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  if (!normalized) return null;

  if (/\.(SS|SZ)$/.test(normalized)) return MARKET_PROFILES.CN;
  if (/\.HK$/.test(normalized)) return MARKET_PROFILES.HK;
  if (/^[A-Z][A-Z0-9.^=-]*$/.test(normalized)) return MARKET_PROFILES.US;
  return null;
}

function getZonedClockParts(timestamp, timeZone) {
  const formatter = getTimeFormatter(timeZone);
  const parts = formatter.formatToParts(new Date(timestamp));
  const result = { weekday: 1, hour: 0, minute: 0 };

  parts.forEach((part) => {
    if (part.type === "weekday") result.weekday = WEEKDAY_MAP[part.value] ?? 1;
    if (part.type === "hour") result.hour = Number(part.value) || 0;
    if (part.type === "minute") result.minute = Number(part.value) || 0;
  });

  return result;
}

function getTimeFormatter(timeZone) {
  if (!timeFormatterCache[timeZone]) {
    timeFormatterCache[timeZone] = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return timeFormatterCache[timeZone];
}

function formatNumber(value, minDigits = 2, maxDigits = 2) {
  if (value == null || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
}

function formatSigned(value) {
  if (value == null || Number.isNaN(value)) return "--";
  const abs = Math.abs(value);
  const fixed = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value >= 0 ? "+" : "-"}${fixed}`;
}

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRelativeTime(timestamp) {
  const diff = Date.now() - Number(timestamp || 0);
  if (!Number.isFinite(diff) || diff < 0) return "刚刚";

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}

function parseOptionalNonNegative(input) {
  if (input == null || input === "") return null;
  const num = Number(input);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(4));
}

function buildPnlRatioValue(currentPrice, costPrice) {
  if (costPrice == null) return "未设置成本价";
  if (currentPrice == null || Number.isNaN(currentPrice)) return "--";

  const ratio = ((currentPrice - costPrice) / costPrice) * 100;
  return `<span>${formatSigned(ratio)}%</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMarketClosedStatus(label) {
  return `${label}闭市，开市后自动恢复`;
}

function debounce(fn, waitMs) {
  let timer = null;
  return (...args) =>
    new Promise((resolve) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        timer = null;
        resolve(await fn(...args));
      }, waitMs);
    });
}

init().catch(() => {
  state.cards = [];
  render();
  startRefreshLoop();
});
