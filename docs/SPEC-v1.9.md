# Spec: v1.9 — Image Export

> Status: **Drafted 2026-05-11.** Awaiting review.
> Source: `docs/ideas/v1.8-v1.10-batch.md`

## Objective

Add a single-action export of the currently active tree as a PNG image. Two modes: **transparent** (no background, no overlays) for use in slides and docs, and **themed background** (current canvas bg color) for standalone screenshots.

Standalone feature — no coupling with v1.8 changes or v1.10's cross-tree work. One new dependency.

## Feature

### FR1 — Export tree as PNG

**User flow:**

1. Click the **Export image** button in the Toolbar (icon: `image-down` or similar; tooltip: "Export tree as PNG").
2. Modal opens with:
   - **Mode** toggle: `Transparent` | `Themed background` (default: Themed).
   - **Filename** input, prefilled with `<treeName>.png` (e.g., `MainTree.png`).
   - **Export** primary button, **Cancel** secondary button.
3. On Export:
   - The image renders the current active tree at full bounds (not just visible viewport).
   - Captured at 2× pixel ratio for retina/print quality.
   - Browser download is triggered with the chosen filename.
   - Modal closes; toast or transient message confirms `Exported <filename>` (using existing toast infra if present, else inline below button).

**Modes:**

- **Transparent:** `Background` (dotted/grid), `AxisOverlay`, `OriginCross` are temporarily hidden during capture. Resulting PNG has alpha channel; only the nodes + edges are visible.
- **Themed background:** Capture as-is including the current theme's canvas background color. AxisOverlay and OriginCross are *also* hidden (the chrome lines are too noisy for an exported image). Only the dotted Background plus solid bg color is rendered.

### Capture mechanism

- Library: **`html-to-image`** (~14 KB gzipped, no peer deps, works with SVG-heavy DOM).
- Target node: the React Flow `.react-flow` root element (use a `ref` from `Canvas.tsx`, not document-querySelector).
- Strategy: temporarily set a transient store flag `exportInProgress: 'transparent' | 'themed' | null`. The flag drives:
  - Whether `AxisOverlay`, `OriginCross`, and (in transparent mode) the xyflow `<Background>` render.
  - Whether the node selection ring (`box-shadow` from `selected: true` in BTNode.tsx) is suppressed during the snapshot — exports should not show the selected-node ring.
- The transient flag is set, the next React paint flushes the conditional removals, then `htmlToImage.toPng()` runs against the cleaned DOM, then the flag clears. Use `await new Promise(r => requestAnimationFrame(r))` between flag-set and capture to guarantee paint.
- Bounds: use xyflow's `getRectOfNodes(nodes) + getViewport` math (or `getNodesBounds` in xyflow 12) to compute the tree's bounding box, then pass it to `htmlToImage.toPng({ width, height, style: { transform: ... } })` so the image contains all nodes regardless of current viewport.

### Acceptance criteria

- AC1.1: Toolbar shows an Export image button between Validate and the file name (or in a logical UI slot to be confirmed during build).
- AC1.2: Button is **disabled** when the active tree has zero nodes (no Root state). Tooltip explains why.
- AC1.3: Modal opens with the mode toggle defaulting to **Themed background**.
- AC1.4: Filename input is prefilled with `<activeTree.name>.png`. The `.png` suffix is enforced on Export (auto-appended if missing).
- AC1.5: Empty filename → Export button disabled.
- AC1.6: Pressing Esc cancels the modal; clicking outside the modal cancels (existing modal pattern from v1.4 T11 delete-confirm).
- AC1.7: Transparent export produces a PNG with alpha channel (verified by reading PNG header in the test fixture or by visual inspection).
- AC1.8: Themed export produces a PNG that matches the current theme's canvas bg (light: light bg, dark: dark bg).
- AC1.9: Both exports include all nodes and edges, not only those visible in the current viewport.
- AC1.10: Both exports exclude the AxisOverlay and OriginCross overlays.
- AC1.11: Both exports exclude the per-node selection ring (test case: select a node, export, verify no ring on that node in the output).
- AC1.12: PNG output is 2× the logical pixel size (verify via reading PNG dimensions vs. node bounding box).
- AC1.13: Export does not push a history snapshot.
- AC1.14: After export, the canvas returns to its prior visual state (overlays restored, selection ring restored).
- AC1.15: If `htmlToImage.toPng()` throws, the modal stays open and shows an inline error like "Export failed: <message>"; the transient flag clears.

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Add `html-to-image` dependency. |
| `src/components/toolbar/Toolbar.tsx` | Add Export image button. |
| `src/components/export/ExportImageModal.tsx` | New: modal with mode toggle + filename input + capture handler. |
| `src/hooks/useExportImage.ts` | New: encapsulates flag setting, RAF wait, `htmlToImage.toPng` call, download trigger. |
| `src/store/bt-store.ts` | Add transient `exportInProgress: 'transparent' \| 'themed' \| null` field + setter. **Not in undoStack/redoStack**. |
| `src/components/canvas/Canvas.tsx` | Read `exportInProgress`; conditionally hide `AxisOverlay`, `OriginCross`, and (transparent mode) `<Background>`. Forward ref to React Flow root for the capture target. |
| `src/components/canvas/BTNode.tsx` | Read `exportInProgress`; suppress the selection `box-shadow` ring when truthy. |
| `tests/component/ExportImageModal.test.tsx` | New: AC1.3–1.6, AC1.15. |
| `tests/unit/export-filename.test.ts` | New: filename suffix enforcement. |
| `e2e/export-image.spec.ts` | New: open modal → export → verify download triggers (Playwright `page.waitForEvent('download')`). |

## Files NOT Modified

- `src/core/model/operations.ts` — no model change.
- `src/core/serialization/*` — image export is parallel to JSON serialization, not part of it.
- `docs/bt-json-format.md` — no schema change.

## Boundaries

**Always do:**
- Set/clear the `exportInProgress` flag in a single atomic flow (try/finally pattern in `useExportImage`).
- Use `requestAnimationFrame` (or `setTimeout(..., 0)`) between flag set and capture so React commits the conditional unmounts.
- Compute bounds from `getNodesBounds()` (xyflow 12 export), not from the current viewport — the export must show the entire tree.
- Match existing modal markup/keybindings from v1.4 T11.

**Ask first:**
- If `html-to-image` rendering of xyflow edges (which use SVG paths) has fidelity issues — may need to inline computed styles for SVG.
- If the user wants a custom resolution control beyond fixed 2×.

**Never do:**
- Capture the entire `document.body` — only the React Flow viewport subtree.
- Push to undo/redo for the export action.
- Introduce a fallback to `dom-to-image` or `canvas2html` — pick `html-to-image` and stick with it.
- Block on the user wanting SVG export (out of scope per refined inventory).
- Add CDN font loading or any external network call inside the capture path (PWA boundary holds).

## Testing Strategy

| Level | What to test |
|-------|-------------|
| Unit (Vitest) | Filename suffix enforcement (`MyTree` → `MyTree.png`, `MyTree.png` → `MyTree.png`, `MyTree.PNG` → `MyTree.PNG.png` — match v1.1 file rename precedent). Bounds calculation with multi-node fixture. |
| Component (RTL) | Modal renders both modes; toggle works; Export button disabled on empty filename or empty tree; Esc/backdrop cancels; error path renders inline error. |
| E2E (Playwright) | Click Toolbar button → modal opens → click Export → `page.on('download')` fires with expected filename. Two specs: one transparent, one themed. **Do not** assert pixel values of the PNG (too brittle); assert filename + that the download completes. |

## Edge Cases

- **Empty tree:** Button disabled (AC1.2).
- **Single Root only:** Export works; PNG contains the single Root node.
- **Tree larger than browser viewport:** Capture must include all nodes; verify with a fixture of 20+ nodes spanning beyond visible bounds.
- **Dark theme:** Themed mode picks up `--bt-canvas-bg` dark token; transparent mode is unaffected.
- **Very long node names:** Existing `truncate` class in BTNode.tsx already handles overflow; export reflects what's on screen.
- **Active selection:** Selection ring suppressed during export (AC1.11).
- **Export during a drag gesture:** Not realistic (modal blocks pointer events on canvas), but: if it happens, the snapshot is whatever the DOM is at capture time. Acceptable.

## Success Criteria (v1.9)

1. User can export the current tree as a PNG in two modes via a single Toolbar action.
2. Transparent mode produces a clean image suitable for embedding in slides over a designed background.
3. Themed mode produces a self-contained image suitable for documentation screenshots.
4. Both modes capture the full tree, not just the visible viewport.
5. Export never modifies the document or pushes history.
6. No new test failures; bundle size growth ≤ 20 KB gzipped.
