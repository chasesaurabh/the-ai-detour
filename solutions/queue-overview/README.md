# Ticket service exercise

Completed synthetic TypeScript/Node.js/MongoDB queue overview. Dependencies are installed with npm ci. MongoDB must already be available at 127.0.0.1:27128. Run npm test to compile and execute thirty tests, including the original twenty-six regression checks, against real MongoDB. Tests create and remove only their own unique detour_test_* databases. Use the separate lab starter when practicing the assignment; this folder contains the finished implementation.

Read ISSUE.md for the feature. Existing commands: init, add, close, list and overdue. CLI requires --db; errors go to stderr with status 2, successful JSON to stdout. Run npm run build before using npm run triage --. Keep the original tests intact and add focused tests for the new behavior.

## Queue overview

Build and start the server with the name of your local ticket database.

```sh
npm run build
npm run serve -- --db your_ticket_db --port 8080
```

The server listens on `127.0.0.1`. Ports `0` through `65535` are accepted. Use `--port 0` to let the OS select a port and read the assigned port from the single startup JSON line. Keep MongoDB running at `127.0.0.1:27128` and press Ctrl+C to stop the HTTP server.

Open `http://127.0.0.1:8080/` for the overview. It loads counts for `2026-11-21T14:00:00Z` on startup. Enter a timestamp with an explicit timezone and select **Refresh** to change the cutoff.

To call the read-only API directly, send one `asOf` query parameter. Percent-encode the `+` in a positive offset as `%2B`.

```text
GET /api/summary?asOf=2026-11-21T16%3A00%3A00%2B02%3A00
```

The response contains `open`, `closed`, `overdue`, and `byPriority` with keys `1`, `2`, and `3`. Priority counts cover open tickets. Overdue counts cover open tickets with a deadline strictly before `asOf`, comparing the instants represented by the timestamps. Invalid queries return HTTP 400 with a JSON `error`. Unsupported methods on known routes return 405, and unknown paths return 404.

`npm test` runs the CLI and store regressions plus HTTP checks against the local MongoDB fixture.
