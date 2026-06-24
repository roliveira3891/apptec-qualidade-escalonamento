# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small Node.js "escalation bot" (`evolution-wpp`) that queries a MariaDB database for
incomplete field-service activities ("Atividades não Iniciadas"), groups them by how long
they have been pending, and sends one WhatsApp message per management tier to a group via
the Evolution API. Code, comments, and message text are in Brazilian Portuguese.

## Commands

There is no build step and no test suite (`npm test` is a placeholder that exits 1).

```bash
node src/index.js   # run the bot once
```

`src/index.js` currently calls `init()` directly (runs once, then `process.exit()`). The
recurring scheduler is commented out — see the `setInterval(executarTarefa, 30 * 60 * 1000)`
line and the `//executarTarefa();` line. To restore the "every 30 min" behavior described in
the console logs, re-enable those.

## Configuration

All secrets/config live in `.env` (loaded with `require('dotenv').config()` in every entry
file). `.env` is committed to the repo and holds live credentials — treat it as sensitive.
Required keys:

- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` — MariaDB connection (`src/config/db.js`)
- `EVOLUTION_URL`, `EVOLUTION_KEY`, `EVOLUTION_INSTANCE` — Evolution API endpoint + auth
- `WHATSAPP_GROUP_ID` — destination group/number
- `PROXY_URL`, `PROXY_PORT` — outbound HTTP proxy used for the Evolution API call

Note: `axios` and `dotenv` are imported at runtime but are **not** listed in
`package.json` dependencies (only `mariadb`, `moment`, `moment-timezone` are). They resolve
from `node_modules` but are absent from the manifest — add them if reinstalling from scratch.

## Architecture

Three modules, one linear flow (`src/index.js` → `reportServices` → `evolutionApi`):

- **`src/config/db.js`** — exports a shared `mariadb` connection pool (`connectionLimit: 10`).
  Import this pool anywhere a query is needed; do not create new pools.

- **`src/services/reportServices.js`** — `gerarRelatoriosPorCargo()` is the core logic.
  It runs one SQL query against `ne.base_eta_nodejs`, filtering for rows where
  `astatus = 'Nao Iniciada'`, `date = CURDATE()`, `tecnologia = 'GPON'`, and a parseable
  `time_slot`. `TIMESTAMPDIFF` computes minutes elapsed since the slot start (relative to
  *now in `America/Sao_Paulo`*, passed as a bound parameter). Rows are bucketed by elapsed
  minutes into six management tiers (the `cargos` array): coord (100–120), ger (120–180),
  ger_s (180–240), dir_r (240–300), dir_e (300–360), vp (≥360). Returns an **array of
  preformatted WhatsApp message strings, one per tier** that has any matching rows.
  `formatarCidade()` normalizes cluster names to a fixed 12-char column for the
  monospace (` ``` `) table in the message.

- **`src/services/evolutionApi.js`** — `enviarParaWhatsapp(texto)` POSTs one message to
  `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}` through the configured proxy,
  authenticating with the `apikey` header.

The minute thresholds and the tier definitions are tightly coupled: changing a boundary in
the SQL `SUM(...)` expressions must stay in sync with the `cargos` keys, and vice versa.

## Conventions

- The codebase is heavily `console.log`-instrumented (e.g. `'try evolution'`, `'init'`) —
  these are debug traces, not user-facing output.
- API/DB errors are caught and logged but not rethrown; a failed WhatsApp send will not stop
  the loop over the other tier messages.
