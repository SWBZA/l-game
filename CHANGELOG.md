# Changelog

All notable changes to this project are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

See [ROADMAP.md](ROADMAP.md) for what is coming next.

---

## [2.1.0] - 2026-04-28

### Changed
- Script tag changed to `type="module"` — eliminates all global scope pollution; requires an HTTP server (e.g. `python3 -m http.server`).
- CSS design tokens extracted into `:root` custom properties — all colours, cell sizes, and the piece shadow are now single-source variables.
- Redundant `width`/`height` on `.cell` removed; grid tracks are the sole size authority.
- `button:focus-visible` outline added — keyboard navigation now has a visible focus ring (WCAG 2.1 AA).
- `@media (prefers-reduced-motion: reduce)` block added to CSS; `animateLPieceTransition` skips the overlay flight sequence for users who request reduced motion.
- `aria-live="polite"` on player status elements and turn indicator; `aria-hidden` toggled on the game-result banner.

---

## [2.0.0] - 2026-04-28

### Added
- L-piece transition animation: ghost pieces fade out from the old position (0.7 s) while the new piece animates in (0.55 s), giving the board a polished, premium feel.

---

## [1.0.0] - 2026-04-27

### Added
- Playable implementation of Edward de Bono's L-Game, running entirely in the browser with no build step.
- 4×4 board with the official interlocking starting position.
- All 8 L-piece orientations generated from a single base shape via rotation and reflection.
- Hover-preview system: mousing over a cell shows every legal placement covering that cell; repeated hover cycles through orientations without flickering.
- Three AI difficulty levels:
  - **Easy** — random legal move.
  - **Medium** — one-ply heuristic minimising the opponent's future mobility.
  - **Hard** — two-ply minimax maximising the AI's minimum future mobility (~7 000 scenarios evaluated per move on the opening position).
- Two-player local mode (hot-seat on a single browser tab).
- First-move selection: choose whether Player 1 or the AI opens.
- Dark theme UI with a red (P1) / green (P2) colour scheme.
