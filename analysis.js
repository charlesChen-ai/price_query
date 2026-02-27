const ANALYSIS_HISTORY_DAYS = 260;
const ANALYSIS_SEARCH_LIMIT = 10;
const PLAYBACK_INTERVAL_MS = 720;
const STRATEGY_STORAGE_KEY = "analysis_strategy_config_v1";
const coreUtils = window.DashboardCore || {};
const indicatorUtils = window.DashboardIndicatorCore || {};
const signalPolicyUtils = window.DashboardSignalPolicyCore || {};
const PRESET_BAR_COUNTS = {
  "3m": 60,
  "6m": 120,
  "1y": 250,
  max: Number.POSITIVE_INFINITY,
};

const STRATEGY_PRESETS = {
  hybrid: {
    label: "组合策略",
    description: "MA 趋势 + MACD + RSI 联合过滤",
    fields: [
      { key: "fastPeriod", label: "快线 MA", type: "number", min: 3, max: 40, step: 1 },
      { key: "slowPeriod", label: "慢线 MA", type: "number", min: 6, max: 120, step: 1 },
      { key: "entryRsi", label: "买入 RSI 下限", type: "number", min: 20, max: 80, step: 1 },
      { key: "exitRsi", label: "卖出 RSI 上限", type: "number", min: 20, max: 80, step: 1 },
      { key: "requireMacdCross", label: "必须出现 MACD 金叉", type: "checkbox" },
    ],
    defaults: {
      fastPeriod: 5,
      slowPeriod: 20,
      entryRsi: 48,
      exitRsi: 52,
      requireMacdCross: true,
    },
  },
  ma_cross: {
    label: "双均线交叉",
    description: "仅根据快慢均线金叉/死叉建仓和平仓",
    fields: [
      { key: "fastPeriod", label: "快线 MA", type: "number", min: 3, max: 40, step: 1 },
      { key: "slowPeriod", label: "慢线 MA", type: "number", min: 6, max: 150, step: 1 },
    ],
    defaults: {
      fastPeriod: 5,
      slowPeriod: 20,
    },
  },
  rsi_reversion: {
    label: "RSI 均值回归",
    description: "RSI 进入超卖区买入，回到上限区卖出",
    fields: [
      { key: "rsiPeriod", label: "RSI 周期", type: "number", min: 6, max: 30, step: 1 },
      { key: "buyRsi", label: "买入 RSI 阈值", type: "number", min: 10, max: 50, step: 1 },
      { key: "sellRsi", label: "卖出 RSI 阈值", type: "number", min: 50, max: 90, step: 1 },
      { key: "useTrendFilter", label: "启用 MA20 趋势过滤", type: "checkbox" },
    ],
    defaults: {
      rsiPeriod: 14,
      buyRsi: 30,
      sellRsi: 60,
      useTrendFilter: true,
    },
  },
  macd_cross: {
    label: "MACD 金叉死叉",
    description: "MACD 金叉买入、死叉卖出，可选 RSI 区间过滤",
    fields: [
      { key: "useRsiFilter", label: "启用 RSI 区间过滤", type: "checkbox" },
      { key: "rsiFloor", label: "RSI 下限", type: "number", min: 20, max: 60, step: 1 },
      { key: "rsiCeil", label: "RSI 上限", type: "number", min: 40, max: 85, step: 1 },
    ],
    defaults: {
      useRsiFilter: false,
      rsiFloor: 42,
      rsiCeil: 68,
    },
  },
  price_breakout: {
    label: "价格突破",
    description: "价格突破近期高点买入，跌破低点卖出，可选 MA20 过滤",
    fields: [
      { key: "breakoutPeriod", label: "突破窗口", type: "number", min: 5, max: 120, step: 1 },
      { key: "breakdownPeriod", label: "离场窗口", type: "number", min: 3, max: 80, step: 1 },
      { key: "useTrendFilter", label: "启用 MA20 趋势过滤", type: "checkbox" },
    ],
    defaults: {
      breakoutPeriod: 20,
      breakdownPeriod: 10,
      useTrendFilter: true,
    },
  },
};

const EXECUTION_CONFIG_FIELDS = [
  {
    key: "timeframe",
    label: "回测周期",
    type: "select",
    options: [
      { value: "day", label: "日线" },
      { value: "week", label: "周线" },
      { value: "month", label: "月线" },
    ],
  },
  { key: "positionSizePct", label: "单次仓位(%)", type: "number", min: 10, max: 100, step: 5 },
  { key: "maxHoldBars", label: "最长持仓周期", type: "number", min: 0, max: 260, step: 1 },
  { key: "stopLossPct", label: "止损阈值(%)", type: "number", min: 0, max: 80, step: 0.5 },
  { key: "takeProfitPct", label: "止盈阈值(%)", type: "number", min: 0, max: 200, step: 0.5 },
  { key: "feeBps", label: "手续费(bp)", type: "number", min: 0, max: 100, step: 0.5 },
  { key: "slippageBps", label: "滑点(bp)", type: "number", min: 0, max: 100, step: 0.5 },
  { key: "noSameBarReentry", label: "禁止同周期卖出后立即买回", type: "checkbox" },
];

const ANNUALIZATION_FACTOR = {
  day: 252,
  week: 52,
  month: 12,
};

const analysisState = {
  stockSuggestions: [],
  symbolMeta: null,
  rawBars: [],
  filteredBars: [],
  indicators: [],
  resampledBars: [],
  resampledIndicators: [],
  signals: [],
  trades: [],
  stats: null,
  backtestPending: false,
  backtestProgress: 0,
  backtestProgressText: "",
  backtestTaskId: 0,
  strategyConfig: getDefaultStrategyConfig(),
  currentIndex: 0,
  isPlaying: false,
  playbackTimer: null,
};

const analysisRefs = {
  controls: document.getElementById("analysisControls"),
  symbolInput: document.getElementById("analysisSymbolInput"),
  stockSuggestList: document.getElementById("analysisStockSuggestList"),
  preset: document.getElementById("analysisPreset"),
  startDate: document.getElementById("analysisStartDate"),
  endDate: document.getElementById("analysisEndDate"),
  status: document.getElementById("analysisStatus"),
  overview: document.getElementById("analysisOverview"),
  legend: document.getElementById("analysisLegend"),
  chart: document.getElementById("analysisChart"),
  timeline: document.getElementById("analysisTimeline"),
  timelineLabel: document.getElementById("analysisTimelineLabel"),
  timelineCount: document.getElementById("analysisTimelineCount"),
  prevBtn: document.getElementById("analysisPrevBtn"),
  playBtn: document.getElementById("analysisPlayBtn"),
  nextBtn: document.getElementById("analysisNextBtn"),
  playbackStep: document.getElementById("analysisPlaybackStep"),
  strategyForm: document.getElementById("analysisStrategyForm"),
  strategyType: document.getElementById("analysisStrategyType"),
  strategyParams: document.getElementById("analysisStrategyParams"),
  executionParams: document.getElementById("analysisExecutionParams"),
  strategyHint: document.getElementById("analysisStrategyHint"),
  strategyResetBtn: document.getElementById("analysisResetStrategyBtn"),
  snapshot: document.getElementById("analysisSnapshot"),
  backtest: document.getElementById("analysisBacktest"),
  exportButtons: Array.from(document.querySelectorAll("[data-export-type]")),
};

initAnalysis();

function initAnalysis() {
  hydrateStrategyConfig();
  bindAnalysisEvents();
  renderStrategyControls();
  syncCustomPresetDates();
  window.addEventListener("beforeunload", stopPlayback);
  hydrateQuerySymbol();
}

function bindAnalysisEvents() {
  const debouncedSuggest = debounce(async () => {
    await refreshAnalysisStockSuggestions(analysisRefs.symbolInput.value.trim());
  }, 220);

  analysisRefs.symbolInput.addEventListener("input", () => {
    void debouncedSuggest();
  });

  analysisRefs.symbolInput.addEventListener("change", () => {
    tryApplyAnalysisSuggestionMeta(analysisRefs.symbolInput.value.trim());
  });

  analysisRefs.controls.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadAnalysisWorkspace();
  });

  analysisRefs.preset.addEventListener("change", () => {
    if (!analysisState.rawBars.length) {
      syncCustomPresetDates();
      return;
    }
    applyPresetRange(true);
  });

  [analysisRefs.startDate, analysisRefs.endDate].forEach((input) => {
    input.addEventListener("change", () => {
      analysisRefs.preset.value = "custom";
      stopPlayback();
      void recomputeAnalysis(true);
    });
  });

  analysisRefs.timeline.addEventListener("input", () => {
    analysisState.currentIndex = Number(analysisRefs.timeline.value) || 0;
    renderAnalysis();
  });

  analysisRefs.prevBtn.addEventListener("click", () => {
    stepTimeline(-1);
  });

  analysisRefs.nextBtn.addEventListener("click", () => {
    stepTimeline(1);
  });

  analysisRefs.playBtn.addEventListener("click", () => {
    togglePlayback();
  });

  analysisRefs.playbackStep.addEventListener("change", () => {
    if (analysisState.isPlaying) {
      stopPlayback();
      startPlayback();
    }
  });

  if (analysisRefs.strategyType) {
    analysisRefs.strategyType.addEventListener("change", () => {
      const next = getDefaultStrategyConfig(analysisRefs.strategyType.value);
      analysisState.strategyConfig = sanitizeStrategyConfig({
        type: next.type,
        params: next.params,
        execution: analysisState.strategyConfig?.execution,
      });
      renderStrategyControls();
    });
  }

  if (analysisRefs.strategyForm) {
    analysisRefs.strategyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      applyStrategyFromForm();
    });
  }

  if (analysisRefs.strategyParams) {
    analysisRefs.strategyParams.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      syncStrategyFieldAvailability();
    });
  }

  if (analysisRefs.executionParams) {
    analysisRefs.executionParams.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      syncStrategyFieldAvailability();
    });
  }

  if (analysisRefs.strategyResetBtn) {
    analysisRefs.strategyResetBtn.addEventListener("click", () => {
      analysisState.strategyConfig = getDefaultStrategyConfig();
      renderStrategyControls();
      persistStrategyConfig();
      if (analysisState.rawBars.length) {
        stopPlayback();
        void recomputeAnalysis(false);
      }
    });
  }

  analysisRefs.exportButtons.forEach((button) => {
    button.addEventListener("click", () => {
      exportAnalysisCsv(button.dataset.exportType || "");
    });
  });
}

function hydrateStrategyConfig() {
  try {
    const raw = localStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) {
      analysisState.strategyConfig = getDefaultStrategyConfig();
      return;
    }
    analysisState.strategyConfig = sanitizeStrategyConfig(JSON.parse(raw));
  } catch {
    analysisState.strategyConfig = getDefaultStrategyConfig();
  }
}

function persistStrategyConfig() {
  try {
    localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(analysisState.strategyConfig));
  } catch {
    // Ignore local persistence errors.
  }
}

function renderStrategyControls() {
  if (!analysisRefs.strategyType || !analysisRefs.strategyParams || !analysisRefs.executionParams || !analysisRefs.strategyHint) {
    return;
  }

  if (!analysisRefs.strategyType.options.length) {
    analysisRefs.strategyType.innerHTML = Object.entries(STRATEGY_PRESETS)
      .map(([type, preset]) => `<option value="${type}">${escapeHtml(preset.label)}</option>`)
      .join("");
  }

  const normalized = sanitizeStrategyConfig(analysisState.strategyConfig);
  analysisState.strategyConfig = normalized;
  analysisRefs.strategyType.value = normalized.type;

  const preset = STRATEGY_PRESETS[normalized.type];
  analysisRefs.strategyParams.innerHTML = renderConfigFields(preset.fields, normalized.params, "data-strategy-param");
  analysisRefs.executionParams.innerHTML = renderConfigFields(
    EXECUTION_CONFIG_FIELDS,
    normalized.execution,
    "data-execution-param"
  );
  syncStrategyFieldAvailability();

  analysisRefs.strategyHint.textContent = `${preset.description} · ${describeStrategyConfig(normalized)}`;
}

function applyStrategyFromForm() {
  if (!analysisRefs.strategyType || !analysisRefs.strategyParams || !analysisRefs.executionParams) return;
  const type = analysisRefs.strategyType.value;
  const preset = STRATEGY_PRESETS[type] || STRATEGY_PRESETS.hybrid;
  const rawParams = parseConfigFields(analysisRefs.strategyParams, preset.fields, "data-strategy-param");
  const rawExecution = parseConfigFields(analysisRefs.executionParams, EXECUTION_CONFIG_FIELDS, "data-execution-param");

  analysisState.strategyConfig = sanitizeStrategyConfig({ type, params: rawParams, execution: rawExecution });
  persistStrategyConfig();
  renderStrategyControls();

  if (analysisState.rawBars.length) {
    stopPlayback();
    void recomputeAnalysis(false);
  }
}

function renderConfigFields(fields, values, dataKey) {
  return fields
    .map((field) => {
      const value = values?.[field.key];
      const escapedKey = escapeHtml(field.key);
      if (field.type === "checkbox") {
        return `<label class="analysis-check-field">
          <input type="checkbox" ${dataKey}="${escapedKey}" ${value ? "checked" : ""} />
          <span>${escapeHtml(field.label)}</span>
        </label>`;
      }

      if (field.type === "select") {
        const options = Array.isArray(field.options)
          ? field.options
              .map((option) => {
                const optionValue = String(option.value);
                const selected = String(value ?? "") === optionValue ? "selected" : "";
                return `<option value="${escapeHtml(optionValue)}" ${selected}>${escapeHtml(option.label)}</option>`;
              })
              .join("")
          : "";
        return `<label class="analysis-field">
          <span>${escapeHtml(field.label)}</span>
          <select ${dataKey}="${escapedKey}">${options}</select>
        </label>`;
      }

      return `<label class="analysis-field">
        <span>${escapeHtml(field.label)}</span>
        <input
          type="number"
          ${dataKey}="${escapedKey}"
          min="${field.min}"
          max="${field.max}"
          step="${field.step || 1}"
          value="${Number.isFinite(Number(value)) ? Number(value) : ""}"
        />
      </label>`;
    })
    .join("");
}

function parseConfigFields(container, fields, dataKey) {
  const raw = {};
  fields.forEach((field) => {
    const selector = `[${dataKey}="${field.key}"]`;
    const input = container.querySelector(selector);
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    if (field.type === "checkbox") {
      raw[field.key] = input.checked;
      return;
    }
    if (field.type === "select") {
      raw[field.key] = String(input.value || "");
      return;
    }
    raw[field.key] = Number(input.value);
  });
  return raw;
}

function syncStrategyFieldAvailability() {
  if (!analysisRefs.strategyType || !analysisRefs.strategyParams || !analysisRefs.executionParams) return;
  const type = analysisRefs.strategyType.value;
  if (type === "macd_cross") {
    const toggle = analysisRefs.strategyParams.querySelector('[data-strategy-param="useRsiFilter"]');
    const enabled = toggle instanceof HTMLInputElement ? toggle.checked : false;
    ["rsiFloor", "rsiCeil"].forEach((key) => {
      const input = analysisRefs.strategyParams.querySelector(`[data-strategy-param="${key}"]`);
      if (input instanceof HTMLInputElement) {
        input.disabled = !enabled;
      }
    });
  }
}

function hydrateQuerySymbol() {
  const url = new URL(window.location.href);
  const symbol = (url.searchParams.get("symbol") || "").trim();
  if (!symbol) return;
  analysisRefs.symbolInput.value = symbol;
  void loadAnalysisWorkspace();
}

async function refreshAnalysisStockSuggestions(query) {
  if (!query || !isHttpOrigin()) {
    clearAnalysisStockSuggestions();
    return;
  }

  const items = await fetchAnalysisStockSuggestions(query, ANALYSIS_SEARCH_LIMIT);
  analysisState.stockSuggestions = items;
  analysisRefs.stockSuggestList.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code || "";
    option.label = `${item.name || ""} · ${item.querySymbol || item.code || ""}`;
    analysisRefs.stockSuggestList.appendChild(option);
  });
}

async function fetchAnalysisStockSuggestions(query, limit) {
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

function clearAnalysisStockSuggestions() {
  analysisState.stockSuggestions = [];
  analysisRefs.stockSuggestList.innerHTML = "";
}

function tryApplyAnalysisSuggestionMeta(input) {
  if (!input) return;
  const lower = input.toLowerCase();
  const matched = analysisState.stockSuggestions.find(
    (item) =>
      String(item.code || "").toLowerCase() === lower ||
      String(item.name || "").toLowerCase() === lower ||
      String(item.querySymbol || "").toLowerCase() === lower
  );
  if (!matched) return;
  analysisRefs.symbolInput.value = matched.code || input;
}

async function loadAnalysisWorkspace() {
  const rawInput = analysisRefs.symbolInput.value.trim();
  if (!rawInput) {
    setAnalysisStatus("请输入股票代码或名称。");
    return;
  }

  stopPlayback();
  setAnalysisStatus(`正在加载 ${rawInput} 的历史数据...`);

  const resolved = await resolveAnalysisStockIdentity(rawInput);
  if (!resolved) {
    setAnalysisStatus("未找到对应股票，请输入更准确的代码或名称。");
    return;
  }

  try {
    const payload = await fetchAnalysisHistory(resolved.querySymbol || resolved.code || rawInput);
    const items = Array.isArray(payload?.items) ? payload.items.map(normalizeHistoricalBar).filter(Boolean) : [];
    if (!items.length) {
      throw new Error("历史数据为空");
    }

    analysisState.symbolMeta = {
      code: resolved.code || rawInput.toUpperCase(),
      name: resolved.name || payload?.name || rawInput.toUpperCase(),
      querySymbol: resolved.querySymbol || payload?.symbol || toYahooSymbol(rawInput),
      source: payload?.source || "",
    };
    analysisState.rawBars = items.sort((left, right) => left.date.localeCompare(right.date));
    applyPresetRange(true);

    const url = new URL(window.location.href);
    url.searchParams.set("symbol", analysisState.symbolMeta.code);
    window.history.replaceState({}, "", url);

    setAnalysisStatus(
      `${analysisState.symbolMeta.name} · ${analysisState.symbolMeta.querySymbol} · ${analysisState.rawBars.length} 条日线样本`
    );
  } catch (error) {
    resetAnalysisWorkspace();
    setAnalysisStatus(`加载失败：${normalizeErrorMessage(error)}`);
  }
}

function resetAnalysisWorkspace() {
  analysisState.rawBars = [];
  analysisState.filteredBars = [];
  analysisState.indicators = [];
  analysisState.resampledBars = [];
  analysisState.resampledIndicators = [];
  analysisState.signals = [];
  analysisState.trades = [];
  analysisState.stats = null;
  analysisState.backtestPending = false;
  analysisState.backtestProgress = 0;
  analysisState.backtestProgressText = "";
  analysisState.backtestTaskId += 1;
  analysisState.currentIndex = 0;
  renderAnalysis();
}

async function resolveAnalysisStockIdentity(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return null;

  const lower = input.toLowerCase();
  const matched = analysisState.stockSuggestions.find(
    (item) =>
      String(item.code || "").toLowerCase() === lower ||
      String(item.name || "").toLowerCase() === lower ||
      String(item.querySymbol || "").toLowerCase() === lower
  );
  if (matched) return matched;

  if (!isHttpOrigin()) {
    return {
      code: input.toUpperCase(),
      name: input.toUpperCase(),
      querySymbol: toYahooSymbol(input),
    };
  }

  const suggestions = await fetchAnalysisStockSuggestions(input, 8);
  if (suggestions.length) {
    return pickBestAnalysisSuggestion(input, suggestions);
  }

  const codeLike =
    /^\d{6}$/.test(input) ||
    /^\d{6}\.(SH|SS|SZ)$/i.test(input) ||
    /^(SH|SZ)\d{6}$/i.test(input) ||
    /^[A-Za-z]{1,5}$/.test(input) ||
    /^\d{4,5}\.HK$/i.test(input);
  if (!codeLike) return null;

  return {
    code: input.toUpperCase(),
    name: input.toUpperCase(),
    querySymbol: toYahooSymbol(input),
  };
}

function pickBestAnalysisSuggestion(input, suggestions) {
  const normalized = input.trim().toLowerCase();
  const exact = suggestions.find((item) => {
    const code = String(item.code || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    const symbol = String(item.querySymbol || "").toLowerCase();
    return code === normalized || name === normalized || symbol === normalized;
  });
  return exact || suggestions[0];
}

async function fetchAnalysisHistory(symbol) {
  const response = await fetch(
    `/api/stock/history?symbol=${encodeURIComponent(symbol)}&days=${ANALYSIS_HISTORY_DAYS}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    let message = `历史接口错误 ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      // Keep generic message.
    }
    throw new Error(message);
  }
  return response.json();
}

function applyPresetRange(resetCurrentIndex) {
  const bars = analysisState.rawBars;
  if (!bars.length) {
    syncCustomPresetDates();
    return;
  }

  const preset = analysisRefs.preset.value;
  if (preset === "custom") {
    void recomputeAnalysis(resetCurrentIndex);
    return;
  }

  const count = PRESET_BAR_COUNTS[preset] || PRESET_BAR_COUNTS["6m"];
  const startIndex = Number.isFinite(count) ? Math.max(0, bars.length - count) : 0;
  analysisRefs.startDate.value = bars[startIndex]?.date || bars[0].date;
  analysisRefs.endDate.value = bars[bars.length - 1]?.date || bars[0].date;
  void recomputeAnalysis(resetCurrentIndex);
}

function syncCustomPresetDates() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 180);
  analysisRefs.startDate.value = start.toISOString().slice(0, 10);
  analysisRefs.endDate.value = end;
}

async function recomputeAnalysis(resetCurrentIndex) {
  const start = analysisRefs.startDate.value || "";
  const end = analysisRefs.endDate.value || "";
  const bars = analysisState.rawBars.filter((item) => {
    if (start && item.date < start) return false;
    if (end && item.date > end) return false;
    return true;
  });

  analysisState.filteredBars = bars;
  analysisState.indicators = computeIndicatorSeries(bars);
  analysisState.resampledBars = [];
  analysisState.resampledIndicators = [];
  analysisState.signals = [];
  analysisState.trades = [];
  analysisState.stats = null;
  analysisState.backtestPending = bars.length > 0;
  analysisState.backtestProgress = bars.length > 0 ? 3 : 0;
  analysisState.backtestProgressText = bars.length > 0 ? "准备回测数据..." : "";
  const taskId = ++analysisState.backtestTaskId;

  if (resetCurrentIndex) {
    analysisState.currentIndex = Math.max(0, bars.length - 1);
  } else {
    analysisState.currentIndex = Math.min(analysisState.currentIndex, Math.max(0, bars.length - 1));
  }

  if (!bars.length && analysisState.rawBars.length) {
    setAnalysisStatus("当前筛选区间没有日线数据，请调整开始或结束日期。");
  } else if (bars.length && analysisState.symbolMeta) {
    setAnalysisStatus(
      `${analysisState.symbolMeta.name} · ${analysisState.symbolMeta.querySymbol} · 当前区间 ${bars[0].date} 至 ${
        bars[bars.length - 1].date
      }`
    );
  }

  renderAnalysis();

  if (!bars.length) return;
  try {
    await runBacktestForRange(taskId, bars, analysisState.strategyConfig);
  } catch (error) {
    if (taskId !== analysisState.backtestTaskId) return;
    analysisState.backtestPending = false;
    analysisState.backtestProgressText = "回测失败";
    analysisRefs.backtest.className = "analysis-backtest-empty";
    analysisRefs.backtest.textContent = `回测失败：${normalizeErrorMessage(error)}`;
  }
}

async function runBacktestForRange(taskId, bars, strategyConfigInput) {
  const strategyConfig = sanitizeStrategyConfig(strategyConfigInput);
  const cycle = strategyConfig.execution.timeframe;
  const sampledBars = resampleBarsByTimeframe(bars, cycle);
  const sampledIndicators = computeIndicatorSeries(sampledBars);
  if (taskId !== analysisState.backtestTaskId) return;

  analysisState.resampledBars = sampledBars;
  analysisState.resampledIndicators = sampledIndicators;

  const backtest = await runBacktest(sampledBars, sampledIndicators, strategyConfig, ({ progress, text }) => {
    if (taskId !== analysisState.backtestTaskId) return;
    analysisState.backtestPending = true;
    analysisState.backtestProgress = progress;
    analysisState.backtestProgressText = text;
    renderBacktest();
  });
  if (taskId !== analysisState.backtestTaskId) return;

  analysisState.signals = mapSignalsToRange(backtest.signals, bars);
  analysisState.trades = backtest.trades;
  analysisState.stats = backtest.stats;
  analysisState.backtestPending = false;
  analysisState.backtestProgress = 100;
  analysisState.backtestProgressText = "回测完成";
  renderAnalysis();
}

function mapSignalsToRange(signals, timelineBars) {
  if (!Array.isArray(signals) || !signals.length || !Array.isArray(timelineBars) || !timelineBars.length) return [];

  const dateToIndex = new Map();
  timelineBars.forEach((bar, index) => {
    dateToIndex.set(bar.date, index);
  });

  return signals
    .map((signal) => {
      let index = dateToIndex.get(signal.date);
      if (!Number.isFinite(index)) {
        index = findNearestIndexByDate(timelineBars, signal.date);
      }
      if (!Number.isFinite(index) || index < 0 || index >= timelineBars.length) return null;
      const aligned = timelineBars[index];
      return {
        ...signal,
        index,
        price: Number.isFinite(signal.price) ? signal.price : aligned.close,
      };
    })
    .filter(Boolean);
}

function renderAnalysis() {
  renderOverview();
  renderLegend();
  renderChart();
  renderTimeline();
  renderSnapshot();
  renderBacktest();
  syncExportButtons();
}

function renderOverview() {
  const bars = analysisState.filteredBars;
  const current = bars[analysisState.currentIndex] || null;
  if (!bars.length || !current) {
    analysisRefs.overview.innerHTML = "";
    return;
  }

  const firstClose = bars[0]?.close;
  const latestClose = current.close;
  const rangeReturn = Number.isFinite(firstClose) && Number.isFinite(latestClose)
    ? ((latestClose - firstClose) / firstClose) * 100
    : null;
  const currentIndicator = analysisState.indicators[analysisState.currentIndex] || null;

  analysisRefs.overview.innerHTML = [
    buildOverviewMetric("标的", escapeHtml(analysisState.symbolMeta?.name || "--")),
    buildOverviewMetric("区间", `${escapeHtml(bars[0].date)} 至 ${escapeHtml(current.date)}`),
    buildOverviewMetric("样本", `${bars.length} 日`),
    buildOverviewMetric("区间收益", formatSigned(rangeReturn) + "%"),
    buildOverviewMetric("最新收盘", formatNumber(latestClose)),
    buildOverviewMetric("技术偏向", escapeHtml(currentIndicator?.bias || "样本不足")),
  ].join("");
}

function renderLegend() {
  const periods = getChartMaPeriods();
  const signalLegend = getSignalLegendByStrategy(analysisState.strategyConfig);
  analysisRefs.legend.innerHTML = [
    legendItem("收盘", "is-close"),
    legendItem(`MA${periods.fast}`, "is-fast"),
    legendItem(`MA${periods.slow}`, "is-slow"),
    legendItem(signalLegend.buyLabel, "is-buy", signalLegend.buyHint),
    legendItem(signalLegend.sellLabel, "is-sell", signalLegend.sellHint),
  ].join("");
}

function getChartMaPeriods() {
  const config = sanitizeStrategyConfig(analysisState.strategyConfig);
  if (config.type === "hybrid" || config.type === "ma_cross") {
    return {
      fast: Number(config.params.fastPeriod) || 5,
      slow: Number(config.params.slowPeriod) || 20,
    };
  }
  return { fast: 5, slow: 20 };
}

function getSignalLegendByStrategy(configInput) {
  const config = sanitizeStrategyConfig(configInput);
  const params = config.params || {};

  if (config.type === "ma_cross") {
    return {
      buyLabel: "买点标记(MA)",
      sellLabel: "卖点标记(MA)",
      buyHint: `MA${params.fastPeriod} 上穿 MA${params.slowPeriod}`,
      sellHint: `MA${params.fastPeriod} 下穿 MA${params.slowPeriod}`,
    };
  }

  if (config.type === "rsi_reversion") {
    return {
      buyLabel: "买点标记(RSI)",
      sellLabel: "卖点标记(RSI)",
      buyHint: `RSI${params.rsiPeriod} <= ${params.buyRsi}${params.useTrendFilter ? "，并满足 MA20 过滤" : ""}`,
      sellHint: `RSI${params.rsiPeriod} >= ${params.sellRsi}${params.useTrendFilter ? " 或 MA20 走弱" : ""}`,
    };
  }

  if (config.type === "macd_cross") {
    return {
      buyLabel: "买点标记(MACD)",
      sellLabel: "卖点标记(MACD)",
      buyHint: `MACD 金叉${params.useRsiFilter ? `，且 RSI 在 ${params.rsiFloor}-${params.rsiCeil}` : ""}`,
      sellHint: `MACD 死叉${params.useRsiFilter ? `，或 RSI > ${params.rsiCeil}` : ""}`,
    };
  }

  return {
    buyLabel: "买点标记(复合)",
    sellLabel: "卖点标记(复合)",
    buyHint: `MA${params.fastPeriod} 上穿 MA${params.slowPeriod} / MACD 金叉，RSI >= ${params.entryRsi}${
      params.requireMacdCross ? "（需 MACD 确认）" : ""
    }`,
    sellHint: `MA${params.fastPeriod} 下穿 MA${params.slowPeriod} / MACD 死叉 / RSI <= ${params.exitRsi}`,
  };
}

function renderChart() {
  const bars = analysisState.filteredBars;
  if (!bars.length) {
    analysisRefs.chart.className = "analysis-chart-empty";
    analysisRefs.chart.textContent = "加载后展示区间价格、均线和策略信号。";
    return;
  }

  const width = 860;
  const height = 320;
  const padding = { top: 18, right: 14, bottom: 28, left: 14 };
  const drawableWidth = width - padding.left - padding.right;
  const drawableHeight = height - padding.top - padding.bottom;
  const closes = bars.map((bar) => bar.close);
  const periods = getChartMaPeriods();
  const maFastSeries = calculateSmaSeries(closes, periods.fast);
  const maSlowSeries = calculateSmaSeries(closes, periods.slow);
  const values = bars.flatMap((bar, index) => {
    return [bar.close, bar.high, bar.low, maFastSeries[index], maSlowSeries[index]].filter((value) =>
      Number.isFinite(value)
    );
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1e-6);
  const mapX = (index) => padding.left + (bars.length === 1 ? drawableWidth / 2 : (index / (bars.length - 1)) * drawableWidth);
  const mapY = (value) => padding.top + (1 - (value - min) / spread) * drawableHeight;

  const buildPath = (series) =>
    series
      .map((value, index) => {
        if (!Number.isFinite(value)) return null;
        const prefix = index === 0 || !Number.isFinite(series[index - 1]) ? "M" : "L";
        return `${prefix}${mapX(index).toFixed(2)},${mapY(value).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(" ");

  const closePath = buildPath(closes);
  const ma5Path = buildPath(maFastSeries);
  const ma20Path = buildPath(maSlowSeries);
  const current = bars[analysisState.currentIndex];
  const currentX = mapX(analysisState.currentIndex).toFixed(2);
  const currentY = mapY(current.close).toFixed(2);

  const signalMarkerOrder = new Map();
  const signalMarkers = analysisState.signals
    .map((signal) => {
      const key = `${signal.index}:${signal.type}`;
      const sameSlotCount = signalMarkerOrder.get(key) || 0;
      signalMarkerOrder.set(key, sameSlotCount + 1);
      const x = mapX(signal.index) + sameSlotCount * 6 - 3;
      const y = mapY(signal.price);
      const points =
        signal.type === "buy"
          ? `${x.toFixed(2)},${(y - 6).toFixed(2)} ${(x - 5).toFixed(2)},${(y + 4).toFixed(2)} ${(x + 5).toFixed(
              2
            )},${(y + 4).toFixed(2)}`
          : `${x.toFixed(2)},${(y + 6).toFixed(2)} ${(x - 5).toFixed(2)},${(y - 4).toFixed(2)} ${(x + 5).toFixed(
              2
            )},${(y - 4).toFixed(2)}`;
      return `<polygon class="analysis-signal-marker ${signal.type === "buy" ? "is-buy" : "is-sell"}" points="${points}">
        <title>${escapeHtml(signal.label)} · ${escapeHtml(signal.sourceIndicator || "Strategy")} · ${escapeHtml(
          signal.date
        )} · ${escapeHtml(signal.reason)}</title>
      </polygon>`;
    })
    .join("");

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padding.top + drawableHeight * ratio;
      return `<line class="analysis-chart-grid" x1="${padding.left}" y1="${y.toFixed(2)}" x2="${(
        width - padding.right
      ).toFixed(2)}" y2="${y.toFixed(2)}"></line>`;
    })
    .join("");

  analysisRefs.chart.className = "analysis-chart";
  analysisRefs.chart.innerHTML = `<div class="analysis-chart-stage">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="历史价格与策略信号图">
      ${gridLines}
      <path class="analysis-line analysis-line-close" d="${closePath}"></path>
      <path class="analysis-line analysis-line-fast" d="${ma5Path}"></path>
      <path class="analysis-line analysis-line-slow" d="${ma20Path}"></path>
      ${signalMarkers}
      <line class="analysis-selection-line" x1="${currentX}" y1="${padding.top}" x2="${currentX}" y2="${(
        height - padding.bottom
      ).toFixed(2)}"></line>
      <circle class="analysis-selection-dot" cx="${currentX}" cy="${currentY}" r="4"></circle>
      <text class="analysis-chart-label analysis-chart-label-start" x="${padding.left}" y="${(height - 8).toFixed(
        2
      )}">${escapeHtml(bars[0].date)}</text>
      <text class="analysis-chart-label analysis-chart-label-end" x="${(width - padding.right).toFixed(
        2
      )}" y="${(height - 8).toFixed(2)}" text-anchor="end">${escapeHtml(bars[bars.length - 1].date)}</text>
      <text class="analysis-chart-label" x="${(width - padding.right).toFixed(2)}" y="${padding.top.toFixed(
        2
      )}" text-anchor="end">${escapeHtml(formatNumber(max))}</text>
      <text class="analysis-chart-label" x="${(width - padding.right).toFixed(2)}" y="${(
        height - padding.bottom
      ).toFixed(2)}" text-anchor="end">${escapeHtml(formatNumber(min))}</text>
    </svg>
  </div>`;
}

function renderTimeline() {
  const bars = analysisState.filteredBars;
  const enabled = bars.length > 0;
  analysisRefs.timeline.disabled = !enabled;
  analysisRefs.prevBtn.disabled = !enabled;
  analysisRefs.nextBtn.disabled = !enabled;
  analysisRefs.playBtn.disabled = !enabled;

  if (!enabled) {
    analysisRefs.timeline.min = "0";
    analysisRefs.timeline.max = "0";
    analysisRefs.timeline.value = "0";
    analysisRefs.timelineLabel.textContent = "尚未选择时间点";
    analysisRefs.timelineCount.textContent = "0 / 0";
    analysisRefs.playBtn.textContent = "播放";
    return;
  }

  const index = Math.min(analysisState.currentIndex, bars.length - 1);
  const current = bars[index];
  analysisRefs.timeline.min = "0";
  analysisRefs.timeline.max = String(Math.max(0, bars.length - 1));
  analysisRefs.timeline.value = String(index);
  analysisRefs.timelineLabel.textContent = `${current.date} · 收盘 ${formatNumber(current.close)}`;
  analysisRefs.timelineCount.textContent = `${index + 1} / ${bars.length}`;
  analysisRefs.playBtn.textContent = analysisState.isPlaying ? "暂停" : "播放";
}

function renderSnapshot() {
  const bars = analysisState.filteredBars;
  const current = bars[analysisState.currentIndex] || null;
  const indicator = analysisState.indicators[analysisState.currentIndex] || null;
  if (!current || !indicator) {
    analysisRefs.snapshot.className = "analysis-snapshot-empty";
    analysisRefs.snapshot.textContent = "选择时间点后展示当时指标状态。";
    return;
  }

  const currentSignals = analysisState.signals.filter((item) => item.index === analysisState.currentIndex);
  const signalBadges = currentSignals
    .map((signal) => {
      const tone = signal.type === "buy" ? "is-positive" : "is-negative";
      const source = signal.sourceIndicator ? `(${signal.sourceIndicator})` : "";
      return buildAnalysisBadge(`${signal.label}${source}`, tone);
    })
    .join("");
  const tags = [
    buildAnalysisBadge(indicator.bias, toneForBias(indicator.bias)),
    buildAnalysisBadge(indicator.macdSignal, toneForMacd(indicator.macdSignal)),
    buildAnalysisBadge(indicator.rsiSignal, toneForRsi(indicator.rsiSignal)),
    signalBadges,
  ]
    .filter(Boolean)
    .join("");

  const signalHints = currentSignals.length
    ? currentSignals.map((signal) => {
        const source = signal.sourceIndicator ? `[${signal.sourceIndicator}] ` : "";
        return `${source}${signal.reason}`;
      })
    : [];

  analysisRefs.snapshot.className = "analysis-snapshot";
  analysisRefs.snapshot.innerHTML = `<div class="analysis-snapshot-head">
    <div>
      <strong>${escapeHtml(current.date)}</strong>
      <p>收盘 ${escapeHtml(formatNumber(current.close))}</p>
    </div>
    <div class="analysis-badge-row">${tags}</div>
  </div>
  <div class="analysis-snapshot-grid">
    ${analysisMetricTile("MA5 / MA10", `${formatNumber(indicator.ma5)} / ${formatNumber(indicator.ma10)}`)}
    ${analysisMetricTile("MA20", formatNumber(indicator.ma20))}
    ${analysisMetricTile(
      "MACD",
      `${formatNumber(indicator.dif, 3, 3)} / ${formatNumber(indicator.dea, 3, 3)} / ${formatSignedFixed(
        indicator.histogram,
        3
      )}`
    )}
    ${analysisMetricTile("RSI14", formatNumber(indicator.rsi14, 1, 1))}
    ${analysisMetricTile("当日高低", `${formatNumber(current.high)} / ${formatNumber(current.low)}`)}
    ${analysisMetricTile("成交量", formatCompact(current.volume))}
  </div>
  <p class="analysis-snapshot-note">${escapeHtml(
    signalHints.length ? signalHints.join("；") : "当前时点无新增策略信号。"
  )}</p>`;
}

function renderBacktest() {
  if (analysisState.backtestPending) {
    const progress = Math.max(0, Math.min(100, Number(analysisState.backtestProgress) || 0));
    analysisRefs.backtest.className = "analysis-backtest analysis-backtest-pending";
    analysisRefs.backtest.innerHTML = `<div class="analysis-progress-head">
      <strong>策略回测执行中</strong>
      <span>${escapeHtml(formatNumber(progress, 0, 0))}%</span>
    </div>
    <div class="analysis-progress-track"><span style="width:${progress.toFixed(2)}%"></span></div>
    <p class="analysis-snapshot-note">${escapeHtml(analysisState.backtestProgressText || "正在计算策略绩效...")}</p>`;
    return;
  }

  const stats = analysisState.stats;
  if (!stats) {
    analysisRefs.backtest.className = "analysis-backtest-empty";
    analysisRefs.backtest.textContent = "加载后生成买卖信号与回测统计。";
    return;
  }

  const summary = [
    analysisMetricTile("总收益", `${formatSigned(stats.totalReturn)}%`),
    analysisMetricTile("年化收益", `${formatSigned(stats.annualizedReturn)}%`),
    analysisMetricTile("基准收益", `${formatSigned(stats.benchmarkReturn)}%`),
    analysisMetricTile("最大回撤", `${formatNumber(stats.maxDrawdown, 1, 1)}%`),
    analysisMetricTile("夏普比率", formatNumber(stats.sharpeRatio, 2, 2)),
    analysisMetricTile("交易次数", String(stats.tradeCount)),
    analysisMetricTile("胜率", `${formatNumber(stats.winRate, 1, 1)}%`),
    analysisMetricTile("盈亏比", stats.profitLossRatio != null ? formatNumber(stats.profitLossRatio, 2, 2) : "--"),
    analysisMetricTile("资金利用率", `${formatNumber(stats.positionStats?.exposureRate || 0, 1, 1)}%`),
    analysisMetricTile("平均持仓", `${formatNumber(stats.positionStats?.avgHoldBars || 0, 1, 1)} 周期`),
    analysisMetricTile("平均收益", `${formatSigned(stats.avgReturn)}%`),
  ].join("");

  const curve = buildBacktestCurveSvg(stats.equityCurve || []);
  const rows = analysisState.trades
    .slice(-10)
    .reverse()
    .map(
      (trade) => `<tr>
        <td>${escapeHtml(trade.entryDate)}</td>
        <td>${escapeHtml(trade.exitDate)}</td>
        <td>${trade.holdBars}</td>
        <td>${formatSigned(trade.returnPct)}%</td>
        <td>${formatSigned(trade.pnlPct)}%</td>
        <td>${escapeHtml(trade.exitReason || "--")}</td>
      </tr>`
    )
    .join("");

  analysisRefs.backtest.className = "analysis-backtest";
  analysisRefs.backtest.innerHTML = `<p class="analysis-strategy-summary">策略：${escapeHtml(
    stats.strategyLabel || "组合策略"
  )} · ${escapeHtml(stats.strategySummary || "--")}</p>
  ${curve}
  <div class="analysis-snapshot-grid">${summary}</div>
  <p class="analysis-snapshot-note">${escapeHtml(
    stats.lastSignal
      ? `最新信号：${stats.lastSignal.date} ${stats.lastSignal.label}${
          stats.lastSignal.sourceIndicator ? `(${stats.lastSignal.sourceIndicator})` : ""
        }，${stats.lastSignal.reason}`
      : "当前区间未触发明确策略信号。"
  )}</p>
  <p class="analysis-snapshot-note">${escapeHtml(
    `回测周期：${timeframeLabel(stats.timeframe)} · 样本 ${stats.sampleCount} · 手续费 ${formatNumber(
      stats.execution?.feeBps || 0,
      1,
      1
    )}bp · 滑点 ${formatNumber(stats.execution?.slippageBps || 0, 1, 1)}bp`
  )}</p>
  ${
    stats.openTrade
      ? `<p class="analysis-open-position">未平仓：${escapeHtml(stats.openTrade.entryDate)} 建仓，浮动收益 ${formatSigned(
          stats.openTrade.returnPct
        )}% · 浮动净值 ${formatNumber(stats.openTrade.markToMarketEquity, 3, 3)}</p>`
      : ""
  }
  <div class="analysis-trade-table-wrap">
    <table class="analysis-trade-table">
      <thead>
        <tr>
          <th>买入</th>
          <th>卖出</th>
          <th>持有</th>
          <th>毛收益</th>
          <th>净收益</th>
          <th>离场原因</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows ||
          '<tr><td colspan="6" class="analysis-table-empty">当前区间没有完成的交易。</td></tr>'
        }
      </tbody>
    </table>
  </div>`;
}

function buildBacktestCurveSvg(curve) {
  if (!Array.isArray(curve) || curve.length < 2) {
    return '<p class="analysis-backtest-curve-empty">样本不足，暂无法绘制收益曲线。</p>';
  }

  const width = 860;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 24, left: 12 };
  const drawableWidth = width - padding.left - padding.right;
  const drawableHeight = height - padding.top - padding.bottom;
  const values = curve.flatMap((item) => [item.equity, item.benchmark].filter((value) => Number.isFinite(value)));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1e-6);
  const mapX = (index) =>
    padding.left + (curve.length === 1 ? drawableWidth / 2 : (index / (curve.length - 1)) * drawableWidth);
  const mapY = (value) => padding.top + (1 - (value - min) / spread) * drawableHeight;
  const buildPath = (series) =>
    series
      .map((value, index) => {
        if (!Number.isFinite(value)) return null;
        const prefix = index === 0 || !Number.isFinite(series[index - 1]) ? "M" : "L";
        return `${prefix}${mapX(index).toFixed(2)},${mapY(value).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(" ");
  const strategyPath = buildPath(curve.map((item) => item.equity));
  const benchmarkPath = buildPath(curve.map((item) => item.benchmark));
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padding.top + ratio * drawableHeight;
      return `<line class="analysis-chart-grid" x1="${padding.left}" y1="${y.toFixed(2)}" x2="${(
        width - padding.right
      ).toFixed(2)}" y2="${y.toFixed(2)}"></line>`;
    })
    .join("");
  const firstDate = curve[0]?.date || "--";
  const lastDate = curve[curve.length - 1]?.date || "--";

  return `<div class="analysis-backtest-curve">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="策略收益曲线">
      ${gridLines}
      <path class="analysis-line analysis-line-equity" d="${strategyPath}"></path>
      <path class="analysis-line analysis-line-benchmark" d="${benchmarkPath}"></path>
      <text class="analysis-chart-label analysis-chart-label-start" x="${padding.left}" y="${(height - 8).toFixed(
        2
      )}">${escapeHtml(firstDate)}</text>
      <text class="analysis-chart-label analysis-chart-label-end" x="${(width - padding.right).toFixed(
        2
      )}" y="${(height - 8).toFixed(2)}" text-anchor="end">${escapeHtml(lastDate)}</text>
      <text class="analysis-chart-label" x="${(width - padding.right).toFixed(2)}" y="${padding.top.toFixed(
        2
      )}" text-anchor="end">${escapeHtml(formatNumber(max, 2, 2))}</text>
      <text class="analysis-chart-label" x="${(width - padding.right).toFixed(2)}" y="${(
        height - padding.bottom
      ).toFixed(2)}" text-anchor="end">${escapeHtml(formatNumber(min, 2, 2))}</text>
    </svg>
    <div class="analysis-backtest-legend">
      <span class="analysis-legend-item is-equity">策略净值</span>
      <span class="analysis-legend-item is-benchmark">基准净值</span>
    </div>
  </div>`;
}

function syncExportButtons() {
  analysisRefs.exportButtons.forEach((button) => {
    const type = button.dataset.exportType || "";
    if (type === "history") {
      button.disabled = analysisState.filteredBars.length === 0;
      return;
    }
    if (type === "technicals") {
      button.disabled = analysisState.indicators.length === 0;
      return;
    }
    button.disabled = !analysisState.stats;
  });
}

function stepTimeline(direction) {
  const bars = analysisState.filteredBars;
  if (!bars.length) return;
  const delta = analysisRefs.playbackStep.value === "week" ? 5 : 1;
  const nextIndex = Math.max(0, Math.min(bars.length - 1, analysisState.currentIndex + direction * delta));
  analysisState.currentIndex = nextIndex;
  renderAnalysis();
}

function togglePlayback() {
  if (analysisState.isPlaying) {
    stopPlayback();
    renderTimeline();
    return;
  }
  startPlayback();
}

function startPlayback() {
  if (!analysisState.filteredBars.length) return;
  stopPlayback();
  analysisState.isPlaying = true;
  analysisState.playbackTimer = window.setInterval(() => {
    const delta = analysisRefs.playbackStep.value === "week" ? 5 : 1;
    const lastIndex = analysisState.filteredBars.length - 1;
    if (analysisState.currentIndex >= lastIndex) {
      stopPlayback();
      renderAnalysis();
      return;
    }
    analysisState.currentIndex = Math.min(lastIndex, analysisState.currentIndex + delta);
    renderAnalysis();
  }, PLAYBACK_INTERVAL_MS);
  renderTimeline();
}

function stopPlayback() {
  if (analysisState.playbackTimer) {
    window.clearInterval(analysisState.playbackTimer);
    analysisState.playbackTimer = null;
  }
  analysisState.isPlaying = false;
}

function computeIndicatorSeries(bars) {
  if (!Array.isArray(bars) || !bars.length) return [];

  const closes = bars.map((item) => item.close);
  const ema12 = calculateEmaSeries(closes, 12);
  const ema26 = calculateEmaSeries(closes, 26);
  const difSeries = closes.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return Number.isFinite(fast) && Number.isFinite(slow) ? fast - slow : null;
  });
  const deaSeries = calculateEmaSeries(difSeries.map((value) => (Number.isFinite(value) ? value : 0)), 9);
  const rsiSeries = calculateRsiSeries(closes, 14);

  return bars.map((bar, index) => {
    const ma5 = calculateSmaAt(closes, index, 5);
    const ma10 = calculateSmaAt(closes, index, 10);
    const ma20 = calculateSmaAt(closes, index, 20);
    const dif = difSeries[index];
    const dea = deaSeries[index];
    const histogram = Number.isFinite(dif) && Number.isFinite(dea) ? (dif - dea) * 2 : null;
    const previousHistogram = index > 0 ? numberOrNull((difSeries[index - 1] - deaSeries[index - 1]) * 2) : null;
    const rsi14 = rsiSeries[index];
    const hasFullSample =
      Number.isFinite(ma20) && Number.isFinite(histogram) && Number.isFinite(previousHistogram) && Number.isFinite(rsi14);

    return {
      date: bar.date,
      close: bar.close,
      ma5,
      ma10,
      ma20,
      dif,
      dea,
      histogram,
      previousHistogram,
      rsi14,
      bias: hasFullSample ? summarizeTechnicalBias(bar.close, { ma5, ma10, ma20 }, { histogram }, rsi14) : "样本不足",
      macdSignal: describeMacdSignal({ histogram, previousHistogram }),
      rsiSignal: describeRsiSignal(rsi14),
    };
  });
}

async function runBacktest(bars, indicators, strategyConfigInput, onProgress) {
  if (!bars.length || !indicators.length) {
    return { signals: [], trades: [], stats: null };
  }

  const strategyConfig = sanitizeStrategyConfig(strategyConfigInput);
  const execution = strategyConfig.execution;
  const strategySeries = buildStrategySeries(bars, indicators, strategyConfig);
  const signals = [];
  const trades = [];
  const equityCurve = [];
  const reportProgress = (progress, text) => {
    if (typeof onProgress !== "function") return;
    onProgress({
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      text: String(text || ""),
    });
  };

  reportProgress(6, "构建策略序列...");
  await yieldToUi();

  let position = null;
  let cash = 1;
  let maxDrawdown = 0;
  let peakEquity = 1;
  let inMarketBars = 0;
  const feeRate = (execution.feeBps || 0) / 10000;
  const slippageRate = (execution.slippageBps || 0) / 10000;
  const positionSize = (execution.positionSizePct || 0) / 100;
  const benchmarkBase = Number.isFinite(bars[0]?.close) && bars[0].close > 0 ? bars[0].close : null;
  equityCurve.push({
    date: bars[0].date,
    equity: 1,
    benchmark: 1,
  });

  const trackDrawdown = (equity) => {
    if (!Number.isFinite(equity)) return;
    peakEquity = Math.max(peakEquity, equity);
    if (peakEquity <= 0) return;
    maxDrawdown = Math.max(maxDrawdown, ((peakEquity - equity) / peakEquity) * 100);
  };
  trackDrawdown(1);

  const chunkSize = Math.max(20, Math.floor(strategySeries.length / 10));
  for (let index = 1; index < strategySeries.length; index += 1) {
    const point = strategySeries[index];
    const previous = strategySeries[index - 1];
    if (!point || !previous) continue;

    if (position) inMarketBars += 1;

    let plannedExit = null;
    let hadExitOnCurrentBar = false;
    if (position && Number.isFinite(position.entryRawPrice) && position.entryRawPrice > 0) {
      const grossReturnPct = ((point.close - position.entryRawPrice) / position.entryRawPrice) * 100;
      if (execution.stopLossPct > 0 && grossReturnPct <= -execution.stopLossPct) {
        plannedExit = {
          code: "stop_loss",
          reason: buildRiskExitReason("stop_loss", execution),
        };
      } else if (execution.takeProfitPct > 0 && grossReturnPct >= execution.takeProfitPct) {
        plannedExit = {
          code: "take_profit",
          reason: buildRiskExitReason("take_profit", execution),
        };
      } else if (execution.maxHoldBars > 0 && index - position.entryIndex >= execution.maxHoldBars) {
        plannedExit = {
          code: "max_hold",
          reason: buildRiskExitReason("max_hold", execution),
        };
      }
    }

    if (position && !plannedExit && shouldExitStrategy(strategyConfig.type, previous, point, strategyConfig.params)) {
      plannedExit = {
        code: "signal",
        reason: buildStrategyExitReason(strategyConfig.type, previous, point, strategyConfig.params),
      };
    }

    if (position && plannedExit) {
      const execPrice = point.close * (1 - slippageRate);
      const grossProceeds = position.shares * execPrice;
      const exitFee = grossProceeds * feeRate;
      const netProceeds = grossProceeds - exitFee;
      cash += netProceeds;
      const grossReturnPct = ((point.close - position.entryRawPrice) / position.entryRawPrice) * 100;
      const pnlAmount = netProceeds - position.entryCapital;
      const pnlPct = (pnlAmount / position.entryCapital) * 100;

      trades.push({
        entryDate: position.entryDate,
        entryPrice: position.entryRawPrice,
        entryExecPrice: position.entryExecPrice,
        exitDate: point.date,
        exitPrice: point.close,
        exitExecPrice: execPrice,
        holdBars: index - position.entryIndex,
        returnPct: grossReturnPct,
        pnlPct,
        pnlAmount,
        feeAmount: position.entryFee + exitFee,
        exitReason: plannedExit.reason,
      });
      signals.push({
        type: "sell",
        index,
        date: point.date,
        price: point.close,
        label: "卖出",
        reason: plannedExit.reason,
        reasonCode: plannedExit.code,
        sourceIndicator:
          typeof signalPolicyUtils.signalSourceForStrategy === "function"
            ? signalPolicyUtils.signalSourceForStrategy(strategyConfig.type, "sell", plannedExit.code)
            : plannedExit.code === "signal"
              ? "Strategy"
              : "Risk",
      });
      position = null;
      hadExitOnCurrentBar = true;
    }

    const allowSameBarEntry =
      typeof signalPolicyUtils.shouldAllowSameBarEntry === "function"
        ? signalPolicyUtils.shouldAllowSameBarEntry(execution, hadExitOnCurrentBar)
        : !hadExitOnCurrentBar;
    if (
      !position &&
      allowSameBarEntry &&
      positionSize > 0 &&
      shouldEnterStrategy(strategyConfig.type, previous, point, strategyConfig.params)
    ) {
      const entryCapital = cash * positionSize;
      if (entryCapital > 0 && Number.isFinite(point.close) && point.close > 0) {
        const execPrice = point.close * (1 + slippageRate);
        const entryFee = entryCapital * feeRate;
        const netCapital = Math.max(0, entryCapital - entryFee);
        const shares = execPrice > 0 ? netCapital / execPrice : 0;
        if (shares > 0) {
          cash -= entryCapital;
          position = {
            entryIndex: index,
            entryDate: point.date,
            entryRawPrice: point.close,
            entryExecPrice: execPrice,
            entryCapital,
            entryFee,
            shares,
          };
          signals.push({
            type: "buy",
            index,
            date: point.date,
            price: point.close,
            label: "买入",
            reason: buildStrategyEntryReason(strategyConfig.type, previous, point, strategyConfig.params),
            reasonCode: "signal",
            sourceIndicator:
              typeof signalPolicyUtils.signalSourceForStrategy === "function"
                ? signalPolicyUtils.signalSourceForStrategy(strategyConfig.type, "buy", "signal")
                : "Strategy",
          });
        }
      }
    }

    const equity = cash + (position ? position.shares * point.close : 0);
    const benchmark = benchmarkBase && benchmarkBase > 0 ? point.close / benchmarkBase : 1;
    equityCurve.push({
      date: point.date,
      equity,
      benchmark,
    });
    trackDrawdown(equity);

    if (index % chunkSize === 0) {
      const progress = 12 + (index / Math.max(1, strategySeries.length - 1)) * 80;
      reportProgress(progress, "模拟交易执行...");
      await yieldToUi();
    }
  }

  reportProgress(94, "计算绩效指标...");
  await yieldToUi();

  const lastClose = bars[bars.length - 1]?.close;
  const finalEquity = cash + (position && Number.isFinite(lastClose) ? position.shares * lastClose : 0);
  const benchmarkReturn =
    equityCurve.length > 0 && Number.isFinite(equityCurve[equityCurve.length - 1]?.benchmark)
      ? (equityCurve[equityCurve.length - 1].benchmark - 1) * 100
      : 0;
  const periodicReturns = [];
  for (let index = 1; index < equityCurve.length; index += 1) {
    const prev = equityCurve[index - 1]?.equity;
    const curr = equityCurve[index]?.equity;
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) continue;
    periodicReturns.push(curr / prev - 1);
  }

  const avgPeriodReturn =
    periodicReturns.length > 0 ? periodicReturns.reduce((sum, value) => sum + value, 0) / periodicReturns.length : 0;
  const variance =
    periodicReturns.length > 0
      ? periodicReturns.reduce((sum, value) => sum + (value - avgPeriodReturn) ** 2, 0) / periodicReturns.length
      : 0;
  const volatility = Math.sqrt(Math.max(variance, 0));
  const annualFactor = ANNUALIZATION_FACTOR[strategyConfig.execution.timeframe] || ANNUALIZATION_FACTOR.day;
  const sharpeRatio =
    volatility > 0 ? (avgPeriodReturn / volatility) * Math.sqrt(annualFactor) : 0;
  const annualizedReturn =
    finalEquity > 0 && equityCurve.length > 1
      ? (Math.pow(finalEquity, annualFactor / (equityCurve.length - 1)) - 1) * 100
      : 0;

  const wins = trades.filter((trade) => trade.pnlPct > 0).length;
  const grossProfit = trades.reduce((sum, trade) => sum + (trade.pnlAmount > 0 ? trade.pnlAmount : 0), 0);
  const grossLoss = Math.abs(trades.reduce((sum, trade) => sum + (trade.pnlAmount < 0 ? trade.pnlAmount : 0), 0));
  const profitLossRatio = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const avgReturn = trades.length ? trades.reduce((sum, trade) => sum + trade.pnlPct, 0) / trades.length : 0;
  const holdBarsList = trades.map((trade) => trade.holdBars);
  const avgHoldBars = holdBarsList.length ? holdBarsList.reduce((sum, barsCount) => sum + barsCount, 0) / holdBarsList.length : 0;
  const maxHoldBars = holdBarsList.length ? Math.max(...holdBarsList) : 0;
  const exposureDenominator = Math.max(1, bars.length - 1);
  const exposureRate = (inMarketBars / exposureDenominator) * 100;

  const openTrade =
    position && Number.isFinite(lastClose) && position.entryCapital > 0
      ? {
          entryDate: position.entryDate,
          entryPrice: position.entryRawPrice,
          returnPct: ((position.shares * lastClose * (1 - feeRate) - position.entryCapital) / position.entryCapital) * 100,
          markToMarketEquity: finalEquity,
        }
      : null;

  reportProgress(100, "完成");
  return {
    signals,
    trades,
    stats: {
      tradeCount: trades.length,
      wins,
      winRate: trades.length ? (wins / trades.length) * 100 : 0,
      totalReturn: (finalEquity - 1) * 100,
      annualizedReturn,
      avgReturn,
      benchmarkReturn,
      maxDrawdown,
      sharpeRatio,
      profitLossRatio,
      lastSignal: signals[signals.length - 1] || null,
      openTrade,
      strategyType: strategyConfig.type,
      strategyLabel: strategyLabel(strategyConfig.type),
      strategySummary: describeStrategyConfig(strategyConfig),
      timeframe: strategyConfig.execution.timeframe,
      sampleCount: bars.length,
      equityCurve,
      execution: {
        feeBps: strategyConfig.execution.feeBps,
        slippageBps: strategyConfig.execution.slippageBps,
      },
      positionStats: {
        exposureRate,
        avgHoldBars,
        maxHoldBars,
      },
    },
  };
}

function buildStrategySeries(bars, indicators, strategyConfig) {
  const closes = bars.map((item) => item.close);
  const highs = bars.map((item) => (Number.isFinite(item.high) ? item.high : item.close));
  const lows = bars.map((item) => (Number.isFinite(item.low) ? item.low : item.close));
  const params = strategyConfig.params || {};
  const maFastSeries = calculateSmaSeries(closes, Number(params.fastPeriod) || 5);
  const maSlowSeries = calculateSmaSeries(closes, Number(params.slowPeriod) || 20);
  const maTrendSeries = calculateSmaSeries(closes, 20);
  const rsiPeriod = Number(params.rsiPeriod) || 14;
  const rsiSeries =
    rsiPeriod === 14 ? indicators.map((item) => numberOrNull(item?.rsi14)) : calculateRsiSeries(closes, rsiPeriod);
  const breakoutSeries = calculateRollingExtremeSeries(highs, Number(params.breakoutPeriod) || 20, "max", 1);
  const breakdownSeries = calculateRollingExtremeSeries(lows, Number(params.breakdownPeriod) || 10, "min", 1);

  return bars.map((bar, index) => ({
    date: bar.date,
    close: bar.close,
    maFast: numberOrNull(maFastSeries[index]),
    maSlow: numberOrNull(maSlowSeries[index]),
    maTrend: numberOrNull(maTrendSeries[index]),
    histogram: numberOrNull(indicators[index]?.histogram),
    rsi: numberOrNull(rsiSeries[index]),
    breakout: numberOrNull(breakoutSeries[index]),
    breakdown: numberOrNull(breakdownSeries[index]),
  }));
}

function shouldEnterStrategy(type, previous, current, params) {
  if (type === "ma_cross") {
    return isCrossUp(previous.maFast, current.maFast, previous.maSlow, current.maSlow);
  }

  if (type === "rsi_reversion") {
    const rsiBuyTrigger = isThresholdCrossDown(previous.rsi, current.rsi, Number(params.buyRsi));
    const trendAllowed = !params.useTrendFilter || !Number.isFinite(current.maTrend) || current.close >= current.maTrend;
    return rsiBuyTrigger && trendAllowed;
  }

  if (type === "macd_cross") {
    const macdCrossUp = isThresholdCrossUp(previous.histogram, current.histogram, 0);
    const rsiAllowed =
      !params.useRsiFilter ||
      (Number.isFinite(current.rsi) && current.rsi >= Number(params.rsiFloor) && current.rsi <= Number(params.rsiCeil));
    return macdCrossUp && rsiAllowed;
  }

  if (type === "price_breakout") {
    const breakoutTriggered =
      Number.isFinite(current.breakout) &&
      current.close > current.breakout &&
      (!Number.isFinite(previous.breakout) || previous.close <= previous.breakout);
    const trendAllowed = !params.useTrendFilter || !Number.isFinite(current.maTrend) || current.close >= current.maTrend;
    return breakoutTriggered && trendAllowed;
  }

  const maCrossUp = isCrossUp(previous.maFast, current.maFast, previous.maSlow, current.maSlow);
  const macdCrossUp = isThresholdCrossUp(previous.histogram, current.histogram, 0);
  const rsiReady = Number.isFinite(current.rsi) && current.rsi >= Number(params.entryRsi);
  const trendReady = !Number.isFinite(current.maSlow) || current.close >= current.maSlow;
  const trigger = params.requireMacdCross ? macdCrossUp : maCrossUp || macdCrossUp;
  return trigger && rsiReady && trendReady;
}

function shouldExitStrategy(type, previous, current, params) {
  if (type === "ma_cross") {
    return isCrossDown(previous.maFast, current.maFast, previous.maSlow, current.maSlow);
  }

  if (type === "rsi_reversion") {
    const rsiSellTrigger = isThresholdCrossUp(previous.rsi, current.rsi, Number(params.sellRsi));
    const trendBreak = params.useTrendFilter && Number.isFinite(current.maTrend) && current.close < current.maTrend;
    return rsiSellTrigger || trendBreak;
  }

  if (type === "macd_cross") {
    const macdCrossDown = isThresholdCrossDown(previous.histogram, current.histogram, 0);
    const rsiRisk = params.useRsiFilter && Number.isFinite(current.rsi) && current.rsi > Number(params.rsiCeil);
    return macdCrossDown || rsiRisk;
  }

  if (type === "price_breakout") {
    const breakdownTriggered =
      Number.isFinite(current.breakdown) &&
      current.close < current.breakdown &&
      (!Number.isFinite(previous.breakdown) || previous.close >= previous.breakdown);
    const trendBreak = params.useTrendFilter && Number.isFinite(current.maTrend) && current.close < current.maTrend;
    return breakdownTriggered || trendBreak;
  }

  const maCrossDown = isCrossDown(previous.maFast, current.maFast, previous.maSlow, current.maSlow);
  const macdCrossDown = isThresholdCrossDown(previous.histogram, current.histogram, 0);
  const rsiWeak = Number.isFinite(current.rsi) && current.rsi <= Number(params.exitRsi);
  const trendBreak = Number.isFinite(current.maSlow) && current.close < current.maSlow;
  return maCrossDown || macdCrossDown || rsiWeak || trendBreak;
}

function buildStrategyEntryReason(type, previous, current, params) {
  if (type === "ma_cross") {
    return `MA${params.fastPeriod}/MA${params.slowPeriod} 金叉`;
  }
  if (type === "rsi_reversion") {
    return `RSI${params.rsiPeriod} 下探至 ${formatNumber(current.rsi, 1, 1)}（阈值 ${params.buyRsi}）`;
  }
  if (type === "macd_cross") {
    return params.useRsiFilter ? "MACD 金叉 + RSI 区间过滤通过" : "MACD 金叉";
  }
  if (type === "price_breakout") {
    return `突破 ${formatNumber(current.breakout)} 上方，趋势转强`;
  }

  const reasons = [];
  if (isCrossUp(previous.maFast, current.maFast, previous.maSlow, current.maSlow)) {
    reasons.push(`MA${params.fastPeriod} 上穿 MA${params.slowPeriod}`);
  }
  if (isThresholdCrossUp(previous.histogram, current.histogram, 0)) {
    reasons.push("MACD 金叉");
  }
  if (Number.isFinite(current.rsi)) {
    reasons.push(`RSI ${formatNumber(current.rsi, 1, 1)}`);
  }
  return reasons.join("，") || "趋势转强";
}

function buildStrategyExitReason(type, previous, current, params) {
  if (type === "ma_cross") {
    return `MA${params.fastPeriod}/MA${params.slowPeriod} 死叉`;
  }
  if (type === "rsi_reversion") {
    if (isThresholdCrossUp(previous.rsi, current.rsi, Number(params.sellRsi))) {
      return `RSI${params.rsiPeriod} 回到 ${params.sellRsi} 上方`;
    }
    return "趋势过滤触发离场";
  }
  if (type === "macd_cross") {
    if (isThresholdCrossDown(previous.histogram, current.histogram, 0)) {
      return "MACD 死叉";
    }
    return "RSI 触发风控离场";
  }
  if (type === "price_breakout") {
    if (Number.isFinite(current.breakdown) && current.close < current.breakdown) {
      return `跌破 ${formatNumber(current.breakdown)} 离场`;
    }
    return "趋势过滤触发离场";
  }

  const reasons = [];
  if (isCrossDown(previous.maFast, current.maFast, previous.maSlow, current.maSlow)) {
    reasons.push(`MA${params.fastPeriod} 下破 MA${params.slowPeriod}`);
  }
  if (isThresholdCrossDown(previous.histogram, current.histogram, 0)) {
    reasons.push("MACD 死叉");
  }
  if (Number.isFinite(current.rsi) && current.rsi <= Number(params.exitRsi)) {
    reasons.push(`RSI 走弱至 ${formatNumber(current.rsi, 1, 1)}`);
  }
  return reasons.join("，") || "趋势转弱";
}

function buildRiskExitReason(type, execution) {
  if (type === "stop_loss") return `止损触发（-${formatNumber(execution.stopLossPct, 1, 1)}%）`;
  if (type === "take_profit") return `止盈触发（+${formatNumber(execution.takeProfitPct, 1, 1)}%）`;
  return `持仓超过 ${execution.maxHoldBars} 周期`;
}

function isCrossUp(previousA, currentA, previousB, currentB) {
  return (
    Number.isFinite(previousA) &&
    Number.isFinite(currentA) &&
    Number.isFinite(previousB) &&
    Number.isFinite(currentB) &&
    previousA < previousB &&
    currentA >= currentB
  );
}

function isCrossDown(previousA, currentA, previousB, currentB) {
  return (
    Number.isFinite(previousA) &&
    Number.isFinite(currentA) &&
    Number.isFinite(previousB) &&
    Number.isFinite(currentB) &&
    previousA >= previousB &&
    currentA < currentB
  );
}

function isThresholdCrossUp(previous, current, threshold) {
  return (
    Number.isFinite(previous) &&
    Number.isFinite(current) &&
    Number.isFinite(threshold) &&
    previous < threshold &&
    current >= threshold
  );
}

function isThresholdCrossDown(previous, current, threshold) {
  return (
    Number.isFinite(previous) &&
    Number.isFinite(current) &&
    Number.isFinite(threshold) &&
    previous > threshold &&
    current <= threshold
  );
}

function strategyLabel(type) {
  return STRATEGY_PRESETS[type]?.label || STRATEGY_PRESETS.hybrid.label;
}

function getDefaultStrategyConfig(type = "hybrid") {
  const normalizedType = STRATEGY_PRESETS[type] ? type : "hybrid";
  return {
    type: normalizedType,
    params: { ...STRATEGY_PRESETS[normalizedType].defaults },
    execution: getDefaultExecutionConfig(),
  };
}

function sanitizeStrategyConfig(raw) {
  const type = raw && STRATEGY_PRESETS[raw.type] ? raw.type : "hybrid";
  const params = sanitizeStrategyParams(type, raw?.params || {});
  const execution = sanitizeExecutionConfig(raw?.execution || raw?.risk || raw?.backtest || {});
  return { type, params, execution };
}

function sanitizeStrategyParams(type, rawParams) {
  const raw = rawParams && typeof rawParams === "object" ? rawParams : {};
  const defaults = STRATEGY_PRESETS[type]?.defaults || STRATEGY_PRESETS.hybrid.defaults;

  if (type === "ma_cross") {
    let fastPeriod = clampInteger(raw.fastPeriod, 3, 40, defaults.fastPeriod);
    let slowPeriod = clampInteger(raw.slowPeriod, 6, 150, defaults.slowPeriod);
    if (fastPeriod >= slowPeriod) {
      fastPeriod = Math.max(3, slowPeriod - 1);
    }
    return { fastPeriod, slowPeriod };
  }

  if (type === "rsi_reversion") {
    const rsiPeriod = clampInteger(raw.rsiPeriod, 6, 30, defaults.rsiPeriod);
    let buyRsi = clampNumber(raw.buyRsi, 10, 50, defaults.buyRsi);
    let sellRsi = clampNumber(raw.sellRsi, 50, 90, defaults.sellRsi);
    if (buyRsi >= sellRsi) {
      buyRsi = Math.max(10, sellRsi - 5);
    }
    return {
      rsiPeriod,
      buyRsi,
      sellRsi,
      useTrendFilter: Boolean(raw.useTrendFilter ?? defaults.useTrendFilter),
    };
  }

  if (type === "macd_cross") {
    let rsiFloor = clampNumber(raw.rsiFloor, 20, 60, defaults.rsiFloor);
    let rsiCeil = clampNumber(raw.rsiCeil, 40, 85, defaults.rsiCeil);
    if (rsiFloor >= rsiCeil) {
      rsiFloor = Math.max(20, rsiCeil - 10);
    }
    return {
      useRsiFilter: Boolean(raw.useRsiFilter ?? defaults.useRsiFilter),
      rsiFloor,
      rsiCeil,
    };
  }

  if (type === "price_breakout") {
    const breakoutPeriod = clampInteger(raw.breakoutPeriod, 5, 120, defaults.breakoutPeriod);
    let breakdownPeriod = clampInteger(raw.breakdownPeriod, 3, 80, defaults.breakdownPeriod);
    if (breakdownPeriod >= breakoutPeriod) {
      breakdownPeriod = Math.max(3, breakoutPeriod - 1);
    }
    return {
      breakoutPeriod,
      breakdownPeriod,
      useTrendFilter: Boolean(raw.useTrendFilter ?? defaults.useTrendFilter),
    };
  }

  let fastPeriod = clampInteger(raw.fastPeriod, 3, 40, defaults.fastPeriod);
  let slowPeriod = clampInteger(raw.slowPeriod, 6, 120, defaults.slowPeriod);
  if (fastPeriod >= slowPeriod) {
    fastPeriod = Math.max(3, slowPeriod - 1);
  }

  let entryRsi = clampNumber(raw.entryRsi, 20, 80, defaults.entryRsi);
  let exitRsi = clampNumber(raw.exitRsi, 20, 80, defaults.exitRsi);
  if (entryRsi <= exitRsi) {
    entryRsi = Math.min(80, exitRsi + 1);
  }

  return {
    fastPeriod,
    slowPeriod,
    entryRsi,
    exitRsi,
    requireMacdCross: Boolean(raw.requireMacdCross ?? defaults.requireMacdCross),
  };
}

function getDefaultExecutionConfig() {
  return {
    timeframe: "day",
    positionSizePct: 95,
    maxHoldBars: 0,
    stopLossPct: 8,
    takeProfitPct: 18,
    feeBps: 6,
    slippageBps: 4,
    noSameBarReentry: true,
  };
}

function sanitizeExecutionConfig(rawInput) {
  const raw = rawInput && typeof rawInput === "object" ? rawInput : {};
  const defaults = getDefaultExecutionConfig();
  const timeframe = raw.timeframe === "week" || raw.timeframe === "month" || raw.timeframe === "day"
    ? raw.timeframe
    : defaults.timeframe;
  return {
    timeframe,
    positionSizePct: clampNumber(raw.positionSizePct, 10, 100, defaults.positionSizePct),
    maxHoldBars: clampInteger(raw.maxHoldBars, 0, 260, defaults.maxHoldBars),
    stopLossPct: clampNumber(raw.stopLossPct, 0, 80, defaults.stopLossPct),
    takeProfitPct: clampNumber(raw.takeProfitPct, 0, 200, defaults.takeProfitPct),
    feeBps: clampNumber(raw.feeBps, 0, 100, defaults.feeBps),
    slippageBps: clampNumber(raw.slippageBps, 0, 100, defaults.slippageBps),
    noSameBarReentry: raw.noSameBarReentry !== false,
  };
}

function timeframeLabel(timeframe) {
  if (timeframe === "week") return "周线";
  if (timeframe === "month") return "月线";
  return "日线";
}

function describeStrategyConfig(configInput) {
  const config = sanitizeStrategyConfig(configInput);
  const params = config.params;
  const execution = config.execution;
  const executionSummary = `${timeframeLabel(execution.timeframe)} · 仓位 ${formatNumber(
    execution.positionSizePct,
    0,
    0
  )}% · 止损/止盈 ${formatNumber(execution.stopLossPct, 1, 1)}%/${formatNumber(
    execution.takeProfitPct,
    1,
    1
  )}% · ${execution.noSameBarReentry ? "禁同周期反手" : "允许同周期反手"}`;

  if (config.type === "ma_cross") {
    return `MA${params.fastPeriod} 上穿 MA${params.slowPeriod} 买入，下穿卖出 · ${executionSummary}`;
  }
  if (config.type === "rsi_reversion") {
    return `RSI${params.rsiPeriod} <= ${params.buyRsi} 买入，>= ${params.sellRsi} 卖出${
      params.useTrendFilter ? "（含 MA20 过滤）" : ""
    } · ${executionSummary}`;
  }
  if (config.type === "macd_cross") {
    return `MACD 金叉买入、死叉卖出${params.useRsiFilter ? `，RSI 区间 ${params.rsiFloor}-${params.rsiCeil}` : ""} · ${executionSummary}`;
  }
  if (config.type === "price_breakout") {
    return `突破 ${params.breakoutPeriod} 周期高点买入，跌破 ${params.breakdownPeriod} 周期低点卖出${
      params.useTrendFilter ? "（含 MA20 过滤）" : ""
    } · ${executionSummary}`;
  }
  return `MA${params.fastPeriod}/MA${params.slowPeriod} + RSI(${params.entryRsi}/${params.exitRsi})${
    params.requireMacdCross ? "，需 MACD 金叉确认" : ""
  } · ${executionSummary}`;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Number(parsed)));
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function exportAnalysisCsv(type) {
  if (type === "history") {
    downloadCsv(
      buildAnalysisFilename("history"),
      toCsv(
        analysisState.filteredBars.map((item) => ({
          date: item.date,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
        }))
      )
    );
    return;
  }

  if (type === "technicals") {
    downloadCsv(
      buildAnalysisFilename("technicals"),
      toCsv(
        analysisState.indicators.map((item) => ({
          date: item.date,
          close: item.close,
          ma5: item.ma5,
          ma10: item.ma10,
          ma20: item.ma20,
          dif: item.dif,
          dea: item.dea,
          histogram: item.histogram,
          rsi14: item.rsi14,
          bias: item.bias,
          macdSignal: item.macdSignal,
          rsiSignal: item.rsiSignal,
        }))
      )
    );
    return;
  }

  if (type === "backtest") {
    const stats = analysisState.stats;
    const rows = analysisState.trades.length
      ? analysisState.trades.map((trade) => ({
          strategyType: stats?.strategyType || analysisState.strategyConfig.type,
          strategyLabel: stats?.strategyLabel || strategyLabel(analysisState.strategyConfig.type),
          timeframe: stats?.timeframe || analysisState.strategyConfig.execution?.timeframe || "day",
          entryDate: trade.entryDate,
          entryPrice: trade.entryPrice,
          entryExecPrice: trade.entryExecPrice,
          exitDate: trade.exitDate,
          exitPrice: trade.exitPrice,
          exitExecPrice: trade.exitExecPrice,
          holdBars: trade.holdBars,
          grossReturnPct: trade.returnPct,
          netReturnPct: trade.pnlPct,
          pnlAmount: trade.pnlAmount,
          feeAmount: trade.feeAmount,
          exitReason: trade.exitReason,
        }))
      : [
          {
            strategyType: stats?.strategyType || analysisState.strategyConfig.type,
            strategyLabel: stats?.strategyLabel || strategyLabel(analysisState.strategyConfig.type),
            timeframe: stats?.timeframe || analysisState.strategyConfig.execution?.timeframe || "day",
            tradeCount: 0,
            totalReturnPct: stats?.totalReturn ?? 0,
            annualizedReturnPct: stats?.annualizedReturn ?? 0,
            maxDrawdownPct: stats?.maxDrawdown ?? 0,
            sharpeRatio: stats?.sharpeRatio ?? 0,
            note: "当前区间无已完成交易",
          },
        ];

    downloadCsv(
      buildAnalysisFilename("backtest"),
      toCsv(rows)
    );
  }
}

function buildAnalysisFilename(type) {
  const symbol = analysisState.symbolMeta?.code || "symbol";
  return `${symbol}_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
}

function toCsv(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvEscape(row[header]))
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, content) {
  if (!content) return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function calculateSmaAt(values, index, period) {
  if (typeof indicatorUtils.calculateSmaAt === "function") {
    return indicatorUtils.calculateSmaAt(values, index, period);
  }
  return null;
}

function calculateSmaSeries(values, period) {
  if (typeof indicatorUtils.calculateSmaSeries === "function") {
    return indicatorUtils.calculateSmaSeries(values, period);
  }
  return [];
}

function calculateRollingExtremeSeries(values, period, mode, lookbackOffset = 1) {
  if (!Array.isArray(values) || !values.length || !Number.isFinite(period) || period < 1) {
    return [];
  }
  const normalizedPeriod = Math.max(1, Math.round(period));
  const isMax = mode !== "min";
  return values.map((_, index) => {
    const end = index - Math.max(0, Math.round(lookbackOffset));
    const start = end - normalizedPeriod + 1;
    if (start < 0 || end < 0) return null;
    let extreme = isMax ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    for (let cursor = start; cursor <= end; cursor += 1) {
      const value = Number(values[cursor]);
      if (!Number.isFinite(value)) return null;
      if (isMax) {
        extreme = Math.max(extreme, value);
      } else {
        extreme = Math.min(extreme, value);
      }
    }
    if (!Number.isFinite(extreme)) return null;
    return extreme;
  });
}

function resampleBarsByTimeframe(bars, timeframe) {
  if (!Array.isArray(bars) || !bars.length) return [];
  if (timeframe === "day") {
    return bars.map((bar) => ({ ...bar }));
  }

  const groups = [];
  for (const bar of bars) {
    const key = timeframe === "month" ? String(bar.date || "").slice(0, 7) : getWeekKey(bar.date);
    if (!groups.length || groups[groups.length - 1].key !== key) {
      groups.push({
        key,
        date: bar.date,
        open: Number.isFinite(bar.open) ? bar.open : bar.close,
        high: Number.isFinite(bar.high) ? bar.high : bar.close,
        low: Number.isFinite(bar.low) ? bar.low : bar.close,
        close: bar.close,
        volume: Number.isFinite(bar.volume) ? bar.volume : 0,
      });
      continue;
    }

    const current = groups[groups.length - 1];
    current.date = bar.date;
    current.close = bar.close;
    if (Number.isFinite(bar.high)) {
      current.high = Number.isFinite(current.high) ? Math.max(current.high, bar.high) : bar.high;
    }
    if (Number.isFinite(bar.low)) {
      current.low = Number.isFinite(current.low) ? Math.min(current.low, bar.low) : bar.low;
    }
    if (Number.isFinite(bar.volume)) {
      current.volume = Number.isFinite(current.volume) ? current.volume + bar.volume : bar.volume;
    }
  }

  return groups.map((item) => ({
    date: item.date,
    open: numberOrNull(item.open),
    high: numberOrNull(item.high),
    low: numberOrNull(item.low),
    close: numberOrNull(item.close),
    volume: numberOrNull(item.volume),
  }));
}

function getWeekKey(dateText) {
  const parsed = new Date(`${String(dateText || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return String(dateText || "");
  const utc = new Date(parsed);
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function findNearestIndexByDate(bars, date) {
  if (!Array.isArray(bars) || !bars.length) return -1;
  const target = String(date || "");
  if (!target) return -1;
  if (target <= bars[0].date) return 0;
  if (target >= bars[bars.length - 1].date) return bars.length - 1;
  for (let index = bars.length - 1; index >= 0; index -= 1) {
    if (bars[index].date <= target) return index;
  }
  return -1;
}

function yieldToUi() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function calculateEmaSeries(values, period) {
  if (typeof indicatorUtils.calculateEmaSeries === "function") {
    return indicatorUtils.calculateEmaSeries(values, period);
  }
  return [];
}

function calculateRsiSeries(values, period) {
  if (typeof indicatorUtils.calculateRsiSeries === "function") {
    return indicatorUtils.calculateRsiSeries(values, period);
  }
  return [];
}

function normalizeHistoricalBar(item) {
  if (!item || !item.date) return null;
  const close = numberOrNull(item.close);
  if (!Number.isFinite(close)) return null;
  return {
    date: String(item.date).slice(0, 10),
    open: numberOrNull(item.open),
    high: numberOrNull(item.high),
    low: numberOrNull(item.low),
    close,
    volume: numberOrNull(item.volume),
  };
}

function summarizeTechnicalBias(close, ma, macd, rsi14) {
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
  if (Number.isFinite(rsi14)) {
    if (rsi14 >= 55) score += 1;
    if (rsi14 <= 45) score -= 1;
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

function toneForBias(label) {
  if (label === "偏多") return "is-positive";
  if (label === "偏空") return "is-negative";
  return "is-neutral";
}

function toneForMacd(label) {
  if (label === "金叉" || label === "红柱扩张" || label === "红柱收敛") return "is-positive";
  if (label === "死叉" || label === "绿柱扩张" || label === "绿柱收敛") return "is-negative";
  return "is-neutral";
}

function toneForRsi(label) {
  if (label === "超卖") return "is-positive";
  if (label === "超买") return "is-negative";
  return "is-neutral";
}

function buildOverviewMetric(label, value) {
  return `<div class="analysis-metric"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function analysisMetricTile(label, value) {
  return `<div class="analysis-mini-metric"><span class="label">${label}</span><span class="value">${escapeHtml(
    value
  )}</span></div>`;
}

function buildAnalysisBadge(label, tone) {
  const text = String(label || "").trim();
  if (!text) return "";
  return `<span class="analysis-badge ${tone}">${escapeHtml(text)}</span>`;
}

function legendItem(label, tone, title = "") {
  const tooltip = title ? ` title="${escapeHtml(title)}"` : "";
  return `<span class="analysis-legend-item ${tone}"${tooltip}>${escapeHtml(label)}</span>`;
}

function setAnalysisStatus(text) {
  analysisRefs.status.textContent = text;
}

function numberOrNull(value) {
  if (typeof coreUtils.numberOrNull === "function") {
    return coreUtils.numberOrNull(value);
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toYahooSymbol(input) {
  if (typeof coreUtils.toYahooSymbol === "function") {
    return coreUtils.toYahooSymbol(input);
  }
  return String(input || "").trim().toUpperCase();
}

function normalizeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (!message) return "未知错误";
  if (/failed to fetch/i.test(message)) return "网络不可达、接口被拦截或跨域限制";
  return message;
}

function isHttpOrigin() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function formatNumber(value, minDigits = 2, maxDigits = 2) {
  if (typeof coreUtils.formatNumber === "function") {
    return coreUtils.formatNumber(value, minDigits, maxDigits);
  }
  if (value == null || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
}

function formatSigned(value) {
  if (typeof coreUtils.formatSigned === "function") {
    return coreUtils.formatSigned(value);
  }
  if (value == null || Number.isNaN(value)) return "--";
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(2)}`;
}

function formatSignedFixed(value, digits = 2) {
  if (typeof coreUtils.formatSignedFixed === "function") {
    return coreUtils.formatSignedFixed(value, digits);
  }
  if (value == null || Number.isNaN(value)) return "--";
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}

function formatCompact(value) {
  if (typeof coreUtils.formatCompact === "function") {
    return coreUtils.formatCompact(value);
  }
  if (value == null || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value) {
  if (typeof coreUtils.escapeHtml === "function") {
    return coreUtils.escapeHtml(value);
  }
  return String(value ?? "");
}

function debounce(fn, waitMs) {
  if (typeof coreUtils.debounce === "function") {
    return coreUtils.debounce(fn, waitMs);
  }
  return fn;
}
