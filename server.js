const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const STATE_FILE = path.join(ROOT, ".dashboard-state.json");
const HN_TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const EASTMONEY_SEARCH_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";
const QUOTE_TOPICS = new Set(["mixed", "economics", "philosophy", "engineering"]);
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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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

    for (const fn of attempts) {
      try {
        const quote = await fn();
        sendJson(res, 200, quote);
        return;
      } catch {
        // Continue to next source.
      }
    }

    sendJson(res, 502, {
      error: `无法获取 ${input} 行情（数据源不可达或代码无效）`,
    });
    return;
  }

  try {
    const quote = await fetchYahooQuote(toYahooSymbol(input));
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
      sendJson(res, 400, { error: "状态格式错误，要求 { cards: [] }" });
      return;
    }

    await writeStateFile({
      cards: payload.cards,
      updatedAt: Date.now(),
    });
    sendJson(res, 200, { ok: true });
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

  try {
    const endpoint = `https://searchapi.eastmoney.com/api/suggest/get?${params.toString()}`;
    const payload = await fetchJson(endpoint);
    const rows = Array.isArray(payload?.QuotationCodeTable?.Data)
      ? payload.QuotationCodeTable.Data
      : [];

    const items = rows.map(normalizeStockSearchItem).filter(Boolean);
    sendJson(res, 200, { items });
  } catch {
    sendJson(res, 200, { items: [] });
  }
}

async function handleHnTop(url, res) {
  const limit = clampHnLimit(url.searchParams.get("limit"));
  const topIds = await fetchJson(HN_TOP_STORIES_URL);

  if (!Array.isArray(topIds) || !topIds.length) {
    sendJson(res, 502, { error: "Hacker News 热门列表为空" });
    return;
  }

  const ids = topIds.slice(0, limit);
  const items = await Promise.all(
    ids.map(async (id) => {
      try {
        const item = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return normalizeHnItem(item);
      } catch {
        return null;
      }
    })
  );

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
  const fields = "f43,f44,f45,f47,f57,f58,f60,f124";
  const url = `https://push2.eastmoney.com/api/qt/stock/get?invt=2&fltt=2&secid=${secid}&fields=${fields}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`EastMoney HTTP ${response.status}`);
  }

  const payload = await response.json();
  const data = payload?.data;
  if (!data || data.f43 == null || data.f43 === "-") {
    throw new Error("EastMoney 无有效数据");
  }

  const price = scalePrice(data.f43);
  const prevClose = scalePrice(data.f60);
  const change = price != null && prevClose != null ? price - prevClose : null;
  const changePercent =
    change != null && prevClose ? (change / prevClose) * 100 : null;

  return {
    symbol: `${local.code}.${local.market === "SH" ? "SS" : "SZ"}`,
    name: data.f58 || `${local.market}${local.code}`,
    price,
    change,
    changePercent,
    high: scalePrice(data.f44),
    low: scalePrice(data.f45),
    volume: numberOrNull(data.f47),
    currency: "CNY",
    timestamp: data.f124 ? Number(data.f124) * 1000 : Date.now(),
    source: "eastmoney",
  };
}

async function fetchTencentQuote(local) {
  const query = `${local.market.toLowerCase()}${local.code}`;
  const url = `https://qt.gtimg.cn/q=${query}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Tencent HTTP ${response.status}`);
  }

  const raw = await response.text();
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
  if (price == null || prevClose == null || prevClose === 0) {
    throw new Error("Tencent 无有效成交价");
  }

  const change = price - prevClose;
  const changePercent = (change / prevClose) * 100;

  return {
    symbol: `${local.code}.${local.market === "SH" ? "SS" : "SZ"}`,
    name: parts[1] || `${local.market}${local.code}`,
    price,
    change,
    changePercent,
    high: numberOrNull(parts[33]),
    low: numberOrNull(parts[34]),
    volume: numberOrNull(parts[36]),
    currency: "CNY",
    timestamp: parseTencentTime(parts[30]),
    source: "tencent",
  };
}

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Yahoo HTTP ${response.status}`);
  }

  const payload = await response.json();
  const quote = payload?.quoteResponse?.result?.[0];
  if (!quote || quote.regularMarketPrice == null) {
    throw new Error("Yahoo 无有效数据");
  }

  return {
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || symbol,
    price: quote.regularMarketPrice,
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

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
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

function clampStockSearchLimit(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 8;
  return Math.min(20, Math.max(3, Math.round(num)));
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
      return { cards: [] };
    }
    return parsed;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { cards: [] };
    }
    throw error;
  }
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
