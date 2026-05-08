# Lighthouse Audits

Release-ship regression check for accessibility, best practices, SEO, and (for the StartScreen) performance. Runs once at the end of each `vX.Y` release, alongside `npm run typecheck` and the test suites.

The output is a set of four `.html` + `.json` reports archived under this folder. Compare against the previous release's reports; any regression in A11y or Best Practices is ship-blocking until investigated.

## What gets audited

| Variant                       | Form factor | Lighthouse mode | What it covers                                |
| ----------------------------- | ----------- | --------------- | --------------------------------------------- |
| `audit-light`, `audit-dark`   | desktop     | navigation      | StartScreen on cold load (full perf trace)    |
| `editor-audit-light`, `-dark` | mobile      | snapshot        | Editor view after clicking **New Tree**       |

The Editor uses **snapshot** mode because the editor isn't a deep-linkable URL — you have to click past the StartScreen first. Snapshot audits the page in its current rendered state without re-navigating, so it skips Performance entirely. That's why every editor report shows `Perf 0` — it's "not measured", not a regression.

## Prerequisites

- Node 20+ and a system Chrome (`/usr/bin/google-chrome` on Linux). `chrome-launcher` discovers it automatically.
- Dev dependencies declared in `package.json`: `lighthouse@13`, `puppeteer-core@23`, `chrome-launcher`. `npm install` is enough.

## Run an audit

```bash
# 1. Build a production bundle
npm run build

# 2. Start vite preview on http://localhost:4173/ (leave running)
npm run preview &

# 3. Drive the four audits and archive the reports
node scripts/lighthouse-audit.mjs v1.5

# 4. Stop the preview
pkill -f "vite preview"
```

Pass the version slug as the script's only argument (`v1.5`, `v2.0`, etc.). Reports land at `docs/lighthouse/<slug>-{audit,editor-audit}-{light,dark}.report.{html,json}`. The script prints a score line per variant when it finishes — e.g. `[ok] audit-light: Perf 100 / A11y 100 / BP 100 / SEO 83`.

If any score regressed against the prior release, fix the issue before committing the archive (see the next two sections).

## Read the report

Each `*.report.json` is a Lighthouse Result (LHR) object. Three surfaces are worth knowing:

- `categories.<id>.score` — 0–1 per category (`performance`, `accessibility`, `best-practices`, `seo`).
- `categories.<id>.auditRefs[]` — the list of audit IDs that contribute to that category.
- `audits[<id>]` — `{ score, title, description, details }` per audit. `details.items[].node.snippet` (or `.selector`) points at the offending DOM element when an audit fails.

To list every failed audit in a report:

```bash
node -e "
  const r = require('./docs/lighthouse/v1.4-editor-audit-light.report.json');
  for (const cat of Object.values(r.categories))
    for (const ref of cat.auditRefs) {
      const a = r.audits[ref.id];
      if (a.score !== null && a.score < 1)
        console.log(cat.id, ref.id, a.score, '-', a.title);
    }
"
```

This prints every audit whose individual score is below 1, including known low-weight items that don't move the category score (e.g. `seo meta-description`, `seo robots-txt`, `agentic-browsing llms-txt` are present in every editor report and explain the baseline SEO 67). The signal is what's *new* vs. the prior release's run — diff this output against the same one-liner pointed at `v(X.Y-1)-editor-audit-light.report.json`.

To see *what* element triggered the failure, drop into the same audit's `details.items`:

```bash
node -e "
  const r = require('./docs/lighthouse/v1.4-editor-audit-light.report.json');
  const a = r.audits['aria-required-children'];
  for (const item of (a.details?.items ?? []))
    console.log(item.node?.snippet || item.node?.selector || item);
"
```

For a graphical view, open the `.report.html` file directly in a browser — same data, with the audit's "Learn more" link to MDN/web.dev.

## Walk a failure to a fix (worked example, v1.4)

The first v1.4 run regressed editor A11y from 100 → 95. Walking it:

1. **Find the failure.** The list one-liner above pointed at `accessibility aria-required-children`.
2. **Find the element.** The audit's `details.items[0].node.snippet` was the TabBar's `<div role="tablist" aria-label="Trees">`. Title: *"Elements with an ARIA `[role]` that require children to contain a specific `[role]` are missing some or all of those required children."*
3. **Trace to source.** `grep` for `role="tablist"` → `src/components/tab-bar/TabBar.tsx`. The outer container had the role, but the actual `role="tab"` buttons sat inside an `overflow-x-auto` scroll-wrapper `<div>` — axe-core walks direct children only, so it never found tabs.
4. **Fix.** Move `role="tablist"` and `aria-label="Trees"` onto the scroll wrapper that directly contains the tab buttons. The `+` action button and confirm modal stay as siblings outside the tablist (they aren't tabs).
5. **Verify.** Re-run the audit. A11y back to 100. Commit `e114720`.

The lesson: when an audit fails, follow the snippet → element → role/structure chain. The fix is rarely the audit itself; it's the structural assumption the audit revealed.

## Compare to the previous release

Drop the new and prior reports into a delta table and put it in the ship commit message:

| Audit             | Mode             | v(prior) (P/A/BP/SEO) | v(new) (P/A/BP/SEO) | Δ      |
| ----------------- | ---------------- | --------------------- | ------------------- | ------ |
| StartScreen light | desktop nav      | 97 / 100 / 100 / 83   | 100 / 100 / 100 / 83 | Perf +3 |
| StartScreen dark  | desktop nav      | 97 / 100 / 100 / 83   | 100 / 100 / 100 / 83 | Perf +3 |
| Editor light      | mobile snapshot  | 0 / 100 / 100 / 67    | 0 / 100 / 100 / 67   | flat    |
| Editor dark       | mobile snapshot  | 0 / 100 / 100 / 67    | 0 / 100 / 100 / 67   | flat    |

Treat A11y and Best Practices regressions as ship-blocking. Performance ±2 is normal noise on snapshot-less navigation runs; investigate larger drops. SEO has been stable at 83 (StartScreen) / 67 (Editor) since v1.1 — both are limited by the lack of a public crawlable description, not something we plan to chase.

## Archive convention

- Filenames: `vX.Y-{audit,editor-audit}-{light,dark}.report.{html,json}`.
- Commit both `.html` and `.json`. The `.html` is the human-readable artifact; the `.json` is what the failure-walking one-liners above grep against.
- Bundle the eight files into the release ship commit. v1.4 example: commit `7316bd6`.

## Gotchas

- **Theme is forced via localStorage**, not OS-level `prefers-color-scheme`. The script writes `localStorage['bt-visualizer-preferences'] = '{"state":{"theme":"dark"},"version":2}'` so the FOUC script in `index.html` picks up the theme on first paint. Lighthouse's navigation audit clears storage by default; the script passes `disableStorageReset: true` to keep our seed alive across the audit's own navigation.
- **Snapshot mode skips Performance.** Editor reports always show `Perf 0`. That's the API, not a regression.
- **The "New Tree" click matches by exact text.** If `StartScreen.tsx` renames the button, update the `clickNewTree()` matcher in `scripts/lighthouse-audit.mjs`.
- **Mobile form factor for the Editor matches the v1.3 baseline.** Don't switch to desktop without re-baselining the Editor scores against a fresh prior run; otherwise regressions/improvements will be impossible to attribute.
