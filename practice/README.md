# Inspectable workflow mechanisms

Run from the companion root on Node 24+:

```text
npm ci
npm run practice:check
npm run practice:test
```

Tests exercise context selection in UTF-8 bytes (not model tokens), stale and conflicting evidence, repeat detection, signed synthetic event envelopes, and real loopback HTTP retry/denial behavior. They do not connect to enterprise accounts.

## Joined feature workflow

Start the teaching MongoDB instance using the root README. Configure the authenticated coding harness using `agent/README.md`; model service use can incur costs under that account. The coding agent edits only a disposable exercise workspace. The coordinator needs write access to its new run directory and the teaching database.

```text
npm run pipeline -- start feature001 ../feature001 candidate
npm run pipeline -- status feature001
```

Every start stops at `candidate_ready` after implementation; the optional `candidate` word is retained for compatibility. A resume without an execution permit also leaves that state unchanged. The coding harness's sandbox does not carry over into the coordinator's host commands. Candidate tests and the independent verifier execute generated Node code with your ordinary host permissions. File hashes and allowed filenames do not contain harmful code.

For this trusted synthetic exercise, inspect the candidate source, new tests, package scripts, lockfiles and installed environment before allowing host execution. Do not use this host route for an untrusted repository or sensitive organizational environment; use an independently isolated verification runner with appropriate credentials and network restrictions instead. The candidate inventory covers source, scripts and lockfiles, but excludes `node_modules`, generated `dist` and Git internals. Keep installed dependencies trusted and unchanged; the permitted `npm test` rebuilds generated output before the verifier starts it. The permit does not attest to dependencies or authenticate a reviewer.

After inspection, create an explicit one-hour execution permit and resume:

```text
npm run pipeline:permit -- ../feature001 ../feature001-execution.json
npm run pipeline -- resume feature001 ../feature001-execution.json
```

The permit is bound to the job, current candidate digest and `execute-local-candidate-checks` scope. Changed source/lockfiles, wrong scope or expiry are rejected before verification begins. The permit is trusted local input, not a sandbox or final acceptance. Resume verifies that candidate without launching the coding agent again. A successful run reaches `awaiting_review`. Inspect `review-packet.json`, logs and independent checks; perform browser review separately. A terminal status alone is not acceptance.

Prepare a local decision after review:

```text
npm run pipeline:review -- ../feature001 accept ../feature001-decision.json
npm run pipeline -- decision feature001 ../feature001-decision.json
```

Use `reject` instead of `accept` for rejection. The decision expires in one hour and is bound to the candidate and review packet. This trusted local file is not an authenticated multi-user approval service. Acceptance does not create a PR, publish, deploy or grant additional tool access.

Duplicate start with the same job/directory returns saved state. Different directories under the same ID are rejected. Interrupted preparation/verification and unknown agent outcomes stop for inspection. A unique database lock prevents concurrent coordinators; a hard crash can leave that lock. Do not blindly delete it or start another agent. Inspect the owner/process and retained evidence first. This teaching pipeline does not promise automatic recovery from every crash or exactly-once external effects.

Practice tests require the teaching MongoDB service. The execution-permit tests use a controlled candidate command that writes a marker and deliberately fails: they verify no host execution without permission, identity/expiry/scope checks, and the authorized `verifying` to `failed` transition. They do not run a paid coding agent or claim a new model experiment.
