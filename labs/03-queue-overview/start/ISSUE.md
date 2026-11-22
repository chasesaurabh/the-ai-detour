# Issue: a read-only queue overview

Build a small HTTP API and browser view for the existing ticket application. This is a new task, not the earlier search feature. Follow DESIGN.md. Finish with a review packet; no commits, external messages, publishing or deployment.

## Contract

- Implement src/server.ts. Compiled entry point supports `--db NAME --port N`, where N is 0 through 65535. Bind only 127.0.0.1. After listening write one JSON line {port:N} to stdout; no other stdout logs. Reject missing/invalid arguments with nonzero exit. Use local MongoDB at 127.0.0.1:27128; no external services.
- GET /api/summary?asOf=TIMESTAMP returns JSON {open:number,closed:number,overdue:number,byPriority:{"1":number,"2":number,"3":number}}. byPriority counts open tickets only. overdue counts open tickets with non-null dueAt strictly earlier than asOf as an instant. Equivalent instants are excluded. Use the existing timestamp validation contract, including explicit offsets. asOf is required exactly once; reject all other query keys with HTTP400. Percent-encoded offsets must work. Invalid dates/arguments return HTTP400 with {error:string}; no stack traces.
- The endpoint must not return ticket titles, IDs or dueAt values. It must not write, migrate or close tickets. It may read the small synthetic dataset using the existing Store. No scale claim is required. Other methods on these routes return HTTP405, unknown paths HTTP404.
- GET / serves an HTML page with h1 Queue overview, labeled Open, Overdue and Closed cards, and Open by priority counts. Provide a labeled asOf input and Refresh button. Input defaults to 2026-11-21T14:00:00Z. Fetch /api/summary, populate cards, and render errors as text. UI must not embed raw record strings or use unsanitized HTML insertion. Observe DESIGN.md.
- Preserve existing CLI/store behavior, original tests and stored values. Add tests for the API and document usage. No new dependencies or changes to package/config/ISSUE/DESIGN/existing tests. You may edit src/, add tests/, update README.md.
- Run baseline before changes. Run full tests and actually exercise the server before finishing. Stop and report unresolved access/requirements rather than bypassing boundaries.

## Completion

Report changed files, observed commands/results, limitations and proposed PR title/body. No success claim based solely on unexecuted tests. This task ends at review, not integration.
