# First delegation exercise

Use Node.js 24, Docker and Compose. Start the local teaching MongoDB server with `docker compose -p ai-detour-pilot up -d --wait` (once for the companion and exercise). Then run `npm ci` and `npm test` from this directory.

The intentionally faulty starting application has six original checks and twelve acceptance checks. Read ASSIGNMENT.md and reproduce the failures before editing. Keep the original tests and acceptance requirements intact. Run `npm run test:baseline` and `npm run test:acceptance` separately to inspect their results.

MongoDB is bound to 127.0.0.1:27128 with no authentication for synthetic local practice only. Tests create unique detour_test_* databases and delete only their own. Do not use a production database or real data. Stop the service with `docker compose -p ai-detour-pilot stop` when finished; its volume is preserved.
