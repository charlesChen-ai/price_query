const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateSma,
  calculateSmaSeries,
  calculateRsi,
  calculateRsiSeries,
  calculateKdjSnapshot,
} = require("../core/indicator-utils.js");

test("calculateSma returns expected average", () => {
  assert.equal(calculateSma([1, 2, 3, 4, 5], 5), 3);
  assert.equal(calculateSma([10, 20, 30], 2), 25);
});

test("calculateRsi and rsi series produce finite values on volatile data", () => {
  const values = [10, 11, 9, 10, 12, 11, 13, 12, 11, 12, 13, 14, 13, 15, 16, 15, 17, 18, 17];
  const rsi = calculateRsi(values, 14);
  const series = calculateRsiSeries(values, 14);
  assert.equal(Number.isFinite(rsi), true);
  assert.equal(Number.isFinite(series[series.length - 1]), true);
  assert.equal(series.length, values.length);
});

test("calculateKdjSnapshot returns current and previous points", () => {
  const bars = Array.from({ length: 20 }).map((_, i) => ({
    close: 10 + i * 0.2,
    high: 10 + i * 0.25 + 0.3,
    low: 10 + i * 0.15 - 0.2,
  }));
  const kdj = calculateKdjSnapshot(bars, 9);
  assert.equal(Number.isFinite(kdj.k), true);
  assert.equal(Number.isFinite(kdj.d), true);
  assert.equal(Number.isFinite(kdj.j), true);
  assert.equal(Number.isFinite(kdj.previousK), true);
});

test("calculateSmaSeries aligns size", () => {
  const values = [1, 2, 3, 4, 5, 6];
  const series = calculateSmaSeries(values, 3);
  assert.equal(series.length, values.length);
  assert.equal(series[1], null);
  assert.equal(series[2], 2);
});
