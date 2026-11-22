# The AI Detour — code companion

Code and synthetic exercises for **The AI Detour: Rethinking Software Engineering with AI Agents**, by Saurabh Chase. Use the named `book-v1.0.0` release for the first edition; the default branch may change. See [runtime and chapter map](VERSIONS.md), [security boundaries](SECURITY.md) and [MIT license](LICENSE). A verified book purchase link will be added when available.

Download the complete source and `SHA256SUMS.txt` from the [book-v1.0.0 release](https://github.com/chasesaurabh/the-ai-detour/releases/tag/book-v1.0.0). Verify the ZIP's SHA-256 against that file, extract it, and open the `the-ai-detour-book-v1.0.0` directory before following setup below. This source release includes the labs and synthetic research; it is not a standalone executable.

A small TypeScript application running on Node.js, with a JSON CLI and local MongoDB persistence. It is synthetic teaching software for practicing bounded changes with coding agents.

## Setup

Install Node.js 24 and Docker with Compose. From this directory:

```sh
npm ci
docker compose -p ai-detour-pilot up -d --wait
npm test
```

TypeScript compiles to JavaScript in `dist/`. The application uses the MongoDB driver; additional teaching workflows use the pinned MCP, LangGraph and validation packages in package-lock.json. The MongoDB 8.0.17 image is pinned by digest. No Atlas account or API key is required for the local database exercises.

The frozen exercise starters retain their original dependency locks. In particular, their MongoDB driver is 7.9.1; the root uses 6.22.0 to match the official LangGraph MongoDB checkpointer. Both were tested with the same local server. Install each workspace with its own `npm ci`.

MongoDB listens on `127.0.0.1:27128`. The fixture has no authentication and is for local synthetic exercises only; do not expose it to a network or put real data in it. Tests create uniquely named `detour_test_*` databases on this local instance and remove only their own databases. Tests use a real MongoDB server, not an in-memory replacement. They fail when it is unavailable.

## Use the application

After `npm run build`:

```sh
npm run triage -- --db detour_demo init
npm run triage -- --db detour_demo add "Investigate export failure" --priority 1 --due 2026-11-21T13:00:00+02:00
npm run triage -- --db detour_demo overdue --as-of 2026-11-21T12:00:00Z
npm run triage -- --db detour_demo list
```

To close a ticket, run `npm run triage -- --db detour_demo close <id>`, replacing `<id>` with the returned ID. Fixed dates are teaching inputs, not real deadlines. Commands emit JSON; errors use stderr and exit status 2. `MONGODB_URI` can configure a separate CLI database connection; the automated tests always use the local teaching server.

## Earlier bug-fix exercise

With MongoDB still running, create a separate workspace:

```sh
npm run lab:prepare -- ../detour-first-task
cd ../detour-first-task
npm ci
npm test
```

The starting snapshot intentionally contains a faulty overdue selector. Read its assignment and failing acceptance checks. The preparation script refuses existing destinations and destinations inside the companion. Its parent directory must already exist. Paths containing spaces can be passed in quotes.

The companion root contains the corrected solution. Keep the agent in the separate exercise workspace. This is practice with visible tests, not a blind evaluation.

The small application preserves timestamps as offset-bearing strings and parses them when selecting overdue tickets. It loads open dated tickets in memory; it does not claim production-scale query performance. A later scaling exercise can introduce an indexed BSON Date alongside the original input, with an explicit migration. Recurring civil-time deadlines are outside this exercise.

When finished, `docker compose -p ai-detour-pilot stop` stops the local service while preserving its named volume. The same `up -d --wait` command restarts it.

## Autonomous feature workflow

For the main issue-to-reviewable-change example, use [agent/README.md](agent/README.md). It prepares a separate ticket-search exercise and runs one bounded assignment with a pinned coding harness, action records and independent contract verification. The root application remains the starting version; no completed search solution is supplied to the agent. The initial launcher targets Windows MXC.

## Visible loop, MCP and saved progress

Use [workflow/README.md](workflow/README.md) for the TypeScript diagnosis loop, real local MCP connection and fresh-process checkpoint continuation. It uses synthetic read-only tools and a separately configured local model. Named npm scripts cover controller checks, model startup and run/resume. The isolated faulty comparison is a teaching fixture, not a change to the application's Store.

## Evaluation, durable workflows and capstone

See [operations/README.md](operations/README.md) for the fixed model evaluation, MongoDB-backed LangGraph, queue, events, bounded worker, permissions exercise and investigator comparison. See [labs/03-queue-overview/README.md](labs/03-queue-overview/README.md) for the final API and browser feature. These programs have deliberately separate contracts; the scheduler does not automatically launch unrestricted code editing.

Recorded decision results are in [research/decision-evaluation](research/decision-evaluation/README.md). A completed capstone implementation is under solutions/queue-overview for inspection after attempting the lab. Do not supply the solution directory to an agent intended to start from the exercise.

## Context policies and joined feature pipeline

See [practice/README.md](practice/README.md) for tested context selection, signed synthetic intake, HTTP recovery and a MongoDB-backed feature coordinator. The coordinator prepares an isolated exercise, runs one coding assignment, saves its candidate, resumes independent verification in a fresh process and stops for local review. It does not publish or deploy.
