const STORAGE_KEY = "stock_dashboard_cards_v1";
const MAX_HISTORY_POINTS = 36;
const STATE_ENDPOINT = "/api/state";
const REMOTE_SAVE_DEBOUNCE_MS = 350;
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
const timeFormatterCache = {};

const defaultPermissions = {
  showPrice: true,
  showChange: true,
  showHighLow: true,
  showVolume: true,
  showTimestamp: true,
  showPnL: true,
  showChart: true,
  showVolumeChart: true,
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
  allowManualRefresh: "允许手动刷新",
  allowEdit: "允许编辑权限",
  allowDelete: "允许删除卡片",
  autoRefresh: "启用自动刷新",
};

const state = {
  cards: [],
  refreshTimer: null,
  remoteSaveTimer: null,
};

const refs = {
  grid: document.getElementById("cardGrid"),
  empty: document.getElementById("emptyState"),
  cardCount: document.getElementById("cardCount"),
  autoRefreshCount: document.getElementById("autoRefreshCount"),
  createCardBtn: document.getElementById("createCardBtn"),
  createDialog: document.getElementById("createDialog"),
  createForm: document.getElementById("createForm"),
  closeCreateDialog: document.getElementById("closeCreateDialog"),
  permissionDialog: document.getElementById("permissionDialog"),
  permissionForm: document.getElementById("permissionForm"),
  permissionCardId: document.getElementById("permissionCardId"),
  permissionContainer: document.getElementById("permissionContainer"),
  permissionRefreshInterval: document.getElementById("permissionRefreshInterval"),
  permissionCostInput: document.getElementById("permissionCostInput"),
  closePermissionDialog: document.getElementById("closePermissionDialog"),
  template: document.getElementById("cardTemplate"),
};

async function init() {
  bindEvents();
  await loadCards();
  render();
  startRefreshLoop();
}

function bindEvents() {
  refs.createCardBtn.addEventListener("click", () => refs.createDialog.showModal());
  refs.closeCreateDialog.addEventListener("click", () => refs.createDialog.close());
  refs.closePermissionDialog.addEventListener("click", () => refs.permissionDialog.close());

  refs.createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const symbolInput = document.getElementById("symbolInput");
    const nameInput = document.getElementById("nameInput");
    const refreshInterval = Number(document.getElementById("refreshInterval").value);
    const costPrice = parseOptionalNonNegative(document.getElementById("costInput").value);

    const symbol = symbolInput.value.trim();
    if (!symbol) return;

    const permissions = collectPermissions(refs.createForm);

    const card = {
      id: crypto.randomUUID(),
      type: "stock",
      symbol,
      querySymbol: toYahooSymbol(symbol),
      name: nameInput.value.trim() || symbol.toUpperCase(),
      refreshInterval,
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

    state.cards.unshift(card);
    saveCards();
    render();

    refs.createDialog.close();
    refs.createForm.reset();
    setDefaultPermissionChecks(refs.createForm);

    await refreshCard(card.id, true);
  });

  refs.permissionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const cardId = refs.permissionCardId.value;
    const card = state.cards.find((item) => item.id === cardId);
    if (!card) return;

    card.permissions = collectPermissions(refs.permissionForm);
    card.refreshInterval = Number(refs.permissionRefreshInterval.value);
    card.costPrice = parseOptionalNonNegative(refs.permissionCostInput.value);
    saveCards();
    render();
    refs.permissionDialog.close();
  });

  refs.grid.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

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

  setDefaultPermissionChecks(refs.createForm);
}

function setDefaultPermissionChecks(form) {
  Object.entries(defaultPermissions).forEach(([key, value]) => {
    const input = form.querySelector(`[data-permission="${key}"]`);
    if (input instanceof HTMLInputElement) input.checked = value;
  });
}

function collectPermissions(form) {
  const permissions = { ...defaultPermissions };
  Object.keys(permissions).forEach((key) => {
    const input = form.querySelector(`[data-permission="${key}"]`);
    if (input instanceof HTMLInputElement) {
      permissions[key] = input.checked;
    }
  });
  return permissions;
}

function openPermissionDialog(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;

  refs.permissionCardId.value = card.id;
  refs.permissionRefreshInterval.value = String(card.refreshInterval);
  refs.permissionCostInput.value = card.costPrice == null ? "" : card.costPrice.toFixed(4);
  refs.permissionContainer.innerHTML = "<legend>权限开关</legend>";

  Object.entries(permissionLabels).forEach(([key, label]) => {
    const row = document.createElement("label");
    row.innerHTML = `<input type="checkbox" data-permission="${key}" ${card.permissions[key] ? "checked" : ""}> ${label}`;
    refs.permissionContainer.appendChild(row);
  });

  refs.permissionDialog.showModal();
}

function startRefreshLoop() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(async () => {
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
      const marketState = getMarketSessionState(card.querySymbol, now);
      if (marketState.isOpen) {
        refreshTargets.push(card);
        return;
      }

      const nextStatus = `闭市中（${marketState.label}），开市后自动恢复`;
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

  const marketState = getMarketSessionState(card.querySymbol, Date.now());
  if (!marketState.isOpen) {
    card.status = `闭市中（${marketState.label}），开市后自动恢复`;
    saveCards();
    renderCard(card, { statusOnly: true });
    return;
  }

  card.isRefreshing = true;
  card.status = "刷新中...";
  renderCard(card, { statusOnly: true });

  try {
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
  if (!reasons.length) {
    throw new Error("未获取到行情");
  }

  throw new Error(reasons.join("；"));
}

function convertYahooQuote(quote) {
  const timestamp = quote.regularMarketTime ? quote.regularMarketTime * 1000 : Date.now();
  return {
    symbol: quote.symbol,
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
    high: quote.regularMarketDayHigh,
    low: quote.regularMarketDayLow,
    volume: quote.regularMarketVolume,
    currency: quote.currency || "",
    timestamp,
  };
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
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Ignore parse errors and keep generic status text.
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (!data || data.price == null) {
    throw new Error("本地代理未返回有效行情");
  }
  return data;
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

  // Migrate existing local data to server-side state when remote file is empty.
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
  return cards.map((card) => ({
    ...card,
    permissions: { ...defaultPermissions, ...(card.permissions || {}) },
    history: Array.isArray(card.history) ? card.history : [],
    volumeHistory: Array.isArray(card.volumeHistory) ? card.volumeHistory : [],
    prevCumulativeVolume:
      Number.isFinite(Number(card.prevCumulativeVolume)) ? Number(card.prevCumulativeVolume) : null,
    costPrice: parseOptionalNonNegative(card.costPrice),
    querySymbol: card.querySymbol || toYahooSymbol(card.symbol),
    status: card.status || "等待刷新",
    lastUpdatedAt: card.lastUpdatedAt || 0,
    isRefreshing: false,
  }));
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
  const actions = node.querySelector(".card-actions");
  const statusEl = node.querySelector(".status-text");

  symbolEl.textContent = card.querySymbol;
  nameEl.textContent = card.name;
  statusEl.textContent = card.status;

  if (statusOnly) {
    return;
  }

  actions.innerHTML = "";

  if (card.permissions.allowManualRefresh) {
    actions.appendChild(actionButton("刷新", "btn-soft", "refresh", card.id));
  }
  if (card.permissions.allowEdit) {
    actions.appendChild(actionButton("权限", "btn-soft", "edit", card.id));
  }
  if (card.permissions.allowDelete) {
    actions.appendChild(actionButton("删除", "btn-danger", "delete", card.id));
  }

  const quote = card.quote;
  if (!quote) {
    metrics.innerHTML = '<p class="status-text">暂无行情，点击刷新获取。</p>';
  } else {
    const rows = [];
    if (card.permissions.showPrice) {
      rows.push(metricItem("最新价", `${formatNumber(quote.price)} ${quote.currency || ""}`));
    }

    if (card.permissions.showChange) {
      const colorClass = quote.change >= 0 ? "up" : "down";
      rows.push(
        metricItem(
          "涨跌",
          `<span class="${colorClass}">${formatSigned(quote.change)} (${formatSigned(
            quote.changePercent
          )}%)</span>`
        )
      );
    }

    if (card.permissions.showHighLow) {
      rows.push(metricItem("当日高/低", `${formatNumber(quote.high)} / ${formatNumber(quote.low)}`));
    }

    if (card.permissions.showVolume) {
      rows.push(metricItem("成交量", formatCompact(quote.volume)));
    }

    if (card.permissions.showTimestamp) {
      rows.push(metricItem("更新时间", formatTime(quote.timestamp)));
    }

    if (card.permissions.showPnL) {
      rows.push(metricItem("盈亏比例", buildPnlRatioValue(quote.price, card.costPrice)));
      rows.push(
        metricItem(
          "成本价",
          card.costPrice == null ? "未设置" : `${formatNumber(card.costPrice, 4, 4)} ${quote.currency || ""}`
        )
      );
    }

    metrics.innerHTML = rows.join("");
  }

  if (card.permissions.showChart && card.history.length > 1) {
    chartWrap.hidden = false;
    chartWrap.innerHTML = buildSparkline(card.history, quote?.change >= 0 ? "#0f9b58" : "#db474a");
  } else if (!card.permissions.showChart) {
    chartWrap.hidden = true;
  } else {
    chartWrap.hidden = false;
    chartWrap.innerHTML = '<p class="status-text">行情曲线需要至少两次刷新数据。</p>';
  }

  if (card.permissions.showVolumeChart && card.volumeHistory.length > 1) {
    volumeWrap.hidden = false;
    volumeWrap.innerHTML = buildVolumeBars(card.volumeHistory, quote?.change >= 0 ? "#0f9b58" : "#db474a");
  } else if (!card.permissions.showVolumeChart) {
    volumeWrap.hidden = true;
  } else {
    volumeWrap.hidden = false;
    volumeWrap.innerHTML = '<p class="status-text">分时量图需要至少两次刷新数据。</p>';
  }
}

function actionButton(text, cls, action, cardId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn ${cls}`;
  button.dataset.action = action;
  button.dataset.cardId = cardId;
  button.textContent = text;
  return button;
}

function metricItem(label, value) {
  return `<div class="metric"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function buildSparkline(series, color) {
  const width = 300;
  const height = 68;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const spread = Math.max(max - min, 1e-6);

  const points = series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <polyline points="${points}" style="stroke:${color}"></polyline>
  </svg>`;
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

function toYahooSymbol(input) {
  const raw = input.trim().toUpperCase();

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
  if (!message) {
    return "未知错误";
  }
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
  const result = {
    weekday: 1,
    hour: 0,
    minute: 0,
  };

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

function parseOptionalNonNegative(input) {
  if (input == null || input === "") return null;
  const num = Number(input);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(4));
}

function buildPnlRatioValue(currentPrice, costPrice) {
  if (costPrice == null) {
    return "未设置成本价";
  }
  if (currentPrice == null || Number.isNaN(currentPrice)) {
    return "--";
  }
  const ratio = ((currentPrice - costPrice) / costPrice) * 100;
  const colorClass = ratio >= 0 ? "up" : "down";
  return `<span class="${colorClass}">${formatSigned(ratio)}%</span>`;
}

init().catch(() => {
  state.cards = [];
  render();
  startRefreshLoop();
});
