# Roadmap

This file tracks planned milestones for the L-Game project.  
Completed work is recorded in [CHANGELOG.md](CHANGELOG.md).

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Released |
| 🔨 | In progress |
| 🗓 | Planned |

---

## ✅ v1.0.0 — Initial release
Fully playable single-page implementation with three AI difficulty levels and local two-player mode.

## ✅ v2.0.0 — Polished animations
Smooth L-piece ghost-fade transitions; the board feels alive.

---

## 🗓 v2.x — Logic hardening

The goal is a game engine that is provably correct and difficult to beat.

- [ ] Exhaustive unit tests covering all 8 L-piece orientations, every legal and illegal placement, and all neutral-piece edge cases.
- [ ] Alpha-beta pruning added to the Hard-mode minimax to allow deeper search within the same time budget.
- [ ] Increase Hard-mode search depth; validate against known L-Game endgame positions.
- [ ] Benchmark and profile the move-generation loop; eliminate redundant board copies.

---

## 🗓 v3.0 — UI overhaul

Bring the same quality of care as the v2.0 animation to the entire visual design.

- [ ] Redesigned board and piece aesthetics — richer colours, subtle shadows, and polished typography.
- [ ] Animated neutral-piece movement to match the L-piece transitions.
- [ ] Fully responsive layout that works well on tablet and mobile.
- [ ] Optional sound design: subtle clicks and move sounds.
- [ ] Accessibility pass: keyboard navigation and sufficient colour contrast.

---

## 🗓 v4.0 — LAN multiplayer

Two players on the same WiFi network play against each other in their own browsers — no server, no account, no internet required.

- [ ] Research and choose a peer-to-peer transport (WebRTC data channels are the leading candidate).
- [ ] Room/lobby system: one player hosts and shares a short room code; the other joins by entering it.
- [ ] Real-time board state synchronisation; moves made in one browser are reflected instantly in the other.
- [ ] Handle disconnections gracefully (rejoin, or declare winner on timeout).
- [ ] Optional: extend to internet play via a lightweight relay/signalling server if LAN-only proves too limiting.
