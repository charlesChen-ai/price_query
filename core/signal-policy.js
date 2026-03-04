(function initSignalPolicy(root) {
  const core = {
    shouldAllowSameBarEntry,
    signalSourceForStrategy,
  };

  root.DashboardSignalPolicyCore = Object.assign({}, root.DashboardSignalPolicyCore || {}, core);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }

  function shouldAllowSameBarEntry(execution, hadExitOnCurrentBar) {
    if (!hadExitOnCurrentBar) return true;
    if (!execution || typeof execution !== "object") return false;
    return execution.noSameBarReentry === false;
  }

  function signalSourceForStrategy(strategyType, direction, reasonCode = "") {
    if (reasonCode === "stop_loss" || reasonCode === "take_profit" || reasonCode === "max_hold") {
      return "Risk";
    }
    if (strategyType === "ma_cross") return "MA";
    if (strategyType === "macd_cross") return "MACD";
    if (strategyType === "rsi_reversion") return "RSI";
    if (strategyType === "kdj_cross") return "KDJ";
    if (strategyType === "bollinger_reversion") return "BOLL";
    if (strategyType === "price_breakout") return direction === "buy" ? "Breakout" : "Breakdown";
    return "Composite";
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
