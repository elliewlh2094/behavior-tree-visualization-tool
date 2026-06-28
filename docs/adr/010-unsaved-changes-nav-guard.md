# ADR 010 — Unsaved-changes guard on leaving the editor (data router + useBlocker)

**Date:** 2026-06-27
**Status:** Accepted

## Context

FR9 (v1.11) added unsaved-changes tracking: a store-derived `dirty` flag, a `● ` title indicator, and `useBeforeUnload(dirty)` — a `beforeunload` listener that triggers the browser's native "Leave site?" dialog on tab close / refresh.

Checkpoint-B testing exposed a gap. `beforeunload` only fires on a **document unload** (closing the tab, reloading). It does **not** fire on in-app SPA navigation — most importantly, pressing the browser **Back** button to go from `#/editor` to the landing page `#/`, which is a hash change handled entirely by React Router with no unload. So a user could edit a tree, hit Back, and silently lose their work.

An earlier attempt guarded the *landing page's* entry actions instead ("Go to Editor" reset, template cards) with a `window.confirm`. That was the wrong seam: it treated "Back to landing" as safe and deferred the prompt to the next overwrite. The user's requirement is that **leaving the editor canvas itself** — by Back, close, or refresh — must prompt Stay/Leave and be cancelable, the same mental model the native dialog gives for close/refresh.

Intercepting and *canceling* an in-app navigation requires a navigation blocker. React Router's `useBlocker` provides exactly this, but only inside a **data router** (`createHashRouter` + `RouterProvider`). The app was using the `<HashRouter>` component, which does not support `useBlocker`.

## Decision

1. **Migrate routing from the `<HashRouter>` component to a data router** — `createHashRouter([...])` + `<RouterProvider>` in `App.tsx`. URLs, the hash-based strategy (AD7), per-route theming (AD8), and the PWA are all unchanged; this only unlocks the data-router APIs.

2. **Block in-app navigation away from a dirty editor with `useBlocker`.** `EditorRoute` calls `useBlocker(dirty)`. When `blocker.state === 'blocked'`, it renders a custom `UnsavedChangesModal` (matching the app's `--bt-*` modal style) with **Stay on page** → `blocker.reset()` and **Leave page** → `blocker.proceed()`. "Stay" is the safe default (autofocused; Esc and backdrop click also map to it). Wording mirrors the native `beforeunload` buttons so both paths read the same.

3. **Keep `useBeforeUnload(dirty)` for hard exits.** Close-tab / refresh still use the browser's native (non-customizable) dialog; only in-app POP navigation uses the custom modal. The two are complementary, not redundant — they cover disjoint exit mechanisms.

4. **Remove the landing-page `confirmDiscardIfDirty` guards.** The only path from a dirty editor to the landing page is a navigation the blocker already intercepts, so a second prompt there would double-ask. "Go to Editor" keeps its unconditional reset to a blank `Untitled.json`; template cards load directly.

5. **Guard the one remaining in-place overwrite: Toolbar "Open".** Opening a file replaces the document without navigating, so neither the blocker nor `beforeunload` catches it.
   - **Revised (unify all app-controllable discards to one modal):** Open now routes through the **same custom `UnsavedChangesModal`** as the nav blocker, not a `window.confirm`. The modal was generalized into a presentational confirm component taking copy props (`DiscardCopy`: title/message/confirmLabel/cancelLabel) so each context reads naturally — nav says "Stay on page / Leave page", Open says "Cancel / Discard & open" — while sharing one visual shell. A `useDiscardGuard` hook holds the imperative pending-action state; EditorRoute exposes `requestDiscard(action, copy)` through `UnsavedGuardContext`; Toolbar wraps both Open entry points (button + Ctrl/Cmd+O) with it. `useFileOpen.triggerOpen()` is now guard-free (just opens the picker).
   - **Scope of unification:** only actions that *replace the whole document via `setDocument`* are guarded. In-editor that is just Open (Go to Editor / templates run from the landing page, already protected upstream by the nav blocker). **New Tree (`addTree`) and delete-tree (`deleteTree`) are deliberately NOT guarded** — they add/remove a tab within the same document and are undoable, so they are ordinary edits, not document-discards (delete-tree keeps its own delete-specific confirm). The `requestDiscard` mechanism is reusable for any future replace-document action.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| **Keep `<HashRouter>`, intercept `popstate` manually** | Reimplements `useBlocker` (re-push history on cancel, track the pending location) with hash-router edge cases. `useBlocker` is the supported primitive; the data-router migration is small and localized to `App.tsx`. |
| **Guard the landing-page entry actions instead (the prior approach)** | Wrong seam: lets the user leave the canvas first and prompts only at the next overwrite, so "Back" itself never warns. Contradicts the requirement that leaving the canvas is the thing to guard. |
| **One unified custom modal for close/refresh too** | Impossible — `beforeunload` cannot show custom UI or run async; the browser forces its own dialog. The split (native for unload, custom for in-app nav) is inherent. |
| **Leave Open on a native `window.confirm`** | Inconsistent with the custom nav modal. Unifying gives every app-controllable discard one themed UI; the imperative/declarative gap is bridged by a small `useDiscardGuard` + `requestDiscard` context (~one hook + one context). The only cost is parameterized copy, which also makes each prompt read naturally. |
| **Also guard New Tree / delete-tree** | They don't discard the document — additive/removal edits within one document, fully undoable. Prompting "you'll lose unsaved changes" there is semantically wrong and adds friction to ordinary editing. |

## Consequences

- **Two guards, disjoint coverage:** `beforeunload` (close/refresh, native dialog) + `useBlocker` (in-app nav, custom Stay/Leave modal). Both keyed on the same store `dirty`, so a clean document adds zero friction anywhere.
- **"Stay" is non-destructive and reliable:** a blocked POP is reverted by React Router and the canvas/edits are untouched; "Leave" proceeds the original navigation.
- **Landing page is guard-free**, avoiding double prompts; "Go to Editor" still always opens a blank `Untitled.json`.
- **Every app-controllable discard shares one custom modal** — in-app nav (blocker) and Open (`requestDiscard`) — with per-context copy; only browser close/refresh stays native. The Open overwrite (a data-loss path that predated this change) is now closed and visually consistent.
- **Routing is now a data router.** Future routing features should use data-router APIs (loaders/actions/`useBlocker`); the `<Routes>/<Route>` component form is no longer in use.
- **The `*` fallback** stays a `<Navigate to="/" replace />` element, which works unchanged under the data router.
