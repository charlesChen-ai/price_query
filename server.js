const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const STATE_FILE = path.join(ROOT, ".dashboard-state.json");
const HN_TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const EASTMONEY_SEARCH_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";
const EASTMONEY_HISTORY_TOKEN = "fa5fd1943c7b386f172d6893dbfba10b";
const QUOTE_TOPICS = new Set(["mixed", "economics", "philosophy", "engineering"]);
const COMMODITY_SINA_CODE_MAP = {
  "GC=F": { code: "hf_GC", tencentCode: "hf_GC", name: "COMEX 黄金", stooq: "gc.f" },
  "SI=F": { code: "hf_SI", tencentCode: "hf_SI", name: "COMEX 白银", stooq: "si.f" },
  "CL=F": { code: "hf_CL", tencentCode: "hf_CL", name: "NYMEX WTI 原油", stooq: "cl.f" },
  "BZ=F": { code: "hf_OIL", tencentCode: "hf_OIL", name: "ICE 布伦特原油", stooq: "brn.f" },
  "HG=F": { code: "hf_HG", tencentCode: "hf_HG", name: "COMEX 铜", stooq: "hg.f" },
  "NG=F": { code: "hf_NG", tencentCode: "hf_NG", name: "NYMEX 天然气", stooq: "ng.f" },
  "PL=F": { code: "hf_PL", tencentCode: "hf_PL", name: "NYMEX 铂金", stooq: "pl.f" },
};
const ALERT_HISTORY_LIMIT = 200;
const DEFAULT_STATE_REVISION = 0;
const UPSTREAM_TIMEOUT_MS = {
  quote: 4500,
  history: 7000,
  search: 3500,
  hn: 5000,
};
const UPSTREAM_RETRIES = {
  quote: 1,
  history: 1,
  search: 1,
  hn: 1,
};
const CACHE_TTL_MS = {
  hn_top: 45 * 1000,
  stock_search: 8 * 1000,
};
const CACHE_STALE_MS = {
  hn_top: 2 * 60 * 1000,
  stock_search: 20 * 1000,
};
const endpointCache = new Map();
const QUOTE_LIBRARY = {
  economics: [
    {
      text: "价格不是数字本身，而是无数决策在特定时刻达成的妥协。市场越复杂，单点解释就越危险。",
      author: "Signal Notebook",
      source: "Economics Fragment",
    },
    {
      text: "大多数人高估短期波动的意义，却低估长期复利的力量。耐心本身也是一种稀缺资产。",
      author: "Signal Notebook",
      source: "Economics Fragment",
    },
    {
      text: "风险从来不是回撤之后才出现的，它在仓位形成的那一刻就已经存在。",
      author: "Signal Notebook",
      source: "Economics Fragment",
    },
    {
      text: "宏观叙事决定方向感，微观结构决定执行质量。两者缺一，判断就会失真。",
      author: "Signal Notebook",
      source: "Economics Fragment",
    },
  ],
  philosophy: [
    {
      text: "清晰不来自更多信息，而来自更少但更关键的问题。先问什么是必须知道的，再问剩下的。",
      author: "Signal Notebook",
      source: "Philosophy Fragment",
    },
    {
      text: "你无法控制结果，但可以设计过程。过程稳定，结果才有可讨论性。",
      author: "Signal Notebook",
      source: "Philosophy Fragment",
    },
    {
      text: "错误并不可怕，可怕的是用更复杂的解释去掩盖简单的错误。",
      author: "Signal Notebook",
      source: "Philosophy Fragment",
    },
    {
      text: "认知的边界往往不是知识不足，而是我们不愿意承认自己正在猜测。",
      author: "Signal Notebook",
      source: "Philosophy Fragment",
    },
  ],
  engineering: [
    {
      text: "系统稳定不是因为没有故障，而是因为故障发生时仍有可预期的退化路径。",
      author: "Signal Notebook",
      source: "Engineering Fragment",
    },
    {
      text: "工程中的“快”不是省略步骤，而是持续减少返工。一次性跑通，通常比反复修补更快。",
      author: "Signal Notebook",
      source: "Engineering Fragment",
    },
    {
      text: "可观测性不是锦上添花，它是系统在压力下保持可控的前提条件。",
      author: "Signal Notebook",
      source: "Engineering Fragment",
    },
    {
      text: "好的抽象会隐藏复杂度，坏的抽象会隐藏问题。两者表面都很干净，结果完全不同。",
      author: "Signal Notebook",
      source: "Engineering Fragment",
    },
  ],
};

class UpstreamFetchError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "UpstreamFetchError";
    this.details = details;
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

    if (url.pathname === "/api/quote") {
      await handleQuote(url, res);
      return;
    }

    if (url.pathname === "/api/quote/snippet") {
      await handleQuoteSnippet(url, res);
      return;
    }

    if (url.pathname === "/api/stock/search") {
      await handleStockSearch(url, res);
      return;
    }

    if (url.pathname === "/api/stock/history") {
      await handleStockHistory(url, res);
      return;
    }

    if (url.pathname === "/api/hn/top") {
      await handleHnTop(url, res);
      return;
    }

    if (url.pathname === "/api/state") {
      await handleState(req, res);
      return;
    }

    await handleStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, {
      error: normalizeError(error) || "服务内部错误",
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Dashboard server running at http://127.0.0.1:${PORT}`);
});

async function handleQuote(url, res) {
  const input = (url.searchParams.get("symbol") || "").trim();
  if (!input) {
    sendJson(res, 400, { error: "缺少 symbol 参数" });
    return;
  }

  const local = parseCnSymbol(input);

  if (local) {
    const attempts = [
      () => fetchEastMoneyQuote(local),
      () => fetchTencentQuote(local),
      () => fetchYahooQuote(toYahooSymbol(input)),
    ];
    const sourceErrors = [];

    for (const fn of attempts) {
      try {
        const quote = await fn();
        sendJson(res, 200, quote);
        return;
      } catch (error) {
        sourceErrors.push(normalizeUpstreamError(error));
      }
    }

    sendJson(res, 502, {
      error: `无法获取 ${input} 行情（数据源不可达或代码无效）`,
      details: sourceErrors,
    });
    return;
  }

  try {
    const normalized = toYahooSymbol(input);
    const commodityMeta = COMMODITY_SINA_CODE_MAP[normalized];
    if (commodityMeta) {
      const sourceErrors = [];
      const attempts = [
        () => fetchSinaCommodityQuote(normalized, commodityMeta),
        () => fetchTencentCommodityQuote(normalized, commodityMeta),
        () => fetchYahooQuote(normalized),
        () => fetchStooqCommodityQuote(normalized, commodityMeta),
      ];
      for (const fn of attempts) {
        try {
          const quote = await fn();
          sendJson(res, 200, quote);
          return;
        } catch (error) {
          sourceErrors.push(normalizeUpstreamError(error));
        }
      }
      sendJson(res, 502, {
        error: `无法获取 ${input} 行情（商品数据源不可达）`,
        details: sourceErrors,
      });
      return;
    }

    const quote = await fetchYahooQuote(normalized);
    sendJson(res, 200, quote);
  } catch (error) {
    sendJson(res, 502, {
      error: `无法获取 ${input} 行情：${normalizeError(error)}`,
    });
  }
}

async function handleState(req, res) {
  if (req.method === "GET") {
    const data = await readStateFile();
    sendJson(res, 200, data);
    return;
  }

  if (req.method === "POST") {
    const payload = await readJsonBody(req);
    if (!payload || !Array.isArray(payload.cards)) {
      sendJson(res, 400, { error: "状态格式错误，要求 { cards: [] , revision }" });
      return;
    }

    const currentState = await readStateFile();
    const incomingRevision = Number(payload.revision);
    if (!Number.isFinite(incomingRevision)) {
      sendJson(res, 400, {
        error: "缺少 revision 字段",
        revision: currentState.revision,
      });
      return;
    }
    if (incomingRevision !== Number(currentState.revision || DEFAULT_STATE_REVISION)) {
      sendJson(res, 409, {
        error: "state revision conflict",
        cards: currentState.cards,
        alerts: currentState.alerts,
        revision: currentState.revision,
        updatedAt: currentState.updatedAt || Date.now(),
      });
      return;
    }

    const normalizedAlerts = Object.prototype.hasOwnProperty.call(payload, "alerts")
      ? normalizeAlertState(payload.alerts)
      : normalizeAlertState(currentState.alerts);
    const nextRevision = Number(currentState.revision || DEFAULT_STATE_REVISION) + 1;
    await writeStateFile({
      cards: payload.cards,
      alerts: normalizedAlerts,
      revision: nextRevision,
      updatedAt: Date.now(),
    });
    sendJson(res, 200, { ok: true, revision: nextRevision });
    return;
  }

  sendJson(res, 405, { error: "Method Not Allowed" });
}

async function handleQuoteSnippet(url, res) {
  const topic = parseQuoteTopic(url.searchParams.get("topic"));
  const count = clampQuoteCount(url.searchParams.get("count"));

  const pool =
    topic === "mixed"
      ? [...QUOTE_LIBRARY.economics, ...QUOTE_LIBRARY.philosophy, ...QUOTE_LIBRARY.engineering]
      : QUOTE_LIBRARY[topic];

  const items = sampleQuoteItems(pool, count).map((item) => ({
    ...item,
    topic: topic === "mixed" ? inferQuoteTopic(item.source) : topic,
    timestamp: Date.now(),
  }));

  sendJson(res, 200, {
    topic,
    items,
  });
}

async function handleStockSearch(url, res) {
  const query = (url.searchParams.get("q") || "").trim();
  const limit = clampStockSearchLimit(url.searchParams.get("limit"));
  if (!query) {
    sendJson(res, 200, { items: [] });
    return;
  }

  const params = new URLSearchParams({
    input: query,
    type: "14",
    token: EASTMONEY_SEARCH_TOKEN,
    count: String(limit),
  });
  const endpoint = `https://searchapi.eastmoney.com/api/suggest/get?${params.toString()}`;
  const cacheKey = `stock-search:${query.toUpperCase()}:${limit}`;

  try {
    const payload = await fetchCachedWithSwr(
      cacheKey,
      () =>
        fetchJson(endpoint, {
          source: "eastmoney-search",
          timeoutMs: UPSTREAM_TIMEOUT_MS.search,
          retries: UPSTREAM_RETRIES.search,
        }),
      {
        ttlMs: CACHE_TTL_MS.stock_search,
        staleMs: CACHE_STALE_MS.stock_search,
      }
    );
    const rows = Array.isArray(payload?.QuotationCodeTable?.Data)
      ? payload.QuotationCodeTable.Data
      : [];

    const items = rows.map(normalizeStockSearchItem).filter(Boolean);
    sendJson(res, 200, { items });
  } catch {
    sendJson(res, 200, { items: [] });
  }
}

async function handleStockHistory(url, res) {
  const input = (url.searchParams.get("symbol") || "").trim();
  const days = clampStockHistoryDays(url.searchParams.get("days"));
  if (!input) {
    sendJson(res, 400, { error: "缺少 symbol 参数" });
    return;
  }

  const local = parseCnSymbol(input);
  if (local) {
    try {
      const payload = await fetchEastMoneyHistory(local, days);
      sendJson(res, 200, payload);
      return;
    } catch {
      // Fall through to Yahoo fallback.
    }
  }

  try {
    const payload = await fetchYahooHistory(toYahooSymbol(input), days);
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 502, {
      error: `无法获取 ${input} 历史行情：${normalizeError(error)}`,
    });
  }
}

async function handleHnTop(url, res) {
  const limit = clampHnLimit(url.searchParams.get("limit"));
  const cacheKey = `hn-top:${limit}`;
  let items = [];

  try {
    items = await fetchCachedWithSwr(
      cacheKey,
      async () => {
        const topIds = await fetchJson(HN_TOP_STORIES_URL, {
          source: "hn-topstories",
          timeoutMs: UPSTREAM_TIMEOUT_MS.hn,
          retries: UPSTREAM_RETRIES.hn,
        });

        if (!Array.isArray(topIds) || !topIds.length) {
          throw new UpstreamFetchError("Hacker News 热门列表为空", {
            source: "hn-topstories",
          });
        }

        const ids = topIds.slice(0, limit);
        const resolved = await Promise.all(
          ids.map(async (id) => {
            try {
              const item = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                source: "hn-item",
                timeoutMs: UPSTREAM_TIMEOUT_MS.hn,
                retries: UPSTREAM_RETRIES.hn,
              });
              return normalizeHnItem(item);
            } catch {
              return null;
            }
          })
        );
        return resolved.filter(Boolean);
      },
      {
        ttlMs: CACHE_TTL_MS.hn_top,
        staleMs: CACHE_STALE_MS.hn_top,
      }
    );
  } catch (error) {
    sendJson(res, 502, {
      error: "Hacker News 热门列表获取失败",
      details: [normalizeUpstreamError(error)],
    });
    return;
  }

  sendJson(res, 200, {
    items: items.filter(Boolean),
    source: "hacker-news",
  });
}

async function handleStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(safePath);
  const absPath = path.resolve(ROOT, `.${decoded}`);

  if (!absPath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let file;
  try {
    file = await fs.readFile(absPath);
  } catch {
    sendText(res, 404, "Not Found");
    return;
  }

  const ext = path.extname(absPath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
  res.end(file);
}

async function fetchEastMoneyQuote(local) {
  const secid = `${local.market === "SH" ? "1" : "0"}.${local.code}`;
  const fields = "f43,f44,f45,f47,f48,f57,f58,f60,f124";
  const url = `https://push2.eastmoney.com/api/qt/stock/get?invt=2&fltt=2&secid=${secid}&fields=${fields}`;

  const payload = await fetchJson(url, {
    source: "eastmoney-quote",
    timeoutMs: UPSTREAM_TIMEOUT_MS.quote,
    retries: UPSTREAM_RETRIES.quote,
  });
  const data = payload?.data;
  if (!data || data.f43 == null || data.f43 === "-") {
    throw new Error("EastMoney 无有效数据");
  }

  const price = scalePrice(data.f43);
  const prevClose = scalePrice(data.f60);
  const turnover = numberOrNull(data.f48);
  const volume = numberOrNull(data.f47);
  const avgPrice = inferIntradayAvgPrice(price, turnover, volume);
  const change = price != null && prevClose != null ? price - prevClose : null;
  const changePercent =
    change != null && prevClose ? (change / prevClose) * 100 : null;

  return {
    symbol: `${local.code}.${local.market === "SH" ? "SS" : "SZ"}`,
    name: data.f58 || `${local.market}${local.code}`,
    price,
    prevClose,
    avgPrice,
    change,
    changePercent,
    high: scalePrice(data.f44),
    low: scalePrice(data.f45),
    volume,
    currency: "CNY",
    timestamp: data.f124 ? Number(data.f124) * 1000 : Date.now(),
    source: "eastmoney",
  };
}

async function fetchTencentQuote(local) {
  const query = `${local.market.toLowerCase()}${local.code}`;
  const url = `https://qt.gtimg.cn/q=${query}`;

  const raw = await fetchText(url, {
    source: "tencent-quote",
    timeoutMs: UPSTREAM_TIMEOUT_MS.quote,
    retries: UPSTREAM_RETRIES.quote,
  });
  const matched = raw.match(/="([^"]+)";/);
  if (!matched) {
    throw new Error("Tencent 响应无法解析");
  }

  const parts = matched[1].split("~");
  if (parts.length < 35) {
    throw new Error("Tencent 数据字段不足");
  }

  const price = numberOrNull(parts[3]);
  const prevClose = numberOrNull(parts[4]);
  const volume = numberOrNull(parts[36]);
  const turnoverRaw = numberOrNull(parts[37]);
  const avgPrice = inferIntradayAvgPrice(
    price,
    Number.isFinite(turnoverRaw) ? turnoverRaw * 10000 : null,
    volume
  );
  if (price == null || prevClose == null || prevClose === 0) {
    throw new Error("Tencent 无有效成交价");
  }

  const change = price - prevClose;
  const changePercent = (change / prevClose) * 100;

  return {
    symbol: `${local.code}.${local.market === "SH" ? "SS" : "SZ"}`,
    name: parts[1] || `${local.market}${local.code}`,
    price,
    prevClose,
    avgPrice,
    change,
    changePercent,
    high: numberOrNull(parts[33]),
    low: numberOrNull(parts[34]),
    volume,
    currency: "CNY",
    timestamp: parseTencentTime(parts[30]),
    source: "tencent",
  };
}

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url, {
    source: "yahoo-quote",
    timeoutMs: UPSTREAM_TIMEOUT_MS.quote,
    retries: UPSTREAM_RETRIES.quote,
  });
  const quote = payload?.quoteResponse?.result?.[0];
  if (!quote || quote.regularMarketPrice == null) {
    throw new Error("Yahoo 无有效数据");
  }

  return {
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || symbol,
    price: quote.regularMarketPrice,
    prevClose: quote.regularMarketPreviousClose,
    avgPrice: null,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
    high: quote.regularMarketDayHigh,
    low: quote.regularMarketDayLow,
    volume: quote.regularMarketVolume,
    currency: quote.currency || "",
    timestamp: quote.regularMarketTime ? quote.regularMarketTime * 1000 : Date.now(),
    source: "yahoo",
  };
}

function inferIntradayAvgPrice(price, turnover, volume) {
  const px = numberOrNull(price);
  const amt = numberOrNull(turnover);
  const vol = numberOrNull(volume);
  if (!Number.isFinite(amt) || !Number.isFinite(vol) || amt <= 0 || vol <= 0) return null;

  const candidates = [
    amt / vol,
    amt / (vol * 100),
    (amt * 100) / vol,
    (amt * 10000) / vol,
    (amt * 10000) / (vol * 100),
  ].filter((value) => Number.isFinite(value) && value > 0);
  if (!candidates.length) return null;

  if (!Number.isFinite(px) || px <= 0) {
    return candidates[0];
  }

  const sorted = candidates
    .map((value) => ({
      value,
      err: Math.abs(value - px) / px,
    }))
    .sort((a, b) => a.err - b.err);
  const best = sorted[0];
  return best.err <= 0.65 ? best.value : null;
}

async function fetchSinaCommodityQuote(symbol, meta) {
  const url = `https://hq.sinajs.cn/list=${encodeURIComponent(meta.code)}`;
  const raw = await fetchText(url, {
    source: "sina-commodity-quote",
    timeoutMs: UPSTREAM_TIMEOUT_MS.quote,
    retries: UPSTREAM_RETRIES.quote,
  });
  const matched = raw.match(/="([^"]*)";/);
  if (!matched || !matched[1]) {
    throw new Error("新浪商品行情为空");
  }

  const fields = matched[1].split(",").map((item) => String(item || "").trim());
  if (!fields.length) {
    throw new Error("新浪商品行情字段为空");
  }

  const name = fields[0] || meta.name || symbol;
  const numericTail = fields.slice(1).map(numberOrNull).filter((value) => Number.isFinite(value));
  if (!numericTail.length) {
    throw new Error("新浪商品行情无有效价格");
  }

  const latest = numericTail[0];
  const dayWindow = numericTail.slice(0, Math.min(6, numericTail.length));
  const high = dayWindow.length ? Math.max(...dayWindow) : null;
  const low = dayWindow.length ? Math.min(...dayWindow) : null;
  const previous = Number.isFinite(numericTail[1]) && numericTail[1] > 0 ? numericTail[1] : null;
  const change = previous != null ? latest - previous : null;
  const changePercent = previous != null ? (change / previous) * 100 : null;

  const dateToken = fields.find((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
  const timeToken = fields.find((item) => /^\d{2}:\d{2}(:\d{2})?$/.test(item));
  const timestamp =
    dateToken && timeToken ? Date.parse(`${dateToken}T${timeToken.length === 5 ? `${timeToken}:00` : timeToken}`) : Date.now();

  return {
    symbol,
    name,
    price: latest,
    prevClose: previous,
    change,
    changePercent,
    high,
    low,
    volume: null,
    currency: "USD",
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    source: "sina-commodity",
  };
}

async function fetchStooqCommodityQuote(symbol, meta) {
  const stooqSymbol = String(meta?.stooq || "").trim();
  if (!stooqSymbol) {
    throw new Error("Stooq 商品代码缺失");
  }

  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
  const csv = await fetchText(url, {
    source: "stooq-commodity-quote",
    timeoutMs: UPSTREAM_TIMEOUT_MS.quote,
    retries: UPSTREAM_RETRIES.quote,
  });

  const lines = String(csv || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Stooq 商品行情为空");
  }

  const [headerLine, dataLine] = lines;
  const header = headerLine.split(",").map((item) => item.trim().toLowerCase());
  const data = dataLine.split(",").map((item) => item.trim());
  if (!header.length || data.length < header.length) {
    throw new Error("Stooq 商品行情格式异常");
  }

  const row = Object.create(null);
  header.forEach((key, index) => {
    row[key] = data[index];
  });

  const price = numberOrNull(row.close);
  if (!Number.isFinite(price)) {
    throw new Error("Stooq 商品无有效收盘价");
  }

  const high = numberOrNull(row.high);
  const low = numberOrNull(row.low);
  const open = numberOrNull(row.open);
  const change = Number.isFinite(open) ? price - open : null;
  const changePercent = Number.isFinite(open) && open !== 0 ? (change / open) * 100 : null;
  const timestamp = Date.parse(`${row.date || ""}T${row.time || "00:00:00"}Z`);

  return {
    symbol,
    name: meta?.name || symbol,
    price,
    prevClose: null,
    change,
    changePercent,
    high,
    low,
    volume: numberOrNull(row.volume),
    currency: "USD",
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    source: "stooq-commodity",
  };
}

async function fetchTencentCommodityQuote(symbol, meta) {
  const queryCode = String(meta?.tencentCode || "").trim();
  if (!queryCode) {
    throw new Error("腾讯商品代码缺失");
  }

  const url = `https://qt.gtimg.cn/q=${encodeURIComponent(queryCode)}`;
  const raw = await fetchText(url, {
    source: "tencent-commodity-quote",
    timeoutMs: UPSTREAM_TIMEOUT_MS.quote,
    retries: UPSTREAM_RETRIES.quote,
  });
  const matched = raw.match(/="([^"]*)";/);
  if (!matched || !matched[1]) {
    throw new Error("腾讯商品行情为空");
  }

  const fields = matched[1].split(",").map((item) => String(item || "").trim());
  if (!fields.length) {
    throw new Error("腾讯商品行情字段为空");
  }

  const name = fields[0] || meta?.name || symbol;
  const numericValues = fields
    .slice(1)
    .map(numberOrNull)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!numericValues.length) {
    throw new Error("腾讯商品行情无有效价格");
  }

  const price = numericValues[0];
  const prevClose = Number.isFinite(numericValues[1]) ? numericValues[1] : null;
  const open = Number.isFinite(numericValues[2]) ? numericValues[2] : null;
  const high = Number.isFinite(numericValues[3]) ? numericValues[3] : null;
  const low = Number.isFinite(numericValues[4]) ? numericValues[4] : null;

  let change = null;
  let changePercent = null;
  if (Number.isFinite(prevClose) && prevClose !== 0) {
    change = price - prevClose;
    changePercent = (change / prevClose) * 100;
  } else if (Number.isFinite(open) && open !== 0) {
    change = price - open;
    changePercent = (change / open) * 100;
  }

  return {
    symbol,
    name,
    price,
    prevClose,
    change,
    changePercent,
    high,
    low,
    volume: null,
    currency: "USD",
    timestamp: Date.now(),
    source: "tencent-commodity",
  };
}

async function fetchEastMoneyHistory(local, limit) {
  const secid = `${local.market === "SH" ? "1" : "0"}.${local.code}`;
  const params = new URLSearchParams({
    secid,
    ut: EASTMONEY_HISTORY_TOKEN,
    fields1: "f1,f2,f3,f4,f5,f6",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    klt: "101",
    fqt: "1",
    beg: "0",
    end: "20500101",
    lmt: String(limit),
  });
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?${params.toString()}`;

  const payload = await fetchJson(url, {
    source: "eastmoney-history",
    timeoutMs: UPSTREAM_TIMEOUT_MS.history,
    retries: UPSTREAM_RETRIES.history,
  });
  const data = payload?.data;
  const rows = Array.isArray(data?.klines) ? data.klines : [];
  const items = rows.map(parseEastMoneyKline).filter(Boolean);
  if (!items.length) {
    throw new Error("EastMoney 历史数据为空");
  }

  return {
    symbol: `${local.code}.${local.market === "SH" ? "SS" : "SZ"}`,
    name: data?.name || `${local.market}${local.code}`,
    interval: "1d",
    source: "eastmoney",
    items,
  };
}

async function fetchYahooHistory(symbol, limit) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - resolveHistoryWindowSeconds(limit);
  const params = new URLSearchParams({
    interval: "1d",
    includePrePost: "false",
    events: "div,splits",
    period1: String(start),
    period2: String(end),
  });
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;

  const payload = await fetchJson(url, {
    source: "yahoo-history",
    timeoutMs: UPSTREAM_TIMEOUT_MS.history,
    retries: UPSTREAM_RETRIES.history,
  });
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  const opens = Array.isArray(quote?.open) ? quote.open : [];
  const highs = Array.isArray(quote?.high) ? quote.high : [];
  const lows = Array.isArray(quote?.low) ? quote.low : [];
  const volumes = Array.isArray(quote?.volume) ? quote.volume : [];

  const items = timestamps
    .map((ts, index) => {
      const close = numberOrNull(closes[index]);
      if (!Number.isFinite(close)) return null;

      return {
        date: new Date(Number(ts) * 1000).toISOString().slice(0, 10),
        open: numberOrNull(opens[index]),
        close,
        high: numberOrNull(highs[index]),
        low: numberOrNull(lows[index]),
        volume: numberOrNull(volumes[index]),
      };
    })
    .filter(Boolean)
    .slice(-limit);

  if (!items.length) {
    throw new Error("Yahoo 历史数据为空");
  }

  return {
    symbol,
    name: result?.meta?.symbol || symbol,
    interval: "1d",
    source: "yahoo",
    items,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithPolicy(url, {
    ...options,
    parseAs: "json",
  });
  return response.data;
}

async function fetchText(url, options = {}) {
  const response = await fetchWithPolicy(url, {
    ...options,
    parseAs: "text",
  });
  return response.data;
}

async function fetchWithPolicy(url, options = {}) {
  const source = String(options.source || "upstream");
  const timeoutMs = Number.isFinite(Number(options.timeoutMs))
    ? Math.max(800, Number(options.timeoutMs))
    : 4000;
  const retries = Number.isFinite(Number(options.retries))
    ? Math.max(0, Math.floor(Number(options.retries)))
    : 0;
  const parseAs = options.parseAs === "text" ? "text" : "json";
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new UpstreamFetchError(`${source} HTTP ${response.status}`, {
          source,
          status: response.status,
          retriable: response.status >= 500 || response.status === 429,
          attempt,
        });
      }
      const data = parseAs === "text" ? await response.text() : await response.json();
      clearTimeout(timer);
      return { data, status: response.status, source, attempts: attempt + 1 };
    } catch (error) {
      clearTimeout(timer);
      const timedOut = error?.name === "AbortError";
      const normalizedError =
        error instanceof UpstreamFetchError
          ? error
          : new UpstreamFetchError(timedOut ? `${source} timeout` : normalizeError(error), {
              source,
              status: null,
              retriable: true,
              timeout: timedOut,
              attempt,
            });
      lastError = normalizedError;
      if (attempt >= retries) break;
      const backoffMs = 120 * (attempt + 1);
      await sleep(backoffMs);
    }
  }

  throw lastError || new UpstreamFetchError(`${source} request failed`, { source, retriable: true });
}

async function fetchCachedWithSwr(cacheKey, loader, options = {}) {
  const ttlMs = Number.isFinite(Number(options.ttlMs)) ? Math.max(200, Number(options.ttlMs)) : 3000;
  const staleMs = Number.isFinite(Number(options.staleMs)) ? Math.max(0, Number(options.staleMs)) : 0;
  const now = Date.now();
  const existing = endpointCache.get(cacheKey);

  if (existing && now < existing.expiresAt) {
    return existing.value;
  }

  if (existing && now < existing.staleUntil) {
    if (!existing.refreshing) {
      existing.refreshing = true;
      Promise.resolve()
        .then(loader)
        .then((value) => {
          endpointCache.set(cacheKey, {
            value,
            expiresAt: Date.now() + ttlMs,
            staleUntil: Date.now() + ttlMs + staleMs,
            refreshing: false,
          });
        })
        .catch(() => {
          existing.refreshing = false;
        });
    }
    return existing.value;
  }

  const value = await loader();
  endpointCache.set(cacheKey, {
    value,
    expiresAt: now + ttlMs,
    staleUntil: now + ttlMs + staleMs,
    refreshing: false,
  });
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

function parseCnSymbol(input) {
  const raw = input.trim().toUpperCase();

  let code;
  let market;

  if (/^(SH|SZ)\d{6}$/.test(raw)) {
    market = raw.slice(0, 2);
    code = raw.slice(2);
  } else if (/^\d{6}\.(SH|SS|SZ)$/.test(raw)) {
    const [left, right] = raw.split(".");
    code = left;
    market = right === "SH" || right === "SS" ? "SH" : "SZ";
  } else if (/^\d{6}$/.test(raw)) {
    code = raw;
    market = code.startsWith("6") ? "SH" : "SZ";
  }

  if (!code || !market) return null;

  return { code, market };
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

  return raw;
}

function scalePrice(value) {
  if (value == null || value === "-" || value === "") return null;
  const raw = String(value).trim();
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  if (raw.includes(".")) return num;
  if (Math.abs(num) >= 1000) return num / 100;
  return num;
}

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseTencentTime(value) {
  if (!value || value.length < 14) return Date.now();

  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  const hh = Number(value.slice(8, 10));
  const mm = Number(value.slice(10, 12));
  const ss = Number(value.slice(12, 14));

  if ([y, m, d, hh, mm, ss].some((v) => !Number.isFinite(v))) {
    return Date.now();
  }

  return new Date(y, m - 1, d, hh, mm, ss).getTime();
}

function clampStockHistoryDays(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 160;
  return Math.min(260, Math.max(30, Math.round(num)));
}

function clampStockSearchLimit(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 8;
  return Math.min(20, Math.max(3, Math.round(num)));
}

function parseEastMoneyKline(row) {
  if (typeof row !== "string") return null;
  const parts = row.split(",");
  if (parts.length < 6) return null;

  const [date, open, close, high, low, volume] = parts;
  const normalizedClose = numberOrNull(close);
  if (!date || !Number.isFinite(normalizedClose)) return null;

  return {
    date,
    open: numberOrNull(open),
    close: normalizedClose,
    high: numberOrNull(high),
    low: numberOrNull(low),
    volume: numberOrNull(volume),
  };
}

function normalizeStockSearchItem(item) {
  if (!item) return null;

  const code = String(item.Code || item.SecurityCode || "").trim();
  const name = String(item.Name || item.ShortName || "").trim();
  if (!code || !name) return null;

  const marketNum = String(item.MktNum || "").trim();
  const securityTypeName = String(item.SecurityTypeName || "").trim();

  let querySymbol = "";
  if (marketNum === "1") {
    querySymbol = `${code}.SS`;
  } else if (marketNum === "0") {
    querySymbol = `${code}.SZ`;
  } else if (/港/i.test(securityTypeName) && /^\d{4,5}$/.test(code)) {
    querySymbol = `${code.padStart(4, "0")}.HK`;
  } else {
    querySymbol = toYahooSymbol(code);
  }

  return {
    code,
    name,
    querySymbol,
    marketNum,
    securityTypeName,
  };
}

function resolveHistoryWindowSeconds(limit) {
  const tradingDays = Math.max(30, Number(limit) || 160);
  return tradingDays * 24 * 60 * 60 * 3;
}

function clampHnLimit(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 8;
  return Math.min(20, Math.max(3, Math.round(num)));
}

function normalizeHnItem(item) {
  if (!item || item.deleted || item.dead || !item.id || !item.title) return null;
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

function parseQuoteTopic(raw) {
  const normalized = String(raw || "").trim().toLowerCase();
  if (QUOTE_TOPICS.has(normalized)) return normalized;
  return "mixed";
}

function clampQuoteCount(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 1;
  return Math.min(3, Math.max(1, Math.round(num)));
}

function sampleQuoteItems(pool, count) {
  if (!Array.isArray(pool) || !pool.length) return [];
  const copied = [...pool];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied.slice(0, count);
}

function inferQuoteTopic(source) {
  const text = String(source || "").toLowerCase();
  if (text.includes("economics")) return "economics";
  if (text.includes("philosophy")) return "philosophy";
  if (text.includes("engineering")) return "engineering";
  return "mixed";
}

function extractDomain(url) {
  if (!url) return "news.ycombinator.com";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "news.ycombinator.com";
  }
}

async function readStateFile() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cards)) {
      return {
        cards: [],
        alerts: normalizeAlertState(null),
        revision: DEFAULT_STATE_REVISION,
        updatedAt: Date.now(),
      };
    }
    const revision = Number.isFinite(Number(parsed.revision))
      ? Number(parsed.revision)
      : Number.isFinite(Number(parsed.updatedAt))
        ? Number(parsed.updatedAt)
        : DEFAULT_STATE_REVISION;
    return {
      ...parsed,
      cards: parsed.cards,
      alerts: normalizeAlertState(parsed.alerts),
      revision,
      updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : Date.now(),
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        cards: [],
        alerts: normalizeAlertState(null),
        revision: DEFAULT_STATE_REVISION,
        updatedAt: Date.now(),
      };
    }
    throw error;
  }
}

function normalizeAlertState(alerts) {
  const fallback = {
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

  if (!alerts || typeof alerts !== "object") {
    return fallback;
  }

  return {
    ...fallback,
    ...alerts,
    enabled: typeof alerts.enabled === "boolean" ? alerts.enabled : fallback.enabled,
    silentMode: typeof alerts.silentMode === "boolean" ? alerts.silentMode : fallback.silentMode,
    lowPowerMode: typeof alerts.lowPowerMode === "boolean" ? alerts.lowPowerMode : fallback.lowPowerMode,
    soundEnabled: typeof alerts.soundEnabled === "boolean" ? alerts.soundEnabled : fallback.soundEnabled,
    vibrationEnabled: typeof alerts.vibrationEnabled === "boolean" ? alerts.vibrationEnabled : fallback.vibrationEnabled,
    panelCollapsed: typeof alerts.panelCollapsed === "boolean" ? alerts.panelCollapsed : fallback.panelCollapsed,
    totalTriggered: Number.isFinite(Number(alerts.totalTriggered))
      ? Math.max(0, Number(alerts.totalTriggered))
      : fallback.totalTriggered,
    rules: Array.isArray(alerts.rules) ? alerts.rules : [],
    history: Array.isArray(alerts.history) ? alerts.history.slice(-ALERT_HISTORY_LIMIT) : [],
  };
}

async function writeStateFile(payload) {
  const tmp = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload), "utf8");
  await fs.rename(tmp, STATE_FILE);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeError(error) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeUpstreamError(error) {
  if (error instanceof UpstreamFetchError) {
    return {
      message: error.message,
      source: error.details?.source || "",
      status: error.details?.status ?? null,
      timeout: Boolean(error.details?.timeout),
      retriable: Boolean(error.details?.retriable),
      attempt: Number.isFinite(Number(error.details?.attempt)) ? Number(error.details.attempt) : 0,
    };
  }
  return {
    message: normalizeError(error),
    source: "",
    status: null,
    timeout: false,
    retriable: false,
    attempt: 0,
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": MIME[".json"],
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}
