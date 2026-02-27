const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldAllowSameBarEntry, signalSourceForStrategy } = require("../core/signal-policy.js");

test("shouldAllowSameBarEntry respects noSameBarReentry", () => {
  assert.equal(shouldAllowSameBarEntry({ noSameBarReentry: true }, true), false);
  assert.equal(shouldAllowSameBarEntry({ noSameBarReentry: false }, true), true);
  assert.equal(shouldAllowSameBarEntry({ noSameBarReentry: true }, false), true);
});

test("signalSourceForStrategy resolves source", () => {
  assert.equal(signalSourceForStrategy("macd_cross", "buy", "signal"), "MACD");
  assert.equal(signalSourceForStrategy("price_breakout", "sell", "signal"), "Breakdown");
  assert.equal(signalSourceForStrategy("hybrid", "sell", "stop_loss"), "Risk");
});
