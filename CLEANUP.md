# L-Game — Code Quality Cleanup Tracker

Goal: make `index.html`, `style.css`, and `script.js` look world-class to a senior developer
reviewing this repo as a CV demonstration. No new features — only craft signals.

Progress key: ✅ done · 🔄 in progress · ⬜ not started

---

## Tier 1 — Instant signals (≤15 min each, highest ROI)

### ✅ T1-1 · `type="module"` on script tag
**Files:** `index.html` line 72, `script.js` lines 1393–1397
- Change `<script src="script.js">` → `<script type="module" src="script.js">`
- Remove the `document.addEventListener('DOMContentLoaded', ...)` wrapper in script.js;
  module scripts are deferred by default and wait for the DOM automatically
- Every `const`, `function`, and `class` in script.js already has no `window` assignment,
  so this one change eliminates all global scope pollution at zero refactoring cost
- **Senior dev signal:** A blocking non-module script on a 2025 ES6 project is an immediate red flag

### ✅ T1-2 · Meta description
**File:** `index.html` head section
- Add: `<meta name="description" content="L-Game — a two-player abstract strategy game by Edward de Bono. Play against a friend or an AI at three difficulty levels.">`
- **Senior dev signal:** Every public-facing page has this; its absence is noticed

### ✅ T1-3 · CSS custom properties for all design tokens
**File:** `style.css` — add `:root` block at top, then replace all raw values
Tokens to extract (currently hardcoded 15–20 times across the file):
```css
:root {
  --bg:           #1a1a2e;
  --surface:      #16213e;
  --surface-mid:  #2d2d44;
  --surface-deep: #0f3460;
  --p1:           #e94560;   /* used 8 times */
  --p2:           #0f8a5f;   /* used 4 times */
  --neutral:      #e9c46a;
  --text:         #e0e0e0;
  --text-muted:   #888;
  --cell:         90px;
  --cell-md:      65px;      /* inside @media 600px breakpoint */
  --cell-sm:      55px;      /* inside @media 480px breakpoint */
  --shadow-piece: inset 0 -3px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.15);
}
```
Also remove the redundant `width: 90px; height: 90px` on `.cell` — they duplicate what
`grid-template-columns` already defines.
- **Senior dev signal:** Raw hex repeated 8 times is the loudest "doesn't maintain CSS" signal

### ✅ T1-4 · `:focus-visible` keyboard styles
**File:** `style.css`
Add one rule block (after the button section):
```css
button:focus-visible {
  outline: 2px solid var(--p1);
  outline-offset: 2px;
}
```
- **Senior dev signal:** Invisible keyboard focus is a WCAG 2.1 AA failure; tested in first Tab-press

### ✅ T1-5 · `@media (prefers-reduced-motion)`
**Files:** `style.css` (bottom), `script.js` (top of `animateLPieceTransition`)
- CSS: add a `prefers-reduced-motion: reduce` block that sets `animation: none` and
  `transition: none` on `.cell`, `.piece`, `.piece-ghost`, `.piece-neutral`
- JS: at the top of `animateLPieceTransition`, check
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and call `callback()`
  directly, skipping the overlay flight sequence
- **Senior dev signal:** Missing reduced-motion support in a heavily-animated app is a common interview topic

### ✅ T1-6 · `aria-live` and `aria-hidden`
**Files:** `index.html`, `script.js` (in `renderUI`)
- HTML: add `aria-live="polite"` to `#p1-status`, `#p2-status`, and `#turn-text`
- HTML: add `aria-hidden="true"` as default state on `#game-result`
- JS: in `renderUI()`, toggle `gameResultEl.setAttribute('aria-hidden', isHidden)` alongside
  the existing `hidden` class toggle
- **Senior dev signal:** A turn-based game with no live region announcements is an obvious accessibility gap

---

## Tier 2 — Code quality upgrades (10–30 min each)

### ⬜ T2-1 · Phase / Difficulty constants
**File:** `script.js` — after the existing constants block at the top
Add:
```js
const Phase = Object.freeze({ L_MOVE: 'L_MOVE', NEUTRAL_MOVE: 'NEUTRAL_MOVE', GAME_OVER: 'GAME_OVER' });
const Difficulty = Object.freeze({ EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' });
```
Then replace bare string comparisons: `=== 'L_MOVE'` → `=== Phase.L_MOVE`, `=== 'easy'` → `=== Difficulty.EASY`, etc.
The strings `'P1'`/`'P2'` are used as object keys and board cell values throughout — leave those as-is.
- **Senior dev signal:** Magic strings at comparison sites signal "never refactored"

### ⬜ T2-2 · Fix shallow-clone latent bug (AI functions)
**File:** `script.js` — `computeAIMoveMedium` and `computeAIMoveHard`
Current pattern (lines ~416, 417, 501, 502, 570, 571):
```js
cells: [...game.playerData.P1.cells]      // ← only clones the outer array
```
Fixed:
```js
cells: game.playerData.P1.cells.map(pair => [...pair])   // ← clones inner [r,c] pairs too
```
The inner `[r, c]` pairs are currently shared references between the clone and the original.
The bug hasn't fired because the simulation reads but doesn't write to inner pairs — but it's a live landmine.
- **Senior dev signal:** A reviewer who traces the clone logic will spot this immediately

### ⬜ T2-3 · Cancel stale AI timeout on new game
**File:** `script.js` — `LGameUI` constructor + `handleNewGame`
- Constructor: add `this._aiTimeoutId = null`
- Where `setTimeout` is called for AI: store as `this._aiTimeoutId = setTimeout(...)`
- In `handleNewGame()`: add `clearTimeout(this._aiTimeoutId)` before resetting state
- **Senior dev signal:** A timeout that fires after game reset is a classic lifecycle bug; storing the ID costs 3 lines

### ⬜ T2-4 · Hoist `normalize()` out of `generateOrientations()`
**File:** `script.js` line 25
- Move `normalize` to module scope, above `generateOrientations()`
- Rename the shadowing `c` parameter inside normalize (`cells.map(c => c[0])`) to `pair`
  (`c` is used as the column variable throughout the rest of the file — the shadow is confusing)
- **Senior dev signal:** A function redefined inside a function that runs once = scope confusion

### ⬜ T2-5 · Named AI tie-break constant + JSDoc on AI functions
**File:** `script.js`
```js
/** Probability of accepting an equal-scored move to diversify AI play. */
const AI_TIE_BREAK_PROB = 0.2;
```
Replace the three `Math.random() < 0.2` literals (lines ~472, 557, 636) with `AI_TIE_BREAK_PROB`.
Add a one-line JSDoc to `computeAIMoveMedium` and `computeAIMoveHard` noting the scoring formula used.
- **Senior dev signal:** Magic probability in AI code with no comment = "happened to work"

### ⬜ T2-6 · Shared `.btn` base class in CSS
**File:** `style.css`
Extract shared declarations from the 5 button selectors (`#mode-btn`, `.first-option`,
`.diff-option`, `#skip-neutral-btn`, `#new-game-btn`) into a `.btn` base class:
`cursor: pointer`, `border-radius`, `font-weight: 600`, `transition`, `text-transform: uppercase`, `letter-spacing`.
Each specific selector then overrides only what differs (padding, font-size, color, border).
Also add `.btn` to each button element in `index.html`.
- **Senior dev signal:** `cursor: pointer` copy-pasted 5 times = no CSS system thinking

### ⬜ T2-7 · Consistent `is-` prefix for board-state classes
**Files:** `style.css` + `script.js`
Rename 4 classes to use consistent `is-` state prefix:
| Old | New |
|-----|-----|
| `.hovered-placement` | `.is-hover-preview` |
| `.selected-neutral` | `.is-selected-neutral` |
| `.valid-neutral-dest` | `.is-valid-dest` |
| `.clickable-neutral` | `.is-clickable-neutral` |
Update all class assignments in script.js to match.
- **Senior dev signal:** Four different naming conventions in one component = no convention

---

## Tier 3 — Architectural improvements (40–90 min each)

### ⬜ T3-1 · Extract AI helper functions
**File:** `script.js` — AI section
`computeAIMoveHard` is ~155 lines with cyclomatic complexity ~15.
Extract two helpers:
- `cloneGameState(game)` — the board/pData/neutrals deep-clone boilerplate (appears 5 times)
- `getEnumeratedNeutralOptions(board, neutrals)` — the neutral-options loop (appears 4 times)
This reduces `computeAIMoveHard` to ~90 readable lines where the minimax structure is visible.
- **Senior dev signal:** The first thing any reviewer does is run a complexity check on the longest function

### ⬜ T3-2 · Async/await animation sequence
**File:** `script.js` — `animateLPieceTransition`
Replace the 4-level nested `setTimeout` callback chain with:
```js
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async animateLPieceTransition(oldCells, newCells, player) {
  // ... setup ...
  await sleep(LIFT_MS);
  // ... fly phase ...
  await sleep(FLY_MS);
  // ... stamp phase ...
  await sleep(STAMP_MS);
  // ... settle phase ...
  await sleep(SETTLE_MS);
  // cleanup
}
```
Make `animateAndRender` async; replace the `callback` parameter with `await`.
- **Senior dev signal:** Nested setTimeout is the textbook "callback hell" example; async/await is the canonical fix

### ⬜ T3-3 · Colorblind-safe piece distinction
**File:** `style.css`
Red (#e94560) vs green (#0f8a5f) fails for deuteranopia (~5% of males).
Add a secondary visual distinction to P2 pieces — either:
- A `repeating-linear-gradient` diagonal stripe overlaid on `.piece-p2` (pure CSS)
- A `::before` pseudo-element symbol on `.piece-p2` cells
Note: the JS animation (`animateLPieceTransition`) sets `background` inline on overlay pieces,
so those will need updating too for full consistency.
- **Senior dev signal:** WCAG SC 1.4.1 — color cannot be the only visual means of conveying information

### ⬜ T3-4 · Event delegation for board interactions
**File:** `script.js` — `renderBoard` and constructor
Currently: 3 listeners per cell × 16 cells = 48 listeners re-registered on every `renderBoard()` call.
Replace with 3 single delegated handlers on `this.boardEl` in the constructor:
```js
this.boardEl.addEventListener('click', e => {
  const cell = e.target.closest('[data-row]');
  if (!cell) return;
  this.handleCellClick(+cell.dataset.row, +cell.dataset.col);
});
```
Move the `mouseleave` listener (currently inside `renderBoard`) to the constructor as a one-time registration.
- **Senior dev signal:** Listener-per-element in a loop is a performance pattern flag

---

## Not doing (would be overengineering for this project's scale)

- Test suite — requires a build pipeline; signal weaker than clean code
- Build system (Vite/esbuild) — adds noise without improving what a reviewer reads
- Full BEM refactor — T2-7 naming fix achieves 80% of the signal
- Private class fields (`#`) — cosmetic for a self-contained class with no subclassing
- TypeScript migration — signals "can migrate," not "writes clean JS"
- Web Workers for AI — hard AI on a 4×4 board completes in milliseconds

---

## Verification checklist (run after each change)

- [ ] Open game in browser, play a full round (vs-human and vs-AI, all three difficulties)
- [ ] Tab through controls — focus ring visible on all buttons
- [ ] DevTools Console — zero errors
- [ ] DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` — animations skip cleanly
- [ ] Start AI move, immediately click "New Game" — no stale callback fires after reset
