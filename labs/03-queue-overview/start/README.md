# Ticket service exercise

Synthetic TypeScript/Node.js/MongoDB CLI. Dependencies are installed with npm ci. MongoDB must already be available at 127.0.0.1:27128. Run npm test to compile and execute the 26 existing regression checks against real MongoDB. Tests create and remove only their own unique detour_test_* databases.

Read ISSUE.md for the feature. Existing commands: init, add, close, list and overdue. CLI requires --db; errors go to stderr with status 2, successful JSON to stdout. Run npm run build before using npm run triage --. Keep the original tests intact and add focused tests for the new behavior.
