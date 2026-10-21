# UX Dev Panel: a reusable design-tuning pattern

A dev/staging-only floating panel that lets designers tune design "knobs" live on the real app, keeps their choices in their own browser, and exports them as text so engineers can bake the winners in.

## 1. What it is

- **Knobs:** typed design variables (layouts, placements, sizes, colours). Each is declared once in a **registry** with an id, label, kind, default and how it applies.
- **Defaults = shipped look.** Production renders registry defaults, stamped into the server HTML. Production users never see the panel.
- **Overrides stay local.** Choices live in `localStorage`; nothing reaches the server.
- **Copy settings:** one click copies `Label: value` lines to paste into a ticket.
- **Token overrides:** a second tab overrides a few theme colour tokens inline on `<html>`.
- **Previews:** optional inert gallery of real components rendered with fixtures, so a knob's effect is visible without navigating.

### User-facing behaviour
- **Open:** add `?ux_dev` (also accept `uxdev`, `ux-dev`, `uxDev`; any value except `false`/`0`) or press **Ctrl/Cmd+Shift+U** (toggles).
- **"On" is per tab** (sessionStorage). Removing the query param doesn't turn it off; the hotkey does.
- **Esc** collapses the window to its bubble.
- **Window modes:** draggable bubble (start state) → floating window → docked left/right (resizable, collapsible to a rail). Under ~1024px, floating becomes a bottom sheet and docked becomes full-screen.
- **Layering:** portal into `<body>` at a high z-index, with a drag-capture overlay just below it so drags work over iframes/video.
- **Controls:** toggle → switch, choice → radio pills, slider → range input.

### Typical workflow
1. Open staging with `?ux_dev=1`, dock the panel right.
2. Change knobs; watch the live app and Previews.
3. Reload — choices persist per browser profile.
4. **Copy settings** → paste into the ticket.
5. Engineer bakes winning values as new defaults/base CSS, then deletes the knob.

## 2. How it works

### Architecture

```
                 knobs.ts  (defineKnobs: id, label, kind, default, apply)
                       │
     ┌─────────────────┼────────────────────────────────┐
     │ SERVER          │                                │ CLIENT
     ▼                 │                                ▼
 stampDefaults()                               variant store   (localStorage)
  attrs ──► <html data-ux-*>                    enabled store   (sessionStorage)
  css   ──► <style id="ux-default-vars">:root{--ux-*}
  (root layout, every user, every env)               │ same-tab Event + "storage"
                                                     ▼
                       ┌─────────────────────────────┴──────────────────────┐
                       ▼                                                    ▼
          useApplyVariants(enabled)                                 useKnob(id)
          re-stamps <html> attrs / vars                             useSyncExternalStore:
          (overrides if on, defaults if off)                        server = default,
                       │                                            client = override only
                       ▼                                            if allowed && enabled
          CSS: html[data-ux-x="y"] …                                         │
               var(--ux-x, fallback)                                         ▼
                                                                    JS: branch rendering
```

- **Token overrides** are a parallel store writing inline `--token` values on `<html>` (beats theme CSS in light and dark).
- **The panel** hosts `useApplyVariants` and the token replay, so each runs exactly once.

### Knob shape
- `kind`: `toggle | choice | slider` (add `color`, see §6).
- `apply.via`:
  - `attr` → `data-ux-<id>="<value>"` on `<html>` (toggle with default `false` is omitted).
  - `cssvar` → `--ux-<name>: <value><suffix>` on `:root`.
  - `custom` → no DOM effect; read only via `useKnob`.
- Optional `group`, `help`, `unit`, `min/max/step`, `options`.

### SSR default stamping
- Spread `stampDefaults().attrs` onto `<html>`; inline `stampDefaults().css` in a `<style>` tag.
- Both are static, so pages stay statically prerendered.
- **Use a `<style>` tag, not the `<html style>` prop:** theme-init scripts and client appliers mutate `style` imperatively, and React would clobber them.
- `<html suppressHydrationWarning>` absorbs drift after the client re-stamps.
- Server stamping and client applier share the attr-name and value-format helpers; a parity test proves identical output.

### Gating
- `UX_DEV_ALLOWED = NODE_ENV !== "production" || APP_ENV === "staging"`.
- No auth, role or flag check — anyone on staging can open it (impact is their own browser only).
- **In production:** the panel doesn't render, and `useKnob` always returns the default, even with stale localStorage overrides.
- **Make the gate a literal expression** (no trimming/normalising helpers) so the bundler can fold it and drop the panel code via dynamic import.

### Storage
| Key | Store | Lifetime | Holds |
|---|---|---|---|
| `<app>-uxdev-enabled` | sessionStorage | tab | `"true"`/`"false"` |
| `<app>-uxdev-variants` | localStorage | profile | `{ [knobId]: value }` — explicit overrides only, so new knobs need no migration |
| `<app>-uxdev-tokens` | localStorage | profile | `{ [--token]: value }` |
| `<app>-uxdev-window` | localStorage | profile | mode, position, size, bubble position, dock width |
| (none) | memory | page | drag-active flag |

- No cookies, URL state or server persistence. Overrides are shared across tabs; only on/off is per tab.

### Propagation
- Each store writes storage, then dispatches a same-tab `<app>-uxdev-<name>-change` event on `window`, and listens to cross-tab `storage`.
- Reads go through `useSyncExternalStore`. **Cache the snapshot keyed on the raw JSON string** to avoid infinite re-renders.
- No React context, no state library.
- **CSS path:** `useApplyVariants(enabled)` stamps every knob; when turned off it re-asserts defaults, so the hotkey returns to the shipped look.
- **JS path:** `useKnob(id)` returns the override only when allowed and enabled; otherwise the registry default.
- **Event-time reads:** `readKnob(id)` / `readKnobNumber(id)` read the stamped DOM values (for handlers outside React render).

### Previews
- Lazy-imported, so they download only when the panel is open on the Variants tab.
- Wrapped in `inert` (look, don't touch).
- Real presentational components with mock props and locally provided contexts.

## 3. Module layout

```
ux-dev/
  types.ts                 # KnobDef, window/viewport/token types (no imports)
  config.ts                # prefix, gate, knobs, tokens, hotkey, url params
  gate.ts                  # readUxParam, UX_DEV_ALLOWED
  knobs.ts                 # host registry (the only file that grows)
  variants/
    default-html.ts        # stampDefaults() — server-safe
    apply-variants.ts      # applyAll, useApplyVariants
    read-knob.ts           # findKnob, readKnob, readKnobNumber, resolveKnob
    format-settings.ts     # Copy settings text
  state/
    enabled-state.ts       # per-tab on flag
    variant-values.ts      # override store
    token-overrides.ts     # token store + inline apply/remove
    window-state.ts        # geometry, defaults, clamping
    drag-active.ts
  hooks/
    use-ux-enabled.ts      # gate + URL param + hotkey
    use-knob.ts            # public JS read API
    use-token-overrides.ts
    use-ux-window.ts  use-ux-drag.ts  use-ux-resize.ts  use-viewport.ts
  components/
    panel.tsx              # mount root, portal, runs appliers, Esc
    window.tsx titlebar.tsx bubble.tsx rail.tsx snap-affordance.tsx drag-capture-overlay.tsx
    body.tsx               # tabs, controls, lazy previews, Copy settings
    knob-control.tsx  token-override-panel.tsx
  controls/  switch.tsx choice.tsx slider.tsx
  previews.tsx             # host-specific, lazy
  testing.ts               # setKnobsForTest, resetUxDevForTest
  ux-dev.css               # shell styles via --uxd-* theme contract
```

Peer deps: `react`/`react-dom` 18+ (`useSyncExternalStore`, `lazy`, `createPortal`). No state library.

## 4. Implementation guide

### 4.1 Config
```ts
export const uxDev = createUxDev({
  storagePrefix: "<app>-uxdev",        // storage keys + event names
  attrPrefix: "data-ux-",
  isAllowed: () => UX_DEV_ALLOWED,
  knobs,
  tokens: [{ token: "--accent", label: "Accent", kind: "color" }],
  hotkey: { key: "u", ctrlOrMeta: true, shift: true },
  urlParams: ["ux_dev", "uxdev", "ux-dev", "uxDev"],
});
```
A single editable `config.ts` is fine for a copy-paste kit. Inject the registry through config instead of importing it in every module.

### 4.2 Gate (literal, build-time foldable)
```ts
export const UX_DEV_ALLOWED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "staging";   // Vite: import.meta.env.VITE_APP_ENV
```

### 4.3 defineKnobs
Defaults **must equal the shipped look**. Keep the registry serializable (`suffix` instead of format functions).
```ts
export const knobs = defineKnobs([
  { id: "card-layout", label: "Card layout", group: "Cards", kind: "choice",
    options: [{ value: "grid", label: "Grid" }, { value: "list", label: "List" }],
    default: "grid", apply: { via: "attr" } },
  { id: "card-gap", label: "Gap", group: "Cards", kind: "slider",
    min: 0, max: 48, step: 2, default: 16, unit: "px",
    apply: { via: "cssvar", varName: "--ux-card-gap", suffix: "px" } },
  { id: "show-badges", label: "Badges", group: "Cards", kind: "toggle",
    default: true, apply: { via: "attr" } },
] as const);
// defineKnobs is identity + typing: useKnob("card-layout") -> "grid" | "list"
```

### 4.4 stampDefaults
```ts
export function stampDefaults() {
  return {
    attrs: Object.fromEntries(/* attr knobs → [`data-ux-${id}`, String(default)] */),
    css: `:root{${/* cssvar knobs → `${varName}:${default}${suffix};` */""}}`,
    prePaintScript: UX_DEV_ALLOWED ? buildPrePaintScript(knobs, prefix) : undefined,
  };
}
```

### 4.5 Mount — Next.js App Router
```tsx
// app/layout.tsx
const UxDevPanel = UX_DEV_ALLOWED
  ? dynamic(() => import("@/ux-dev/components/panel").then((m) => m.UxDevPanel))
  : null;
const Previews = lazy(() => import("@/ux-dev/previews"));

export default function RootLayout({ children }) {
  const ux = stampDefaults();
  return (
    <html lang="en" suppressHydrationWarning {...ux.attrs}>
      <head>
        {ux.prePaintScript && <script dangerouslySetInnerHTML={{ __html: ux.prePaintScript }} />}
        <style id="ux-default-vars" dangerouslySetInnerHTML={{ __html: ux.css }} />
      </head>
      <body>{children}{UxDevPanel && <UxDevPanel previews={Previews} />}</body>
    </html>
  );
}
```
- The panel must be a client component; verify your Next version's `dynamic`/Server Component rules.

### 4.6 Mount — Vite SPA / Remix / Astro
- **Vite SPA:** stamp defaults into `index.html` at build time (plugin or a small script), then
  `const Panel = UX_DEV_ALLOWED ? lazy(() => import("./ux-dev/components/panel")) : null;`
- **Remix/Astro:** stamp in the root document template exactly as in Next; mount the panel lazily behind the gate.

### 4.7 Consuming knobs
**CSS (preferred):**
```css
html[data-ux-card-layout="list"] .cards { display: flex; flex-direction: column; }
.cards { gap: var(--ux-card-gap, 16px); }       /* fallback == default */
```
- CSS Modules: put rules in the module that styles the element: `:global(html[data-ux-card-layout="list"]) .cards {…}` (unlayered module rules beat globals).

**JS (only when markup/behaviour changes):**
```tsx
const layout = useKnob("card-layout");
return layout === "list" ? <CardList /> : <CardGrid />;
```
- Event handlers: `readKnobNumber("card-gap")`.

### 4.8 Previews
```tsx
// ux-dev/previews.tsx
export default function Previews() {
  return (
    <section inert>
      <ThemeProvider><Card {...fixtures.card} /></ThemeProvider>
    </section>
  );
}
```
- Pure presentational components + fixtures; provide contexts locally; never import data/mutation/server-action code.

### 4.9 Tests
- **Parity:** `stampDefaults()` output equals client `applyAll({})`.
- **CSS fallbacks:** every `var(--ux-*, X)` in your CSS equals the registry default (grep-based is fine).
- **Stores:** snapshot stability, cross-tab `storage` events, unknown/legacy keys ignored.
- **Gate:** prod returns defaults even with overrides in storage.
- **Components:** use real stores via helpers, not module mocks:
  ```ts
  beforeEach(() => setKnobsForTest({ "card-layout": "list" }));
  afterEach(() => resetUxDevForTest());
  ```

### 4.10 Shell styling
- One `ux-dev.css` (or CSS module) themed via a contract with neutral fallbacks: `--uxd-surface: var(--surface, #fff)`, `--uxd-ink`, `--uxd-muted`, `--uxd-line`, `--uxd-accent`, `--uxd-radius`, `--uxd-shadow`, `--uxd-control-h`.
- Host maps its tokens onto `--uxd-*` in one rule. Keep native `<input type="range|checkbox|color">`.

## 5. Gotchas and best practices

1. **Flash of default.** Overrides applied in `useEffect` paint defaults for a frame on reload; JS knobs flip after hydration. Fix CSS knobs with a pre-paint script; JS flip is acceptable for a dev tool.
2. **Non-foldable gates ship the panel to prod.** Normalising helpers and static imports keep the shell in the prod bundle. Use a literal guard + dynamic import and verify with a build-output check.
3. **Divergent fallbacks.** Consumers that coerce unknown values to their own fallback silently render a non-shipped variant (mocks, typos). Always resolve to the registry default.
4. **Duplicate defaults in CSS.** `var(--ux-x, fallback)` repeats each default and can drift — test it.
5. **Module mocks leak.** Mocking the knob hook per file causes cross-file state leaks and isolation workarounds. Ship test helpers instead.
6. **Keep comments accurate.** Overrides are profile-wide localStorage; only on/off is per tab. Defaults are stamped for everyone.
7. **Render what you declare.** If knobs have `group`/`help`, show them; don't keep unused APIs.
8. **Bake and delete.** Winning variants go into base CSS/components; delete the knob. Lifecycle: **add → tune → copy → bake → delete → removal assertion**.
9. **Light previews.** Heavy product imports cost bundle size and test time.
10. **Accessibility.** `role="dialog"`, `aria-label`, `aria-modal="false"` (no focus trap); labelled controls; radiogroup for choices; `aria-live` copy status; focus moves only on explicit open; honour `prefers-reduced-motion`.
11. **Security.** Never apply in prod (build-time guarantee). Never add knobs that change security/permission behaviour. Never read knobs on the server. Use a **distinct storage prefix** per app — apps on the same `localhost` port share storage. Remember staging visitors can see unreleased variant labels.
12. **CSS over JS.** Prefer attr/cssvar knobs; JS branches multiply code paths.

## 6. Suggested improvements

| Improvement | Why |
|---|---|
| Pre-paint inline `<head>` script reading enabled + variants stores | Removes the flash of default for CSS knobs. |
| Literal build-time gate + dynamic import (optional defaults-only stub for consumers in prod) | Zero panel bytes in production. |
| `resolveKnob(id, value)` → registry default | One fallback rule; no silent non-shipped variants. |
| `setKnobsForTest` / `resetUxDevForTest` helpers (or injectable memory store) | Real store in tests, no mock leaks. |
| "Reset all" for variants | Back to shipped look without DevTools. |
| Group headers + slider help text | A long flat list is hard to scan. |
| `color` knob kind (`<input type="color">` → cssvar; Lab sliders as advanced) | Colours are a common knob; three sliders are clumsy. |
| A11y: tabs with `tablist`/`tabpanel`/`aria-controls` + arrow keys; global Esc; keyboard move/resize | Fully keyboard-operable. |
| Bake-and-delete lifecycle with removal assertions | Prevents dead branches accumulating. |
| Distinct `<app>-uxdev` prefix in config | No cross-app storage collisions. |
| Shareable settings via URL param (`?ux=<base64 json>`) and JSON import/export | Hand a designer's exact look to anyone in one link. |
| Per-route knob scoping (`routes: ["/cards/*"]`) | Show only knobs relevant to the current screen. |
| Named presets + A/B compare (toggle between two saved sets) | Faster side-by-side decisions. |
| Search/filter knobs (and "changed only") | Scales past a few dozen knobs. |
| CI check: CSS fallbacks equal registry defaults | Catches default drift before merge. |
| Codegen typed knob ids/values (or `defineKnobs` `as const`) | Typos fail at compile time. |
| Diff view of changed knobs (default → override) | Devtools-style clarity on what's tuned. |
| Copy settings as both text and a ready-to-paste code patch of new defaults | Shortens the bake step. |
| Optional cookie mirror for SSR-correct JS knobs (dynamic rendering, dev/staging only) | Removes the hydration flip for JS knobs. |
| Stale-knob warning (stored ids no longer in registry; knob age metadata) | Nudges cleanup and baking. |
| Visual badge when overrides are active | Prevents mistaking a tuned look for the shipped one in screenshots. |
