# Queue overview capstone

From the companion root, with the local teaching MongoDB running:

```text
npm run lab:capstone -- ../detour-capstone
cd ../detour-capstone
npm ci
npm test
```

Read ISSUE.md and DESIGN.md. These are synthetic documents, not exports from enterprise accounts. Return to the companion root and use the setup in agent/README.md before running:

```text
npm run agent:run -- ../detour-capstone ../capstone-run-001
npm run capstone:verify -- ../detour-capstone ../capstone-contract-001.json
npm run capstone:serve -- ../detour-capstone detour_capstone_demo 3100
```

The verifier requires a built candidate containing dist/src/server.js. Open http://127.0.0.1:3100 to inspect the interface manually. Empty data should display zeros. Seed a local teaching database with the candidate's named triage script to inspect nonzero counts. Stop the server with Ctrl+C. The independent verifier checks API behavior and HTML selectors; it is not a browser visual test.

Use new output paths. The starter deliberately lacks the solution. No deployment, public posting or external issue mutation is part of this task.
