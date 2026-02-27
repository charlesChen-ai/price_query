(function initStateMerge(root) {
  const core = {
    mergeDashboardState,
  };

  root.DashboardStateMergeCore = Object.assign({}, root.DashboardStateMergeCore || {}, core);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }

  function mergeDashboardState(localState, remoteState, options = {}) {
    const historyLimit = Number.isFinite(Number(options.alertHistoryLimit))
      ? Math.max(1, Math.floor(Number(options.alertHistoryLimit)))
      : 180;
    const local = localState && typeof localState === "object" ? localState : {};
    const remote = remoteState && typeof remoteState === "object" ? remoteState : {};

    const localCards = Array.isArray(local.cards) ? local.cards : [];
    const remoteCards = Array.isArray(remote.cards) ? remote.cards : [];

    const cards = mergeCardsByRecency(localCards, remoteCards);
    const alerts = mergeAlerts(local.alerts, remote.alerts, historyLimit);

    return {
      cards,
      alerts,
      revision: Number.isFinite(Number(remote.revision)) ? Number(remote.revision) : Number(remote.updatedAt) || 0,
      updatedAt: Date.now(),
    };
  }

  function mergeCardsByRecency(localCards, remoteCards) {
    const merged = new Map();

    remoteCards.forEach((card) => {
      if (!card || typeof card !== "object") return;
      const id = String(card.id || "");
      if (!id) return;
      merged.set(id, card);
    });

    localCards.forEach((card) => {
      if (!card || typeof card !== "object") return;
      const id = String(card.id || "");
      if (!id) return;
      const remoteCard = merged.get(id);
      if (!remoteCard) {
        merged.set(id, card);
        return;
      }

      const localAt = resolveCardFreshness(card);
      const remoteAt = resolveCardFreshness(remoteCard);
      if (localAt >= remoteAt) {
        merged.set(id, card);
      }
    });

    return Array.from(merged.values());
  }

  function resolveCardFreshness(card) {
    if (!card || typeof card !== "object") return 0;
    const candidates = [
      Number(card.updatedAt),
      Number(card.lastUpdatedAt),
      Number(card.dailySeriesUpdatedAt),
      Number(card.quote?.timestamp),
      Number(card.createdAt),
    ].filter((value) => Number.isFinite(value) && value > 0);
    return candidates.length ? Math.max(...candidates) : 0;
  }

  function mergeAlerts(localAlerts, remoteAlerts, historyLimit) {
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

    const local = localAlerts && typeof localAlerts === "object" ? localAlerts : {};
    const remote = remoteAlerts && typeof remoteAlerts === "object" ? remoteAlerts : {};

    const rules = mergeById(
      Array.isArray(local.rules) ? local.rules : [],
      Array.isArray(remote.rules) ? remote.rules : [],
      (item) => Math.max(Number(item.createdAt) || 0, Number(item.lastTriggeredAt) || 0)
    );

    const history = mergeById(
      Array.isArray(local.history) ? local.history : [],
      Array.isArray(remote.history) ? remote.history : [],
      (item) => Number(item.triggeredAt) || 0
    )
      .sort((left, right) => (Number(right.triggeredAt) || 0) - (Number(left.triggeredAt) || 0))
      .slice(0, historyLimit);

    const localTotal = Number(local.totalTriggered);
    const remoteTotal = Number(remote.totalTriggered);
    const totalTriggered = Math.max(
      Number.isFinite(localTotal) ? localTotal : 0,
      Number.isFinite(remoteTotal) ? remoteTotal : 0,
      history.length
    );

    return {
      ...fallback,
      ...remote,
      ...local,
      rules,
      history,
      totalTriggered,
    };
  }

  function mergeById(localItems, remoteItems, freshnessResolver) {
    const map = new Map();

    remoteItems.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const id = String(item.id || "");
      if (!id) return;
      map.set(id, item);
    });

    localItems.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const id = String(item.id || "");
      if (!id) return;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, item);
        return;
      }

      const localAt = Number(freshnessResolver(item)) || 0;
      const remoteAt = Number(freshnessResolver(prev)) || 0;
      if (localAt >= remoteAt) {
        map.set(id, item);
      }
    });

    return Array.from(map.values());
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
