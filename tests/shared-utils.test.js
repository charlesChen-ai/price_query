const test = require("node:test");
const assert = require("node:assert/strict");
const { toYahooSymbol } = require("../core/shared-utils.js");

test("toYahooSymbol supports CN formats", () => {
  assert.equal(toYahooSymbol("600519"), "600519.SS");
  assert.equal(toYahooSymbol("300750"), "300750.SZ");
  assert.equal(toYahooSymbol("SH600519"), "600519.SS");
  assert.equal(toYahooSymbol("600519.SH"), "600519.SS");
});

test("toYahooSymbol supports HK formats", () => {
  assert.equal(toYahooSymbol("hk00700"), "00700.HK");
  assert.equal(toYahooSymbol("0700"), "0700.HK");
  assert.equal(toYahooSymbol("0700.HK"), "0700.HK");
});
