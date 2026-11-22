# Issue: find the tickets that need attention

The team can list all tickets, but cannot select a manageable page of matching work. Add a read-only `search` CLI command and a corresponding Store method. Complete implementation, regression tests and README usage documentation. Finish with a review packet; do not commit, push, publish, merge or contact anyone.

## Contract

- `search --db NAME` returns a JSON array of existing Ticket objects, sorted by ascending ticket ID. Defaults: all statuses/priorities, no title filter, limit 20, offset 0.
- Optional `--status open|closed`, `--priority 1|2|3`, `--text TEXT`, `--limit N`, `--offset N`. Combine filters with AND, then sort, then paginate. An empty page is `[]`.
- `--text` matches a case-insensitive literal substring of the stored title. Characters such as `.`, `*`, `[`, `]`, `(`, `)` and backslash are literal, not a regular expression supplied by the caller. Empty text is invalid; a nonempty whitespace substring is allowed literally. Do not trim the search string.
- Limit is a decimal integer from 1 through 100. Offset is a decimal nonnegative safe integer. CLI numeric syntax is digits only (leading zeros allowed). Reject signs, spaces, decimals, exponent notation, infinity and unsafe integers. Invalid input exits 2 with a useful stderr message and no success JSON.
- Search-only flags (`--status`, `--text`, `--limit`, `--offset`) must fail on every other command. Existing `--priority` remains valid on add and is newly valid on search. `--due` remains add-only and `--as-of` overdue-only. Search accepts no positional argument.
- Store.search(options) must validate its public options independently, including integer range checks, even when there are no records. Preserve document shape, original timestamp strings, existing command behavior and data. Do not mutate or migrate records.
- Use MongoDB filtering/sorting/pagination; do not fetch the complete collection and filter in application memory. Escape literal search input correctly. No index performance promise or production-scale claim is required.
- Add tests for combined filters, literal metacharacters, pagination, invalid input and flag isolation, plus README command examples. Existing tests cannot be removed or weakened.

## Scope and completion

Work only in this copied exercise. Use its installed dependencies and local MongoDB; no new dependencies, outside files, credentials, network services or Git operations. You may change src/, add tests/, and update README.md. Do not change package files, configuration, ISSUE.md or existing tests. Execute the original baseline before editing, then run the full checks after changes. Diagnose ordinary implementation failures and continue within scope without requesting a prompt for each step. If access or a requirement prevents completion, stop and report the exact blocker. End with changed files, observed commands/outcomes, remaining limits and a suggested PR title/body. No invented results.
