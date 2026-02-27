(function initIndicatorCore(root) {
  const indicatorCore = {
    calculateSma,
    calculateSmaAt,
    calculateSmaSeries,
    calculateEmaSeries,
    calculateRsi,
    calculateRsiSeries,
    calculateKdjSnapshot,
  };

  root.DashboardIndicatorCore = Object.assign({}, root.DashboardIndicatorCore || {}, indicatorCore);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = indicatorCore;
  }

  function calculateSma(values, period) {
    if (!Array.isArray(values) || values.length < period) return null;
    const window = values.slice(-period);
    const sum = window.reduce((acc, value) => acc + value, 0);
    return sum / period;
  }

  function calculateSmaAt(values, index, period) {
    if (!Array.isArray(values) || index < period - 1) return null;
    const window = values.slice(index + 1 - period, index + 1);
    const sum = window.reduce((acc, value) => acc + value, 0);
    return sum / period;
  }

  function calculateSmaSeries(values, period) {
    if (!Array.isArray(values) || !values.length) return [];
    return values.map((_, index) => calculateSmaAt(values, index, period));
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

  function calculateRsiSeries(values, period) {
    if (!Array.isArray(values) || !values.length) return [];
    if (period <= 0) return values.map(() => null);

    const rsiSeries = values.map(() => null);
    if (values.length <= period) return rsiSeries;

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
    rsiSeries[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let index = period + 1; index < values.length; index += 1) {
      const delta = values[index] - values[index - 1];
      const nextGain = delta > 0 ? delta : 0;
      const nextLoss = delta < 0 ? -delta : 0;
      avgGain = (avgGain * (period - 1) + nextGain) / period;
      avgLoss = (avgLoss * (period - 1) + nextLoss) / period;
      rsiSeries[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return rsiSeries;
  }

  function calculateKdjSnapshot(bars, period = 9) {
    const numberOrNull = root.DashboardCore?.numberOrNull || ((value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    });

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
})(typeof globalThis !== "undefined" ? globalThis : this);
