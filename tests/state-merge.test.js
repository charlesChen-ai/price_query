const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeDashboardState } = require("../core/state-merge.js");

test("mergeDashboardState prefers newer card snapshot", () => {
  const local = {
    cards: [{ id: "a", name: "Local", lastUpdatedAt: 200 }],
    alerts: { rules: [], history: [], totalTriggered: 0 },
  };
  const remote = {
    cards: [{ id: "a", name: "Remote", lastUpdatedAt: 100 }],
    alerts: { rules: [], history: [], totalTriggered: 0 },
    revision: 5,
  };
  const merged = mergeDashboardState(local, remote);
  assert.equal(merged.cards[0].name, "Local");
  assert.equal(merged.revision, 5);
});

test("mergeDashboardState deduplicates alert rules by id", () => {
  const local = {
    cards: [],
    alerts: {
      rules: [{ id: "r1", createdAt: 200, enabled: true }],
      history: [{ id: "h1", triggeredAt: 200 }],
      totalTriggered: 2,
    },
  };
  const remote = {
    cards: [],
    alerts: {
      rules: [{ id: "r1", createdAt: 100, enabled: false }, { id: "r2", createdAt: 100, enabled: true }],
      history: [{ id: "h1", triggeredAt: 100 }, { id: "h2", triggeredAt: 50 }],
      totalTriggered: 1,
    },
    revision: 3,
  };

  const merged = mergeDashboardState(local, remote, { alertHistoryLimit: 10 });
  assert.equal(merged.alerts.rules.length, 2);
  assert.equal(merged.alerts.rules.find((item) => item.id === "r1").enabled, true);
  assert.equal(merged.alerts.history.length, 2);
  assert.equal(merged.alerts.totalTriggered, 2);
});
