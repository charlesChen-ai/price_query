# Personal Signal Monitor

A low-profile, card-based workspace for tracking market signals, reading curated information, and running lightweight strategy analysis/backtests.

> Current stage: MVP. Focused on market monitoring + analysis workflow.

## Highlights

- Card-based dashboard
  - Stock Quote Card (real-time quote, mini chart, intraday volume, PnL with cost basis)
  - Commodity Quote Card (gold/silver/oil/copper/natural gas/platinum)
  - Hacker News Top Card
  - Quote / Thinking Snippet Card
- Fine-grained per-card permissions
  - Show/hide metrics and visuals
  - Enable/disable manual actions
  - Auto-refresh control
- Technical and alert engine
  - MA / MACD / RSI / KDJ snapshots
  - Alert rules: `price`, `change`, `ma_breakout`, `macd_cross`, `rsi_zone`, `kdj_cross`, `kdj_zone`
  - Cooldown, silent mode, low-power scan mode, history stream
- Historical analysis & backtest page
  - Multi-strategy presets with configurable execution params
  - Timeline playback + signal markers
  - Strategy equity curve vs benchmark
  - CSV export (`history`, `technicals`, `backtest`)
- Safe persistence
  - Local fallback: `localStorage`
  - Server persistence: `.dashboard-state.json`
  - Revision-based conflict handling to prevent multi-tab overwrite

## Screens and Routes

- Dashboard: `/` (`index.html`)
- Analysis: `/analysis.html`

## Tech Stack

- Frontend: Vanilla HTML / CSS / JavaScript
- Backend: Node.js native `http`
- Data sources (fallback chain):
  1. EastMoney (CN stocks preferred)
  2. Tencent Quote (CN fallback)
  3. Yahoo Finance (global fallback)
- CI/Test:
  - Node native test runner (`node --test`)
  - GitHub Actions CI

## Quick Start

### Requirements

- Node.js 18+

### Run

```bash
node server.js
```

Open:

```text
http://127.0.0.1:8000
```

### Development Checks

```bash
npm run check
npm test
```

## Project Structure

```text
.
├── index.html
├── analysis.html
├── app.js
├── analysis.js
├── styles.css
├── server.js
├── core/
│   ├── shared-utils.js
│   ├── indicator-utils.js
│   ├── signal-policy.js
│   └── state-merge.js
├── tests/
├── docs/
│   ├── alert-engine-architecture.md
│   └── strategy-backtest-architecture.md
└── .dashboard-state.json   # runtime state (ignored by git)
```

## Persistence Model

- Frontend writes:
  - `localStorage` key: `stock_dashboard_cards_v1`
  - `localStorage` key: `stock_dashboard_alert_engine_v1`
- Server writes:
  - `POST /api/state` -> `.dashboard-state.json`
- Conflict safety:
  - `GET /api/state` returns `revision`
  - `POST /api/state` requires matching `revision`
  - On mismatch, server returns `409` with latest snapshot

## API Overview

- `GET /api/quote?symbol=...`
- `GET /api/stock/search?q=...&limit=...`
- `GET /api/stock/history?symbol=...&days=...`
- `GET /api/hn/top?limit=...`
- `GET /api/quote/snippet?topic=...&count=...`
- `GET /api/state`
- `POST /api/state`

## Known Limitations

- Market open/close logic is session-based; exchange holiday calendars are not integrated yet.
- Intraday volume chart is refresh-delta based (not tick-level).
- Single-user local deployment model; no auth/tenant isolation yet.

## Roadmap (Suggested)

- Exchange holiday calendar integration (CN/HK/US)
- Multi-asset support (ETF/index/futures/crypto)
- Portfolio-level position and contribution tracking
- More advanced chart overlays and factor views
- Webhook/notification channel extensions
- Stronger E2E coverage and release automation

## Contributing

Issues and PRs are welcome.

Recommended workflow:

1. Fork or create a feature branch from `main`
2. Keep changes focused and include tests where possible
3. Run `npm run check` and `npm test`
4. Open a PR with clear scope and validation notes

## Security / Runtime Notes

- `.dashboard-state.json` is runtime data and should not be committed.
- Do not store secrets in frontend code or committed config.

## License

No explicit license file is included yet.
If you plan to distribute this as a public open-source project, add a license file (for example, MIT) before wider reuse.
