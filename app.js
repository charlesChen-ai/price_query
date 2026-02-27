const STORAGE_KEY = "stock_dashboard_cards_v1";
const ALERT_STORAGE_KEY = "stock_dashboard_alert_engine_v1";
const MAX_HISTORY_POINTS = 36;
const DAILY_HISTORY_DAYS = 160;
const DAILY_HISTORY_REFRESH_MS = 30 * 60 * 1000;
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
const ALERT_HISTORY_LIMIT = 180;
const ALERT_SCAN_COOLDOWN_MS = 0;
const ALERT_LOW_POWER_SCAN_COOLDOWN_MS = 30000;
const ALERT_DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const ALERT_RULE_TYPES = new Set(["price", "change", "ma_breakout", "macd_cross", "rsi_zone"]);
const ALERT_MA_KEYS = new Set(["ma5", "ma10", "ma20"]);
const ALERT_RULE_TYPE_LABELS = {
  price: "价格阈值",
  change: "涨跌幅",
  ma_breakout: "MA 突破",
  macd_cross: "MACD 信号",
  rsi_zone: "RSI 区间",
};
const ALERT_COOLDOWN_OPTIONS = [
  { value: 60 * 1000, label: "1 分钟" },
  { value: 3 * 60 * 1000, label: "3 分钟" },
  { value: 5 * 60 * 1000, label: "5 分钟" },
  { value: 15 * 60 * 1000, label: "15 分钟" },
  { value: 30 * 60 * 1000, label: "30 分钟" },
];
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
  "showTechnicals",
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
  showTechnicals: true,
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
  showTechnicals: "显示技术指标",
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
  alertEngine: buildDefaultAlertEngineState(),
  alertRuntime: {
    cardLastScanAt: {},
  },
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
  alertWorkbench: document.getElementById("alertWorkbench"),
  alertWorkbenchBody: document.getElementById("alertWorkbenchBody"),
  alertCollapseBtn: document.getElementById("alertCollapseBtn"),
  alertCenterToggle: document.getElementById("alertCenterToggle"),
  alertSilentToggle: document.getElementById("alertSilentToggle"),
  alertSoundToggle: document.getElementById("alertSoundToggle"),
  alertVibrationToggle: document.getElementById("alertVibrationToggle"),
  alertLowPowerToggle: document.getElementById("alertLowPowerToggle"),
  alertRuleCount: document.getElementById("alertRuleCount"),
  alertEnabledRuleCount: document.getElementById("alertEnabledRuleCount"),
  alertTodayCount: document.getElementById("alertTodayCount"),
  alertTotalCount: document.getElementById("alertTotalCount"),
  alertRuleForm: document.getElementById("alertRuleForm"),
  alertRuleCardSelect: document.getElementById("alertRuleCardSelect"),
  alertRuleTypeSelect: document.getElementById("alertRuleTypeSelect"),
  alertRuleParams: document.getElementById("alertRuleParams"),
  alertRuleCooldownSelect: document.getElementById("alertRuleCooldownSelect"),
  alertToggleAllRulesBtn: document.getElementById("alertToggleAllRulesBtn"),
  alertClearHistoryBtn: document.getElementById("alertClearHistoryBtn"),
  alertRuleList: document.getElementById("alertRuleList"),
  alertHistoryList: document.getElementById("alertHistoryList"),
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
  renderAlertWorkbench();
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

  refs.alertRuleTypeSelect.addEventListener("change", () => {
    renderAlertRuleParams(refs.alertRuleTypeSelect.value, null);
  });

  refs.alertRuleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createAlertRuleFromForm();
  });

  refs.alertRuleList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-alert-action]");
    if (!button) return;
    const action = button.getAttribute("data-alert-action");
    const ruleId = button.getAttribute("data-rule-id");
    if (!action || !ruleId) return;
    if (action === "toggle") {
      toggleAlertRule(ruleId);
      return;
    }
    if (action === "delete") {
      deleteAlertRule(ruleId);
    }
  });

  refs.alertCollapseBtn.addEventListener("click", () => {
    state.alertEngine.panelCollapsed = !state.alertEngine.panelCollapsed;
    saveAlertEngine();
    renderAlertWorkbench();
  });

  refs.alertCenterToggle.addEventListener("change", () => {
    state.alertEngine.enabled = refs.alertCenterToggle.checked;
    saveAlertEngine();
    renderAlertWorkbench();
  });

  refs.alertSilentToggle.addEventListener("change", () => {
    state.alertEngine.silentMode = refs.alertSilentToggle.checked;
    saveAlertEngine();
    renderAlertWorkbench();
  });

  refs.alertSoundToggle.addEventListener("change", () => {
    state.alertEngine.soundEnabled = refs.alertSoundToggle.checked;
    saveAlertEngine();
  });

  refs.alertVibrationToggle.addEventListener("change", () => {
    state.alertEngine.vibrationEnabled = refs.alertVibrationToggle.checked;
    saveAlertEngine();
  });

  refs.alertLowPowerToggle.addEventListener("change", () => {
    state.alertEngine.lowPowerMode = refs.alertLowPowerToggle.checked;
    saveAlertEngine();
    renderAlertWorkbench();
  });

  refs.alertToggleAllRulesBtn.addEventListener("click", () => {
    const shouldEnableAll = state.alertEngine.rules.some((rule) => !rule.enabled);
    state.alertEngine.rules = state.alertEngine.rules.map((rule) => ({ ...rule, enabled: shouldEnableAll }));
    saveAlertEngine();
    renderAlertWorkbench();
  });

  refs.alertClearHistoryBtn.addEventListener("click", () => {
    state.alertEngine.history = [];
    saveAlertEngine();
    renderAlertWorkbench();
  });

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
      pruneAlertBindingsForCard(cardId);
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
    dailySeries: [],
    dailySeriesUpdatedAt: 0,
    volumeHistory: [],
    prevCumulativeVolume: null,
    technicals: null,
    quote: null,
    status: "等待刷新",
    lastUpdatedAt: 0,
    isRefreshing: false,
  };
}

function buildDefaultAlertEngineState() {
  return {
    enabled: true,
    silentMode: true,
    lowPowerMode: false,
    soundEnabled: false,
    vibrationEnabled: false,
    panelCollapsed: false,
    rules: [],
    history: [],
    totalTriggered: 0,
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
  const previousQuote = card.quote ? { ...card.quote } : null;
  const previousTechnicals = normalizeTechnicalSnapshot(card.technicals);
  const quote = await fetchStockQuote(card.querySymbol);
  card.quote = quote;
  card.history.push(quote.price);
  appendVolumeDelta(card, quote.volume);

  let historySyncFailed = false;
  if (shouldRefreshDailySeries(card)) {
    const dailySeries = await fetchStockHistory(card.querySymbol, DAILY_HISTORY_DAYS);
    if (dailySeries.length) {
      card.dailySeries = dailySeries;
      card.dailySeriesUpdatedAt = Date.now();
    } else {
      historySyncFailed = true;
    }
  }

  card.dailySeries = mergeQuoteIntoDailySeries(card.dailySeries, quote);
  card.technicals = computeTechnicalSnapshot(card.dailySeries);

  if (card.history.length > MAX_HISTORY_POINTS) {
    card.history.splice(0, card.history.length - MAX_HISTORY_POINTS);
  }

  if (card.volumeHistory.length > MAX_HISTORY_POINTS) {
    card.volumeHistory.splice(0, card.volumeHistory.length - MAX_HISTORY_POINTS);
  }

  card.status = `已更新 ${formatTime(quote.timestamp)}${historySyncFailed ? " · 日线缓存沿用本地数据" : ""}`;
  monitorCardAlerts(card, previousQuote, previousTechnicals);
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

async function fetchStockHistory(symbol, days = DAILY_HISTORY_DAYS) {
  if (!isHttpOrigin()) return [];

  try {
    const response = await fetch(
      `/api/stock/history?symbol=${encodeURIComponent(symbol)}&days=${Math.min(260, Math.max(30, days))}`,
      {
        cache: "no-store",
      }
    );
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.items) ? payload.items.map(normalizeHistoricalBar).filter(Boolean) : [];
  } catch {
    return [];
  }
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
  const localAlerts = readLocalAlertEngine();
  let remoteState = null;

  if (isHttpOrigin()) {
    remoteState = await readRemoteState();
  }

  const remoteCards = Array.isArray(remoteState?.cards) ? remoteState.cards : null;

  if (remoteCards && remoteCards.length > 0) {
    state.cards = hydrateCards(remoteCards);
    state.alertEngine = hydrateAlertEngine(remoteState?.alerts, state.cards);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteCards));
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(serializeAlertEngine()));
    return;
  }

  state.cards = hydrateCards(localCards);
  const shouldPreferLocalAlerts = Boolean(remoteCards && remoteCards.length === 0 && localCards.length > 0);
  state.alertEngine = hydrateAlertEngine(
    shouldPreferLocalAlerts ? localAlerts : remoteState ? remoteState.alerts : localAlerts,
    state.cards
  );

  if (
    isHttpOrigin() &&
    remoteCards &&
    remoteCards.length === 0 &&
    (localCards.length > 0 ||
      state.alertEngine.rules.length > 0 ||
      state.alertEngine.history.length > 0 ||
      state.alertEngine.totalTriggered > 0)
  ) {
    const snapshot = JSON.stringify({ cards: serializeCards(), alerts: serializeAlertEngine() });
    void persistRemoteState(snapshot);
  }
}

function saveCards() {
  const cardsPayload = serializeCards();
  const alertsPayload = serializeAlertEngine();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cardsPayload));
  localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(alertsPayload));
  scheduleRemoteSave(cardsPayload, alertsPayload);
}

function saveAlertEngine() {
  const cardsPayload = serializeCards();
  const alertsPayload = serializeAlertEngine();
  localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(alertsPayload));
  scheduleRemoteSave(cardsPayload, alertsPayload);
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
    hydrated.dailySeries = Array.isArray(card.dailySeries)
      ? card.dailySeries.map(normalizeHistoricalBar).filter(Boolean)
      : [];
    hydrated.dailySeriesUpdatedAt =
      Number.isFinite(Number(card.dailySeriesUpdatedAt)) ? Number(card.dailySeriesUpdatedAt) : 0;
    hydrated.volumeHistory = Array.isArray(card.volumeHistory) ? card.volumeHistory : [];
    hydrated.prevCumulativeVolume =
      Number.isFinite(Number(card.prevCumulativeVolume)) ? Number(card.prevCumulativeVolume) : null;
    hydrated.quote = card.quote || null;
    hydrated.technicals = normalizeTechnicalSnapshot(card.technicals);
    hydrated.name = card.name || (hydrated.symbol ? hydrated.symbol.toUpperCase() : "股票卡片");
    if (
      (!hydrated.technicals ||
        !hydrated.technicals.close ||
        !Number.isFinite(hydrated.technicals?.kdj?.k) ||
        !Number.isFinite(hydrated.technicals?.kdj?.d) ||
        !Number.isFinite(hydrated.technicals?.kdj?.j)) &&
      hydrated.dailySeries.length
    ) {
      hydrated.dailySeries = mergeQuoteIntoDailySeries(hydrated.dailySeries, hydrated.quote);
      hydrated.technicals = computeTechnicalSnapshot(hydrated.dailySeries);
    }
    return hydrated;
  });
}

function serializeCards() {
  return state.cards.map((card) => {
    const { isRefreshing, ...rest } = card;
    return rest;
  });
}

function hydrateAlertEngine(alertEngine, cards) {
  const fallback = buildDefaultAlertEngineState();
  const stockCardIds = new Set(
    (Array.isArray(cards) ? cards : []).filter((item) => item && item.type === "stock").map((item) => item.id)
  );
  const input = alertEngine && typeof alertEngine === "object" ? alertEngine : {};
  const rules = Array.isArray(input.rules)
    ? input.rules
        .map(normalizeAlertRule)
        .filter((item) => item && stockCardIds.has(item.cardId))
    : [];
  const history = Array.isArray(input.history)
    ? input.history.map(normalizeAlertHistoryRecord).filter(Boolean).slice(-ALERT_HISTORY_LIMIT)
    : [];
  const parsedTotal = Number(input.totalTriggered);

  return {
    ...fallback,
    ...input,
    enabled: typeof input.enabled === "boolean" ? input.enabled : fallback.enabled,
    silentMode: typeof input.silentMode === "boolean" ? input.silentMode : fallback.silentMode,
    lowPowerMode: typeof input.lowPowerMode === "boolean" ? input.lowPowerMode : fallback.lowPowerMode,
    soundEnabled: typeof input.soundEnabled === "boolean" ? input.soundEnabled : fallback.soundEnabled,
    vibrationEnabled: typeof input.vibrationEnabled === "boolean" ? input.vibrationEnabled : fallback.vibrationEnabled,
    panelCollapsed: typeof input.panelCollapsed === "boolean" ? input.panelCollapsed : fallback.panelCollapsed,
    rules,
    history,
    totalTriggered: Number.isFinite(parsedTotal) && parsedTotal >= 0 ? Math.round(parsedTotal) : history.length,
  };
}

function serializeAlertEngine() {
  const current = state.alertEngine || buildDefaultAlertEngineState();
  return {
    enabled: Boolean(current.enabled),
    silentMode: Boolean(current.silentMode),
    lowPowerMode: Boolean(current.lowPowerMode),
    soundEnabled: Boolean(current.soundEnabled),
    vibrationEnabled: Boolean(current.vibrationEnabled),
    panelCollapsed: Boolean(current.panelCollapsed),
    rules: Array.isArray(current.rules)
      ? current.rules.map(normalizeAlertRule).filter(Boolean)
      : [],
    history: Array.isArray(current.history)
      ? current.history.map(normalizeAlertHistoryRecord).filter(Boolean).slice(-ALERT_HISTORY_LIMIT)
      : [],
    totalTriggered: Math.max(0, Number.isFinite(Number(current.totalTriggered)) ? Number(current.totalTriggered) : 0),
  };
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

function readLocalAlertEngine() {
  const raw = localStorage.getItem(ALERT_STORAGE_KEY);
  if (!raw) return buildDefaultAlertEngineState();
  try {
    return JSON.parse(raw);
  } catch {
    return buildDefaultAlertEngineState();
  }
}

async function readRemoteState() {
  try {
    const response = await fetch(STATE_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return {
      cards: Array.isArray(payload?.cards) ? payload.cards : [],
      alerts: payload?.alerts && typeof payload.alerts === "object" ? payload.alerts : null,
    };
  } catch {
    return null;
  }
}

function scheduleRemoteSave(cardsPayload = serializeCards(), alertsPayload = serializeAlertEngine()) {
  if (!isHttpOrigin()) return;
  if (state.remoteSaveTimer) clearTimeout(state.remoteSaveTimer);

  const snapshot = JSON.stringify({ cards: cardsPayload, alerts: alertsPayload });
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
  renderAlertWorkbench();
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

function renderAlertWorkbench() {
  if (!refs.alertWorkbench) return;

  const engine = state.alertEngine;
  const collapsed = Boolean(engine.panelCollapsed);
  refs.alertWorkbench.classList.toggle("is-collapsed", collapsed);
  refs.alertWorkbenchBody.hidden = collapsed;
  refs.alertCollapseBtn.textContent = collapsed ? "展开" : "收起";

  refs.alertCenterToggle.checked = Boolean(engine.enabled);
  refs.alertSilentToggle.checked = Boolean(engine.silentMode);
  refs.alertSoundToggle.checked = Boolean(engine.soundEnabled);
  refs.alertVibrationToggle.checked = Boolean(engine.vibrationEnabled);
  refs.alertLowPowerToggle.checked = Boolean(engine.lowPowerMode);

  renderAlertStats();
  renderAlertRuleForm();
  renderAlertRuleList();
  renderAlertHistoryList();

  const hasRules = engine.rules.length > 0;
  refs.alertToggleAllRulesBtn.disabled = !hasRules;
  refs.alertClearHistoryBtn.disabled = engine.history.length === 0;
  const shouldEnableAll = engine.rules.some((rule) => !rule.enabled);
  refs.alertToggleAllRulesBtn.textContent = hasRules
    ? shouldEnableAll
      ? "一键启用全部"
      : "一键禁用全部"
    : "一键启用/禁用";
}

function renderAlertStats() {
  const rules = Array.isArray(state.alertEngine.rules) ? state.alertEngine.rules : [];
  const history = Array.isArray(state.alertEngine.history) ? state.alertEngine.history : [];
  refs.alertRuleCount.textContent = String(rules.length);
  refs.alertEnabledRuleCount.textContent = String(rules.filter((item) => item.enabled).length);
  refs.alertTodayCount.textContent = String(countTodayAlerts(history));
  refs.alertTotalCount.textContent = String(
    Math.max(0, Number.isFinite(Number(state.alertEngine.totalTriggered)) ? Number(state.alertEngine.totalTriggered) : 0)
  );
}

function renderAlertRuleForm() {
  if (!refs.alertRuleForm) return;
  if (!refs.alertRuleCooldownSelect.options.length) {
    refs.alertRuleCooldownSelect.innerHTML = ALERT_COOLDOWN_OPTIONS.map(
      (item) => `<option value="${item.value}">${item.label}</option>`
    ).join("");
    refs.alertRuleCooldownSelect.value = String(ALERT_DEFAULT_COOLDOWN_MS);
  }

  const stockCards = state.cards.filter((card) => card.type === "stock");
  const previousCardId = refs.alertRuleCardSelect.value;
  refs.alertRuleCardSelect.innerHTML = stockCards
    .map(
      (card) =>
        `<option value="${escapeHtml(card.id)}">${escapeHtml(card.querySymbol || card.symbol || card.name)}</option>`
    )
    .join("");

  const hasStockCards = stockCards.length > 0;
  if (hasStockCards) {
    const hasPrevious = stockCards.some((card) => card.id === previousCardId);
    refs.alertRuleCardSelect.value = hasPrevious ? previousCardId : stockCards[0].id;
  }

  refs.alertRuleCardSelect.disabled = !hasStockCards;
  refs.alertRuleTypeSelect.disabled = !hasStockCards;
  refs.alertRuleCooldownSelect.disabled = !hasStockCards;
  const submitButton = refs.alertRuleForm.querySelector('[type="submit"]');
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = !hasStockCards;
  }

  const selectedType = ALERT_RULE_TYPES.has(refs.alertRuleTypeSelect.value)
    ? refs.alertRuleTypeSelect.value
    : "price";
  refs.alertRuleTypeSelect.value = selectedType;
  renderAlertRuleParams(selectedType, null, !hasStockCards);
}

function renderAlertRuleParams(type, params, disabled = false) {
  if (!refs.alertRuleParams) return;
  if (disabled) {
    refs.alertRuleParams.innerHTML = '<p class="status-text">暂无股票卡片，先创建股票卡片后再配置预警规则。</p>';
    return;
  }

  const normalized = normalizeAlertRuleParams(type, params);

  if (type === "price") {
    refs.alertRuleParams.innerHTML = `<label class="alert-inline-field">
        <span>方向</span>
        <select data-alert-param="direction">
          <option value="above" ${normalized.direction === "above" ? "selected" : ""}>高于阈值</option>
          <option value="below" ${normalized.direction === "below" ? "selected" : ""}>低于阈值</option>
        </select>
      </label>
      <label class="alert-inline-field">
        <span>价格</span>
        <input data-alert-param="price" type="number" inputmode="decimal" min="0" step="0.0001" value="${escapeHtml(
          String(normalized.price)
        )}" />
      </label>`;
    return;
  }

  if (type === "change") {
    refs.alertRuleParams.innerHTML = `<label class="alert-inline-field">
        <span>方向</span>
        <select data-alert-param="direction">
          <option value="both" ${normalized.direction === "both" ? "selected" : ""}>涨跌任一方向</option>
          <option value="up" ${normalized.direction === "up" ? "selected" : ""}>单日上涨</option>
          <option value="down" ${normalized.direction === "down" ? "selected" : ""}>单日下跌</option>
        </select>
      </label>
      <label class="alert-inline-field">
        <span>阈值 (%)</span>
        <input data-alert-param="percent" type="number" inputmode="decimal" min="0.1" step="0.1" value="${escapeHtml(
          String(normalized.percent)
        )}" />
      </label>`;
    return;
  }

  if (type === "ma_breakout") {
    refs.alertRuleParams.innerHTML = `<label class="alert-inline-field">
        <span>均线</span>
        <select data-alert-param="maKey">
          <option value="ma5" ${normalized.maKey === "ma5" ? "selected" : ""}>MA5</option>
          <option value="ma10" ${normalized.maKey === "ma10" ? "selected" : ""}>MA10</option>
          <option value="ma20" ${normalized.maKey === "ma20" ? "selected" : ""}>MA20</option>
        </select>
      </label>
      <label class="alert-inline-field">
        <span>方向</span>
        <select data-alert-param="direction">
          <option value="both" ${normalized.direction === "both" ? "selected" : ""}>上破或下破</option>
          <option value="up" ${normalized.direction === "up" ? "selected" : ""}>上破均线</option>
          <option value="down" ${normalized.direction === "down" ? "selected" : ""}>下破均线</option>
        </select>
      </label>`;
    return;
  }

  if (type === "macd_cross") {
    refs.alertRuleParams.innerHTML = `<label class="alert-inline-field">
      <span>信号</span>
      <select data-alert-param="signal">
        <option value="both" ${normalized.signal === "both" ? "selected" : ""}>金叉或死叉</option>
        <option value="golden" ${normalized.signal === "golden" ? "selected" : ""}>金叉</option>
        <option value="death" ${normalized.signal === "death" ? "selected" : ""}>死叉</option>
      </select>
    </label>`;
    return;
  }

  refs.alertRuleParams.innerHTML = `<label class="alert-inline-field">
      <span>区间</span>
      <select data-alert-param="zone">
        <option value="both" ${normalized.zone === "both" ? "selected" : ""}>超买或超卖</option>
        <option value="overbought" ${normalized.zone === "overbought" ? "selected" : ""}>超买 (RSI ≥ 70)</option>
        <option value="oversold" ${normalized.zone === "oversold" ? "selected" : ""}>超卖 (RSI ≤ 30)</option>
      </select>
    </label>`;
}

function renderAlertRuleList() {
  if (!refs.alertRuleList) return;
  const rules = state.alertEngine.rules || [];
  if (!rules.length) {
    refs.alertRuleList.innerHTML =
      '<p class="status-text">暂无预警规则。可以先添加价格阈值或 MA/MACD/RSI 规则。</p>';
    return;
  }

  refs.alertRuleList.innerHTML = rules
    .map((rule) => {
      const card = state.cards.find((item) => item.id === rule.cardId);
      const symbol = card?.querySymbol || card?.symbol || "未知标的";
      const lastTriggered = rule.lastTriggeredAt ? formatTime(rule.lastTriggeredAt) : "未触发";
      return `<article class="alert-rule-item ${rule.enabled ? "" : "is-disabled"}">
        <div class="alert-rule-main">
          <p class="alert-rule-title">${escapeHtml(symbol)} · ${escapeHtml(ALERT_RULE_TYPE_LABELS[rule.type] || rule.type)}</p>
          <p class="alert-rule-desc">${escapeHtml(describeAlertRule(rule))}</p>
          <p class="alert-rule-meta">冷却 ${escapeHtml(formatCooldown(rule.cooldownMs))} · 上次触发 ${escapeHtml(
        lastTriggered
      )}</p>
        </div>
        <div class="alert-rule-actions">
          <button type="button" class="btn btn-ghost" data-alert-action="toggle" data-rule-id="${escapeHtml(
            rule.id
          )}">${rule.enabled ? "停用" : "启用"}</button>
          <button type="button" class="btn btn-ghost" data-alert-action="delete" data-rule-id="${escapeHtml(
            rule.id
          )}">删除</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderAlertHistoryList() {
  if (!refs.alertHistoryList) return;
  const history = state.alertEngine.history || [];
  if (!history.length) {
    refs.alertHistoryList.innerHTML = '<p class="status-text">暂无历史通知。</p>';
    return;
  }

  refs.alertHistoryList.innerHTML = history
    .slice(0, 40)
    .map(
      (item) => `<article class="alert-history-item">
        <div>
          <p class="alert-history-title">${escapeHtml(item.title || "工作通知")}</p>
          <p class="alert-history-detail">${escapeHtml(item.detail || "--")}</p>
        </div>
        <p class="alert-history-time">${escapeHtml(formatRelativeTime(item.triggeredAt))}</p>
      </article>`
    )
    .join("");
}

function createAlertRuleFromForm() {
  const cardId = refs.alertRuleCardSelect.value;
  const card = state.cards.find((item) => item.id === cardId && item.type === "stock");
  if (!card) return;

  const type = ALERT_RULE_TYPES.has(refs.alertRuleTypeSelect.value) ? refs.alertRuleTypeSelect.value : "price";
  const params = collectAlertRuleParams(type);
  if (!params) return;

  const normalizedRule = normalizeAlertRule({
    id: crypto.randomUUID(),
    cardId,
    type,
    enabled: true,
    cooldownMs: parseAlertCooldown(refs.alertRuleCooldownSelect.value),
    params,
    lastTriggeredAt: 0,
    createdAt: Date.now(),
  });

  if (!normalizedRule) return;

  state.alertEngine.rules.unshift(normalizedRule);
  saveAlertEngine();
  renderAlertWorkbench();
}

function collectAlertRuleParams(type) {
  const root = refs.alertRuleParams;
  if (!root) return null;

  if (type === "price") {
    const direction = String(root.querySelector('[data-alert-param="direction"]')?.value || "above");
    const price = Number(root.querySelector('[data-alert-param="price"]')?.value);
    if (!Number.isFinite(price) || price <= 0) return null;
    return normalizeAlertRuleParams(type, { direction, price });
  }

  if (type === "change") {
    const direction = String(root.querySelector('[data-alert-param="direction"]')?.value || "both");
    const percent = Number(root.querySelector('[data-alert-param="percent"]')?.value);
    if (!Number.isFinite(percent) || percent <= 0) return null;
    return normalizeAlertRuleParams(type, { direction, percent });
  }

  if (type === "ma_breakout") {
    const direction = String(root.querySelector('[data-alert-param="direction"]')?.value || "both");
    const maKey = String(root.querySelector('[data-alert-param="maKey"]')?.value || "ma20");
    return normalizeAlertRuleParams(type, { direction, maKey });
  }

  if (type === "macd_cross") {
    const signal = String(root.querySelector('[data-alert-param="signal"]')?.value || "both");
    return normalizeAlertRuleParams(type, { signal });
  }

  const zone = String(root.querySelector('[data-alert-param="zone"]')?.value || "both");
  return normalizeAlertRuleParams(type, { zone });
}

function normalizeAlertRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  const type = ALERT_RULE_TYPES.has(rule.type) ? rule.type : null;
  const cardId = String(rule.cardId || "");
  if (!type || !cardId) return null;

  return {
    id: typeof rule.id === "string" && rule.id ? rule.id : crypto.randomUUID(),
    cardId,
    type,
    enabled: typeof rule.enabled === "boolean" ? rule.enabled : true,
    cooldownMs: parseAlertCooldown(rule.cooldownMs),
    params: normalizeAlertRuleParams(type, rule.params),
    lastTriggeredAt: Number.isFinite(Number(rule.lastTriggeredAt)) ? Number(rule.lastTriggeredAt) : 0,
    createdAt: Number.isFinite(Number(rule.createdAt)) ? Number(rule.createdAt) : Date.now(),
  };
}

function normalizeAlertRuleParams(type, rawParams) {
  const params = rawParams && typeof rawParams === "object" ? rawParams : {};
  if (type === "price") {
    const direction = params.direction === "below" ? "below" : "above";
    const price = Number(params.price);
    return {
      direction,
      price: Number.isFinite(price) && price > 0 ? Number(price.toFixed(4)) : 100,
    };
  }

  if (type === "change") {
    const direction = ["up", "down", "both"].includes(params.direction) ? params.direction : "both";
    const percent = Number(params.percent);
    return {
      direction,
      percent: Number.isFinite(percent) && percent > 0 ? Number(percent.toFixed(1)) : 3,
    };
  }

  if (type === "ma_breakout") {
    const direction = ["up", "down", "both"].includes(params.direction) ? params.direction : "both";
    const maKey = ALERT_MA_KEYS.has(params.maKey) ? params.maKey : "ma20";
    return {
      direction,
      maKey,
    };
  }

  if (type === "macd_cross") {
    const signal = ["golden", "death", "both"].includes(params.signal) ? params.signal : "both";
    return { signal };
  }

  const zone = ["overbought", "oversold", "both"].includes(params.zone) ? params.zone : "both";
  return { zone };
}

function parseAlertCooldown(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return ALERT_DEFAULT_COOLDOWN_MS;
  return Math.max(30 * 1000, Math.min(24 * 60 * 60 * 1000, Math.round(parsed)));
}

function normalizeAlertHistoryRecord(record) {
  if (!record || typeof record !== "object") return null;
  const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
  const ruleId = typeof record.ruleId === "string" ? record.ruleId : "";
  const cardId = typeof record.cardId === "string" ? record.cardId : "";
  const title = String(record.title || "");
  const detail = String(record.detail || "");
  const type = ALERT_RULE_TYPES.has(record.type) ? record.type : "price";
  const symbol = String(record.symbol || "");
  const triggeredAt = Number.isFinite(Number(record.triggeredAt)) ? Number(record.triggeredAt) : Date.now();
  return {
    id,
    ruleId,
    cardId,
    type,
    symbol,
    title,
    detail,
    triggeredAt,
  };
}

function describeAlertRule(rule) {
  if (!rule) return "";
  if (rule.type === "price") {
    return `价格${rule.params.direction === "below" ? "低于" : "高于"} ${formatNumber(rule.params.price, 2, 4)}`;
  }
  if (rule.type === "change") {
    const label =
      rule.params.direction === "up" ? "上涨超过" : rule.params.direction === "down" ? "下跌超过" : "涨跌幅超过";
    return `单日${label} ${formatNumber(rule.params.percent, 1, 1)}%`;
  }
  if (rule.type === "ma_breakout") {
    const direction =
      rule.params.direction === "up" ? "上破" : rule.params.direction === "down" ? "下破" : "上破/下破";
    return `价格${direction} ${String(rule.params.maKey || "ma20").toUpperCase()}`;
  }
  if (rule.type === "macd_cross") {
    if (rule.params.signal === "golden") return "MACD 金叉触发";
    if (rule.params.signal === "death") return "MACD 死叉触发";
    return "MACD 金叉/死叉触发";
  }
  if (rule.params.zone === "overbought") return "RSI 超买 (>= 70)";
  if (rule.params.zone === "oversold") return "RSI 超卖 (<= 30)";
  return "RSI 超买/超卖";
}

function formatCooldown(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return "--";
  if (value < 60 * 1000) return `${Math.round(value / 1000)} 秒`;
  if (value < 60 * 60 * 1000) return `${Math.round(value / (60 * 1000))} 分钟`;
  return `${Math.round(value / (60 * 60 * 1000))} 小时`;
}

function toggleAlertRule(ruleId) {
  state.alertEngine.rules = state.alertEngine.rules.map((rule) =>
    rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
  );
  saveAlertEngine();
  renderAlertWorkbench();
}

function deleteAlertRule(ruleId) {
  state.alertEngine.rules = state.alertEngine.rules.filter((rule) => rule.id !== ruleId);
  saveAlertEngine();
  renderAlertWorkbench();
}

function pruneAlertBindingsForCard(cardId) {
  state.alertEngine.rules = state.alertEngine.rules.filter((rule) => rule.cardId !== cardId);
  state.alertEngine.history = state.alertEngine.history.filter((item) => item.cardId !== cardId);
  delete state.alertRuntime.cardLastScanAt[cardId];
}

function monitorCardAlerts(card, previousQuote, previousTechnicals) {
  if (!card || card.type !== "stock") return;
  if (!state.alertEngine.enabled) return;

  const rules = state.alertEngine.rules.filter((rule) => rule.enabled && rule.cardId === card.id);
  if (!rules.length) return;

  const now = Date.now();
  if (!shouldRunAlertScan(card.id, now)) return;

  const context = {
    card,
    previousQuote,
    currentQuote: card.quote,
    previousTechnicals,
    currentTechnicals: card.technicals,
  };
  const triggered = [];

  rules.forEach((rule) => {
    const match = evaluateAlertRule(rule, context);
    if (!match) return;
    if (now - Number(rule.lastTriggeredAt || 0) < rule.cooldownMs) return;
    rule.lastTriggeredAt = now;
    const record = normalizeAlertHistoryRecord({
      id: crypto.randomUUID(),
      ruleId: rule.id,
      cardId: card.id,
      type: rule.type,
      symbol: card.querySymbol || card.symbol || card.name,
      title: match.title,
      detail: match.detail,
      triggeredAt: now,
    });
    if (record) triggered.push(record);
  });

  if (!triggered.length) return;

  state.alertEngine.totalTriggered = Math.max(
    0,
    Number(state.alertEngine.totalTriggered || 0) + triggered.length
  );
  state.alertEngine.history = [...triggered, ...state.alertEngine.history].slice(0, ALERT_HISTORY_LIMIT);
  emitAlertSignal();
  saveAlertEngine();
  renderAlertWorkbench();
}

function shouldRunAlertScan(cardId, now) {
  const minGap = state.alertEngine.lowPowerMode
    ? ALERT_LOW_POWER_SCAN_COOLDOWN_MS
    : ALERT_SCAN_COOLDOWN_MS;
  const lastScan = Number(state.alertRuntime.cardLastScanAt[cardId] || 0);
  if (minGap > 0 && now - lastScan < minGap) return false;
  state.alertRuntime.cardLastScanAt[cardId] = now;
  return true;
}

function evaluateAlertRule(rule, context) {
  if (rule.type === "price") return evaluatePriceRule(rule, context);
  if (rule.type === "change") return evaluateChangeRule(rule, context);
  if (rule.type === "ma_breakout") return evaluateMaBreakoutRule(rule, context);
  if (rule.type === "macd_cross") return evaluateMacdRule(rule, context);
  if (rule.type === "rsi_zone") return evaluateRsiRule(rule, context);
  return null;
}

function evaluatePriceRule(rule, context) {
  const threshold = Number(rule.params.price);
  const currentPrice = toFiniteNumber(context.currentQuote?.price);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(threshold)) return null;

  const previousPrice = toFiniteNumber(context.previousQuote?.price);
  const isAbove = currentPrice > threshold;
  const wasAbove = Number.isFinite(previousPrice) ? previousPrice > threshold : !isAbove;
  const isBelow = currentPrice < threshold;
  const wasBelow = Number.isFinite(previousPrice) ? previousPrice < threshold : !isBelow;

  if (rule.params.direction === "above") {
    if (!isAbove || wasAbove) return null;
    return {
      title: `${context.card.querySymbol || context.card.symbol} 价格上破阈值`,
      detail: `最新价 ${formatNumber(currentPrice, 2, 4)} 高于预设 ${formatNumber(threshold, 2, 4)}`,
    };
  }

  if (!isBelow || wasBelow) return null;
  return {
    title: `${context.card.querySymbol || context.card.symbol} 价格下破阈值`,
    detail: `最新价 ${formatNumber(currentPrice, 2, 4)} 低于预设 ${formatNumber(threshold, 2, 4)}`,
  };
}

function evaluateChangeRule(rule, context) {
  const threshold = Number(rule.params.percent);
  const currentPct = toFiniteNumber(context.currentQuote?.changePercent);
  if (!Number.isFinite(currentPct) || !Number.isFinite(threshold)) return null;

  const previousPct = toFiniteNumber(context.previousQuote?.changePercent);
  const currentMatch = isChangeDirectionMatched(currentPct, rule.params.direction, threshold);
  const previousMatch = Number.isFinite(previousPct)
    ? isChangeDirectionMatched(previousPct, rule.params.direction, threshold)
    : false;
  if (!currentMatch || previousMatch) return null;

  return {
    title: `${context.card.querySymbol || context.card.symbol} 涨跌幅触发`,
    detail: `当前单日涨跌幅 ${formatSigned(currentPct)}% 已超过 ${formatNumber(threshold, 1, 1)}%`,
  };
}

function evaluateMaBreakoutRule(rule, context) {
  const currentPrice = toFiniteNumber(context.currentQuote?.price);
  const previousPrice = toFiniteNumber(context.previousQuote?.price);
  const maKey = rule.params.maKey;
  const currentMa = toFiniteNumber(context.currentTechnicals?.ma?.[maKey]);
  const previousMa = toFiniteNumber(context.previousTechnicals?.ma?.[maKey]);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice)) return null;
  if (!Number.isFinite(currentMa) || !Number.isFinite(previousMa)) return null;

  const crossUp = previousPrice <= previousMa && currentPrice > currentMa;
  const crossDown = previousPrice >= previousMa && currentPrice < currentMa;
  if (rule.params.direction === "up" && !crossUp) return null;
  if (rule.params.direction === "down" && !crossDown) return null;
  if (rule.params.direction === "both" && !crossUp && !crossDown) return null;

  return {
    title: `${context.card.querySymbol || context.card.symbol} ${crossUp ? "上破" : "下破"} ${maKey.toUpperCase()}`,
    detail: `价格 ${formatNumber(currentPrice, 2, 4)}，${maKey.toUpperCase()} ${formatNumber(currentMa, 2, 4)}`,
  };
}

function evaluateMacdRule(rule, context) {
  const signal = String(context.currentTechnicals?.macdSignal || "");
  const previousSignal = String(context.previousTechnicals?.macdSignal || "");
  if (!signal || !previousSignal || signal === previousSignal) return null;

  const isGolden = signal === "金叉";
  const isDeath = signal === "死叉";
  if (!isGolden && !isDeath) return null;

  if (rule.params.signal === "golden" && !isGolden) return null;
  if (rule.params.signal === "death" && !isDeath) return null;

  return {
    title: `${context.card.querySymbol || context.card.symbol} MACD ${signal}`,
    detail: `DIF ${formatNumber(context.currentTechnicals?.macd?.dif, 3, 3)} / DEA ${formatNumber(
      context.currentTechnicals?.macd?.dea,
      3,
      3
    )}`,
  };
}

function evaluateRsiRule(rule, context) {
  const currentRsi = toFiniteNumber(context.currentTechnicals?.rsi14);
  if (!Number.isFinite(currentRsi)) return null;
  const previousRsi = toFiniteNumber(context.previousTechnicals?.rsi14);
  if (!Number.isFinite(previousRsi)) return null;
  const currentMatch = isRsiZoneMatched(currentRsi, rule.params.zone);
  const previousMatch = isRsiZoneMatched(previousRsi, rule.params.zone);
  if (!currentMatch || previousMatch) return null;

  const zone = currentRsi >= 70 ? "超买" : "超卖";
  return {
    title: `${context.card.querySymbol || context.card.symbol} RSI ${zone}`,
    detail: `RSI14 当前 ${formatNumber(currentRsi, 1, 1)}，进入 ${zone} 区间`,
  };
}

function isChangeDirectionMatched(changePercent, direction, threshold) {
  if (direction === "up") return changePercent >= threshold;
  if (direction === "down") return changePercent <= -threshold;
  return Math.abs(changePercent) >= threshold;
}

function isRsiZoneMatched(rsi, zone) {
  if (zone === "overbought") return rsi >= 70;
  if (zone === "oversold") return rsi <= 30;
  return rsi >= 70 || rsi <= 30;
}

function emitAlertSignal() {
  if (state.alertEngine.silentMode) return;

  if (state.alertEngine.soundEnabled) {
    playAlertTone();
  }

  if (state.alertEngine.vibrationEnabled && typeof navigator.vibrate === "function") {
    navigator.vibrate([80, 40, 80]);
  }
}

function playAlertTone() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 640;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 320);
  } catch {
    // Ignore media errors and keep silent.
  }
}

function countTodayAlerts(history) {
  if (!Array.isArray(history) || !history.length) return 0;
  const today = getDateKey(Date.now());
  return history.reduce((count, item) => {
    if (getDateKey(item.triggeredAt) === today) return count + 1;
    return count;
  }, 0);
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrNull(value) {
  return toFiniteNumber(value);
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
    const blocks = [];

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

    if (keyRows.length) {
      blocks.push(`<div class="stock-key-metrics">${keyRows.join("")}</div>`);
    }

    if (metaRows.length) {
      blocks.push(`<div class="stock-meta-metrics">${metaRows.join("")}</div>`);
    }

    if (card.permissions.showTechnicals) {
      blocks.push(buildTechnicalPanel(card.technicals));
    }

    metrics.innerHTML = blocks.filter(Boolean).join("");
  }

  if (card.permissions.showChart && card.history.length > 1) {
    chartWrap.hidden = false;
    const recentWindow = pickRecentWindowSeries(card.history, card.refreshInterval, 5 * 60 * 1000);
    const safeWindow = recentWindow.length ? recentWindow : card.history;
    const windowLow = Math.min(...safeWindow);
    const windowHigh = Math.max(...safeWindow);
    chartWrap.innerHTML = buildSparkline(card.history, neutralSeriesColor, {
      min: windowLow,
      max: windowHigh,
      minLabel: windowLow,
      maxLabel: windowHigh,
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

  const slotCount = Math.max(series.length, 1);
  const slotWidth = width / slotCount;
  const xAt = (index) => (index + 0.5) * slotWidth;

  const points = series
    .map((value, index) => {
      const x = xAt(index);
      const y = mapY(value);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const firstX = xAt(0).toFixed(2);
  const lastSeriesX = xAt(series.length - 1).toFixed(2);
  const areaPath = `M ${firstX} ${height - bottomPadding} L ${points} L ${lastSeriesX} ${height - bottomPadding} Z`;
  const referenceValue = Number(bounds.reference);
  const hasReference = Number.isFinite(referenceValue) && referenceValue >= min && referenceValue <= max;
  const referenceY = hasReference ? mapY(referenceValue).toFixed(2) : null;
  const currentValue = Number(bounds.current);
  const hasCurrent = Number.isFinite(currentValue) && currentValue >= min && currentValue <= max;
  const currentY = hasCurrent ? mapY(currentValue).toFixed(2) : null;
  const currentLabel = hasCurrent ? formatNumber(currentValue) : "";
  const lastX = Number(lastSeriesX);
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
  <div class="volume-chart-frame">
    <span class="volume-axis-spacer" aria-hidden="true"></span>
    <svg class="volume-bars" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="--bar-color:${color}">
      ${rects}
    </svg>
  </div>`;
}

function pickRecentWindowSeries(series, refreshIntervalMs, windowMs) {
  const list = Array.isArray(series) ? series.filter((value) => Number.isFinite(value)) : [];
  if (list.length <= 2) return list;

  const interval = Number.isFinite(Number(refreshIntervalMs)) ? Math.max(1000, Number(refreshIntervalMs)) : 10000;
  const count = Math.max(2, Math.ceil(windowMs / interval));
  return list.slice(-count);
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

function normalizeHistoricalBar(item) {
  if (!item || !item.date) return null;

  const close = numberOrNull(item.close);
  if (!Number.isFinite(close)) return null;

  return {
    date: String(item.date).slice(0, 10),
    open: numberOrNull(item.open),
    close,
    high: numberOrNull(item.high),
    low: numberOrNull(item.low),
    volume: numberOrNull(item.volume),
  };
}

function normalizeTechnicalSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;

  return {
    date: String(snapshot.date || ""),
    close: numberOrNull(snapshot.close),
    ma: {
      ma5: numberOrNull(snapshot.ma?.ma5),
      ma10: numberOrNull(snapshot.ma?.ma10),
      ma20: numberOrNull(snapshot.ma?.ma20),
    },
    macd: {
      dif: numberOrNull(snapshot.macd?.dif),
      dea: numberOrNull(snapshot.macd?.dea),
      histogram: numberOrNull(snapshot.macd?.histogram),
      previousHistogram: numberOrNull(snapshot.macd?.previousHistogram),
    },
    kdj: {
      k: numberOrNull(snapshot.kdj?.k),
      d: numberOrNull(snapshot.kdj?.d),
      j: numberOrNull(snapshot.kdj?.j),
      previousK: numberOrNull(snapshot.kdj?.previousK),
      previousD: numberOrNull(snapshot.kdj?.previousD),
      previousJ: numberOrNull(snapshot.kdj?.previousJ),
    },
    rsi14: numberOrNull(snapshot.rsi14),
    bias: String(snapshot.bias || ""),
    macdSignal: String(snapshot.macdSignal || ""),
    kdjSignal: String(snapshot.kdjSignal || ""),
    rsiSignal: String(snapshot.rsiSignal || ""),
  };
}

function shouldRefreshDailySeries(card) {
  if (!Array.isArray(card.dailySeries) || !card.dailySeries.length) return true;
  return Date.now() - Number(card.dailySeriesUpdatedAt || 0) >= DAILY_HISTORY_REFRESH_MS;
}

function mergeQuoteIntoDailySeries(series, quote) {
  const normalized = Array.isArray(series) ? series.map(normalizeHistoricalBar).filter(Boolean) : [];
  if (!quote || !Number.isFinite(Number(quote.price))) {
    return normalized.slice(-DAILY_HISTORY_DAYS);
  }

  const date = getDateKey(quote.timestamp);
  const price = Number(quote.price);
  const nextBar = {
    date,
    open: numberOrNull(quote.prevClose) ?? price,
    close: price,
    high: numberOrNull(quote.high) ?? price,
    low: numberOrNull(quote.low) ?? price,
    volume: numberOrNull(quote.volume),
  };

  if (!normalized.length) {
    return [nextBar];
  }

  const merged = [...normalized];
  const last = merged[merged.length - 1];
  if (last.date === date) {
    merged[merged.length - 1] = {
      ...last,
      ...nextBar,
      open: Number.isFinite(last.open) ? last.open : nextBar.open,
      high: pickExtreme("max", [last.high, nextBar.high, nextBar.close]),
      low: pickExtreme("min", [last.low, nextBar.low, nextBar.close]),
    };
    return merged.slice(-DAILY_HISTORY_DAYS);
  }

  if (date > last.date) {
    merged.push(nextBar);
  }

  return merged.slice(-DAILY_HISTORY_DAYS);
}

function buildTechnicalPanel(snapshot) {
  if (!snapshot || !snapshot.ma || !snapshot.macd || !snapshot.kdj) {
    return `<section class="technical-panel">
      <div class="technical-head">
        <span class="technical-title">技术面</span>
      </div>
      <p class="status-text">日线样本不足，暂时无法计算 MA / MACD / KDJ。</p>
    </section>`;
  }

  const tags = [
    buildTechnicalSignalTag(snapshot.bias, technicalToneForBias(snapshot.bias)),
    buildTechnicalSignalTag(snapshot.macdSignal, technicalToneForMacd(snapshot.macdSignal)),
    buildTechnicalSignalTag(snapshot.kdjSignal, technicalToneForKdj(snapshot.kdjSignal)),
  ]
    .filter(Boolean)
    .join("");

  return `<section class="technical-panel">
    <div class="technical-head">
      <span class="technical-title">技术面</span>
      <div class="technical-badges">${tags}</div>
    </div>
    <div class="technical-grid">
      <div class="technical-item">
        <span class="label">MA5 / MA10</span>
        <span class="value">${formatNumber(snapshot.ma.ma5)} / ${formatNumber(snapshot.ma.ma10)}</span>
      </div>
      <div class="technical-item">
        <span class="label">MA20</span>
        <span class="value">${formatNumber(snapshot.ma.ma20)}</span>
      </div>
      <div class="technical-item">
        <span class="label">MACD</span>
        <span class="value">${formatNumber(snapshot.macd.dif, 3, 3)} / ${formatNumber(
          snapshot.macd.dea,
          3,
          3
        )} / ${formatSignedFixed(snapshot.macd.histogram, 3)}</span>
      </div>
      <div class="technical-item">
        <span class="label">KDJ (9,3,3)</span>
        <span class="value">${formatNumber(snapshot.kdj.k, 1, 1)} / ${formatNumber(
          snapshot.kdj.d,
          1,
          1
        )} / ${formatNumber(snapshot.kdj.j, 1, 1)}</span>
      </div>
    </div>
    <div class="technical-foot">日线样本 ${escapeHtml(snapshot.date || "--")}</div>
  </section>`;
}

function buildTechnicalSignalTag(label, tone) {
  const text = String(label || "").trim();
  if (!text) return "";
  return `<span class="technical-badge ${tone}">${escapeHtml(text)}</span>`;
}

function technicalToneForBias(label) {
  if (label === "偏多") return "is-positive";
  if (label === "偏空") return "is-negative";
  return "is-neutral";
}

function technicalToneForMacd(label) {
  if (label === "金叉" || label === "红柱扩张" || label === "红柱收敛") return "is-positive";
  if (label === "死叉" || label === "绿柱扩张" || label === "绿柱收敛") return "is-negative";
  return "is-neutral";
}

function technicalToneForKdj(label) {
  if (label === "KDJ 金叉" || label === "KDJ 超卖" || label === "KDJ 偏强") return "is-positive";
  if (label === "KDJ 死叉" || label === "KDJ 超买" || label === "KDJ 偏弱") return "is-negative";
  return "is-neutral";
}

function computeTechnicalSnapshot(series) {
  const bars = Array.isArray(series) ? series.map(normalizeHistoricalBar).filter(Boolean) : [];
  const closes = bars.map((item) => item.close);
  if (closes.length < 20) return null;

  const ma = {
    ma5: calculateSma(closes, 5),
    ma10: calculateSma(closes, 10),
    ma20: calculateSma(closes, 20),
  };
  const macd = calculateMacdSnapshot(closes);
  const kdj = calculateKdjSnapshot(bars, 9);
  const rsi14 = calculateRsi(closes, 14);
  const close = closes[closes.length - 1];

  return {
    date: bars[bars.length - 1]?.date || "",
    close,
    ma,
    macd,
    kdj,
    rsi14,
    bias: summarizeTechnicalBias(close, ma, macd, kdj),
    macdSignal: describeMacdSignal(macd),
    kdjSignal: describeKdjSignal(kdj),
    rsiSignal: describeRsiSignal(rsi14),
  };
}

function summarizeTechnicalBias(close, ma, macd, kdj) {
  let score = 0;

  if (Number.isFinite(close) && Number.isFinite(ma.ma20)) {
    score += close >= ma.ma20 ? 1 : -1;
  }

  if (Number.isFinite(ma.ma5) && Number.isFinite(ma.ma20)) {
    score += ma.ma5 >= ma.ma20 ? 1 : -1;
  }

  if (Number.isFinite(macd.histogram)) {
    score += macd.histogram >= 0 ? 1 : -1;
  }

  if (Number.isFinite(kdj?.j)) {
    if (kdj.j >= 55) {
      score += 1;
    } else if (kdj.j <= 45) {
      score -= 1;
    }
  }

  if (score >= 2) return "偏多";
  if (score <= -2) return "偏空";
  return "震荡";
}

function describeMacdSignal(macd) {
  if (!macd || !Number.isFinite(macd.histogram)) return "样本不足";
  if (Number.isFinite(macd.previousHistogram)) {
    if (macd.histogram >= 0 && macd.previousHistogram < 0) return "金叉";
    if (macd.histogram < 0 && macd.previousHistogram >= 0) return "死叉";
    if (macd.histogram >= 0) {
      return macd.histogram >= macd.previousHistogram ? "红柱扩张" : "红柱收敛";
    }
    return macd.histogram <= macd.previousHistogram ? "绿柱扩张" : "绿柱收敛";
  }
  return macd.histogram >= 0 ? "红柱" : "绿柱";
}

function describeRsiSignal(value) {
  if (!Number.isFinite(value)) return "样本不足";
  if (value >= 70) return "超买";
  if (value <= 30) return "超卖";
  if (value >= 55) return "偏强";
  if (value <= 45) return "偏弱";
  return "中性";
}

function describeKdjSignal(kdj) {
  if (!kdj || !Number.isFinite(kdj.k) || !Number.isFinite(kdj.d) || !Number.isFinite(kdj.j)) {
    return "样本不足";
  }

  if (Number.isFinite(kdj.previousK) && Number.isFinite(kdj.previousD)) {
    if (kdj.previousK < kdj.previousD && kdj.k >= kdj.d) return "KDJ 金叉";
    if (kdj.previousK > kdj.previousD && kdj.k <= kdj.d) return "KDJ 死叉";
  }

  if (kdj.j >= 100 || (kdj.k >= 80 && kdj.d >= 80)) return "KDJ 超买";
  if (kdj.j <= 0 || (kdj.k <= 20 && kdj.d <= 20)) return "KDJ 超卖";
  if (kdj.k > kdj.d && kdj.j >= 50) return "KDJ 偏强";
  if (kdj.k < kdj.d && kdj.j <= 50) return "KDJ 偏弱";
  return "KDJ 中性";
}

function calculateKdjSnapshot(bars, period = 9) {
  if (!Array.isArray(bars) || bars.length < period) {
    return {
      k: null,
      d: null,
      j: null,
      previousK: null,
      previousD: null,
      previousJ: null,
    };
  }

  let k = 50;
  let d = 50;
  const points = [];

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    const close = numberOrNull(bar?.close);
    if (!Number.isFinite(close) || index + 1 < period) {
      points.push(null);
      continue;
    }

    const window = bars.slice(index + 1 - period, index + 1);
    const lows = window.map((item) => numberOrNull(item?.low)).filter((value) => Number.isFinite(value));
    const highs = window.map((item) => numberOrNull(item?.high)).filter((value) => Number.isFinite(value));
    if (!lows.length || !highs.length) {
      points.push(null);
      continue;
    }

    const llv = Math.min(...lows);
    const hhv = Math.max(...highs);
    const denominator = hhv - llv;
    const rsv = denominator <= 0 ? 50 : ((close - llv) / denominator) * 100;

    k = (2 * k + rsv) / 3;
    d = (2 * d + k) / 3;
    const j = 3 * k - 2 * d;
    points.push({ k, d, j });
  }

  let current = null;
  let previous = null;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (!points[index]) continue;
    if (!current) {
      current = points[index];
      continue;
    }
    previous = points[index];
    break;
  }

  return {
    k: numberOrNull(current?.k),
    d: numberOrNull(current?.d),
    j: numberOrNull(current?.j),
    previousK: numberOrNull(previous?.k),
    previousD: numberOrNull(previous?.d),
    previousJ: numberOrNull(previous?.j),
  };
}

function calculateSma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const window = values.slice(-period);
  const sum = window.reduce((acc, value) => acc + value, 0);
  return sum / period;
}

function calculateMacdSnapshot(values) {
  if (!Array.isArray(values) || values.length < 26) {
    return {
      dif: null,
      dea: null,
      histogram: null,
      previousHistogram: null,
    };
  }

  const ema12 = calculateEmaSeries(values, 12);
  const ema26 = calculateEmaSeries(values, 26);
  const difSeries = values.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return Number.isFinite(fast) && Number.isFinite(slow) ? fast - slow : null;
  });
  const deaSeries = calculateEmaSeries(
    difSeries.map((value) => (Number.isFinite(value) ? value : 0)),
    9
  );

  const dif = difSeries[difSeries.length - 1];
  const dea = deaSeries[deaSeries.length - 1];
  const previousDif = difSeries[difSeries.length - 2];
  const previousDea = deaSeries[deaSeries.length - 2];

  return {
    dif,
    dea,
    histogram: Number.isFinite(dif) && Number.isFinite(dea) ? (dif - dea) * 2 : null,
    previousHistogram:
      Number.isFinite(previousDif) && Number.isFinite(previousDea) ? (previousDif - previousDea) * 2 : null,
  };
}

function calculateEmaSeries(values, period) {
  if (!Array.isArray(values) || !values.length) return [];

  const multiplier = 2 / (period + 1);
  let prev = Number(values[0]);

  return values.map((value, index) => {
    const current = Number(value);
    if (!Number.isFinite(current)) return prev;
    if (index === 0 || !Number.isFinite(prev)) {
      prev = current;
      return current;
    }
    prev = current * multiplier + prev * (1 - multiplier);
    return prev;
  });
}

function calculateRsi(values, period) {
  if (!Array.isArray(values) || values.length <= period) return null;

  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) {
      gain += delta;
    } else {
      loss -= delta;
    }
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const nextGain = delta > 0 ? delta : 0;
    const nextLoss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + nextGain) / period;
    avgLoss = (avgLoss * (period - 1) + nextLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function getDateKey(timestamp) {
  const time = Number(timestamp);
  if (!Number.isFinite(time)) return new Date().toISOString().slice(0, 10);
  return new Date(time).toISOString().slice(0, 10);
}

function pickExtreme(mode, values) {
  const normalized = values.filter((value) => Number.isFinite(value));
  if (!normalized.length) return null;
  return mode === "min" ? Math.min(...normalized) : Math.max(...normalized);
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

function formatSignedFixed(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "--";
  const abs = Math.abs(value);
  const fixed = abs.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
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
