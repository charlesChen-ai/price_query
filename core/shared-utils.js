(function initDashboardCore(root) {
  const core = {
    toFiniteNumber,
    numberOrNull,
    toYahooSymbol,
    escapeHtml,
    debounce,
    formatNumber,
    formatSigned,
    formatSignedFixed,
    formatCompact,
  };

  root.DashboardCore = Object.assign({}, root.DashboardCore || {}, core);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }

  function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function numberOrNull(value) {
    return toFiniteNumber(value);
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
})(typeof globalThis !== "undefined" ? globalThis : this);
