# Runtime and chapter map

The book's companion release is `book-v1.0.0`; the small application package has its own version,0.1.0. Use the named book release for printed examples. The default branch can evolve.

| Area | Pinned/tested recipe | Chapters |
|---|---|---|
| Application | Node.js24, TypeScript5.9.3, MongoDB8.0.17 | 2–3 |
| Coding harness | Codex CLI0.171.0; supplied launcher uses Windows MXC | 3,16 |
| Explicit loop and MCP | MCP client/server2.4.0, Zod4.6.7 | 4–6 |
| Local inference | vLLM0.30.0; pinned Qwen model snapshots in workflow/README | 4,7,11–14 |
| Durable graph | LangGraph1.7.5, MongoDB checkpointer1.5.2 | 11 |
| Root database driver | MongoDB driver6.22.0 | application/workflows |
| Frozen exercise driver | MongoDB driver7.9.1; install each exercise's own lockfile | isolated labs |
| Context, intake and coordinator | practice/README, named policy tests | 6,9,12,16 |

The application compiles to JavaScript and requires Node.js. The complete source archive includes labs and research that would not be supplied by a small compiled application alone. No standalone native executable or universal operating-system support is claimed. Controller/policy tests require no GPU; database tests need Docker/MongoDB. Live inference requires the documented NVIDIA environment and model files. Vendor account guides are documented routes; local fixtures do not establish live enterprise access.

Model experiments used a specific research machine and configuration described with their results. Allocation flags permit configuration changes; option validation does not establish successful inference on untested hardware.
