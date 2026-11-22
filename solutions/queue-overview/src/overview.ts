export const overviewPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Queue overview</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f7fc; color: #152440; font: 1rem/1.5 system-ui, sans-serif; }
    main { max-width: 52rem; margin: auto; padding: clamp(1rem, 5vw, 3rem); }
    h1 { margin: 0 0 1.25rem; font-size: clamp(1.8rem, 5vw, 2.75rem); }
    h2 { font-size: 1.25rem; margin: 1.75rem 0 .75rem; }
    label { display: block; margin-bottom: .35rem; font-weight: 600; }
    .controls { display: flex; flex-wrap: wrap; gap: .5rem; }
    input, button { font: inherit; padding: .55rem .8rem; border-radius: .4rem; }
    input { flex: 1 1 17rem; min-width: 0; color: inherit; border: 1px solid #677895; }
    button { color: white; background: #204db5; border: 1px solid #204db5; cursor: pointer; }
    :focus-visible { outline: 2px solid #204db5; outline-offset: 3px; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin: 1.25rem 0 0; }
    .cards div { padding: .85rem 1rem; border: 1px solid #d5ddec; border-radius: .6rem; background: white; }
    .cards dd { margin: .2rem 0 0; font-size: 1.65rem; font-weight: 700; overflow-wrap: anywhere; }
    h2 + .cards { margin-top: 0; }
    #error { color: #921f30; }
    #error:empty { margin: 0; }
    @media (max-width: 36rem) { .cards { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Queue overview</h1>
    <form id="summary-form">
      <label for="as-of">As of (timestamp with timezone)</label>
      <div class="controls">
        <input id="as-of" name="asOf" type="text" value="2026-11-21T14:00:00Z">
        <button id="refresh" type="submit">Refresh</button>
      </div>
    </form>
    <p id="error" role="alert"></p>
    <dl class="cards">
      <div><dt>Open</dt><dd id="open-count">—</dd></div>
      <div><dt>Overdue</dt><dd id="overdue-count">—</dd></div>
      <div><dt>Closed</dt><dd id="closed-count">—</dd></div>
    </dl>
    <h2>Open by priority</h2>
    <dl class="cards">
      <div><dt>Priority 1</dt><dd id="priority-1">—</dd></div>
      <div><dt>Priority 2</dt><dd id="priority-2">—</dd></div>
      <div><dt>Priority 3</dt><dd id="priority-3">—</dd></div>
    </dl>
  </main>
  <script>
    const asOf = document.getElementById('as-of');
    const error = document.getElementById('error');
    const counts = ['open-count', 'overdue-count', 'closed-count', 'priority-1', 'priority-2', 'priority-3']
      .map(id => document.getElementById(id));
    let latestRequest = 0;

    async function refresh() {
      const request = ++latestRequest;
      error.textContent = '';
      for (const count of counts) count.textContent = '—';
      try {
        const query = new URLSearchParams({ asOf: asOf.value });
        const response = await fetch('/api/summary?' + query);
        const summary = await response.json();
        if (request !== latestRequest) return;
        if (!response.ok) {
          error.textContent = summary.error;
          return;
        }
        const values = [summary.open, summary.overdue, summary.closed,
          summary.byPriority[1], summary.byPriority[2], summary.byPriority[3]];
        counts.forEach((count, index) => { count.textContent = String(values[index]); });
      } catch {
        if (request === latestRequest) error.textContent = 'Unable to load queue summary';
      }
    }

    document.getElementById('summary-form').addEventListener('submit', event => {
      event.preventDefault();
      return refresh();
    });
    refresh();
  </script>
</body>
</html>`;
