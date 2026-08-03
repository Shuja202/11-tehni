# Design: Firebase Global Counter + Movement Rules

**Date:** 2026-06-29  
**Project:** 11 Tehni — static Pakistani board game (GitHub Pages)

---

## Overview

Two intertwined features: the global games-played counter requires Firebase, and Firebase can only usefully increment once the game can actually end — which requires the movement phase rules.

---

## Section 1: Firebase Global Counter

### Goal
Replace the per-device `localStorage` counter in `js/stats.js` with a single globally shared Firestore counter that updates live on all open tabs.

### Data structure
One Firestore document:
```
stats/global → { gamesPlayed: number }
```

### SDK
Firebase JS SDK v9 (modular) loaded via CDN ESM — no build step required. Compatible with the existing `<script type="module">` setup in `index.html`.

### `stats.js` behaviour
- On page load: open an `onSnapshot()` listener on `stats/global`. Each time the document changes (any player anywhere finishes a game), the listener pushes the new `gamesPlayed` value to `#games-count` in the DOM.
- On game end: call `updateDoc` with `increment(1)` — Firestore's atomic server-side increment, safe against concurrent updates.
- If the document does not yet exist (first ever game): use `setDoc` with `{ gamesPlayed: 1 }` as a fallback, or use `setDoc` with merge so it creates-or-updates safely.

### Security rules
- Read: open to all
- Write: open to all

No authentication required. The counter is a fun stat, not sensitive data. Firebase public config keys are designed to be in client-side code.

### Firebase config
Stored directly in `stats.js`. The user must create a Firebase project, enable Firestore, and paste their config object into `stats.js`.

---

## Section 2: Movement Phase Rules

### Goal
Implement the Nine Men's Morris movement ruleset in `game.js` after the placement phase completes.

### Adjacency map
`board.js` already builds the graph with a full edge list. `game.js` will derive a `Map<nodeId, Set<nodeId>>` adjacency map from those edges at game start.

### Turn flow (movement phase)
1. Active player clicks one of their own pieces that has ≥ 1 empty adjacent node (selected piece is highlighted).
2. Active player clicks one of the highlighted valid destination nodes.
3. The piece moves: old node becomes vacant, new node becomes occupied.
4. Mill check runs (see below).
5. If no mill: turn passes to opponent.
6. If mill formed: enter removal mode (see below).

### Mill detection
After each move, check all predefined mill lines for the board. A mill line is a `[nodeA, nodeB, nodeC]` triple where all three nodes are occupied by the same player.

Mill lines are derived from the board geometry — the sides of each of the 3 rectangles and the 4 spoke segments — and stored as a static array in `game.js`. The exact triples are determined during implementation by reading the node IDs from `board.js`.

A move counts as forming a new mill only if it completes a line that was previously broken. If a player slides a piece out of a mill and back into the same mill on a later turn, that return move **does** count as a new mill. Only sliding a piece to a different position within an already-complete, unbroken line of 3 does not trigger removal (this situation cannot actually arise in legal play, since all 3 nodes are occupied — so in practice every completed line after a move is a new mill).

### Removal mode (mill formed)
- Active player must click one opponent piece to remove it from the board.
- A piece that is part of an opponent's own active mill is protected (cannot be removed) unless all remaining opponent pieces are in mills.
- After removal, the turn passes to the opponent.

---

## Section 3: Win Condition & Counter Wiring

### Win triggers
Checked at the start of a player's turn (after any removal from the previous turn):
1. **Piece count:** active player has ≤ 2 pieces — cannot form any mill, game over, opponent wins.
2. **No legal moves:** all of the active player's pieces are completely surrounded by occupied nodes — game over, opponent wins.

### On win
1. `finishGame(state, winner)` is called (already implemented in `game.js`).
2. `incrementGamesPlayed()` is called — fires `updateDoc(increment(1))` to Firestore.
3. The `onSnapshot` listener propagates the new count to all open tabs automatically.
4. The board is locked (no further clicks processed).
5. Win message is shown via the existing `statusMessage()` function.

### UI additions in `main.js`
- **Selection state:** track `selectedNodeId` — the piece the active player has clicked to move.
- **Highlight valid moves:** when a piece is selected, mark its valid destination nodes visually (new CSS class).
- **Removal mode flag:** a boolean `awaitingRemoval` — when true, opponent pieces become clickable targets; clicking one removes it and clears the flag.
- **Deselect:** clicking the already-selected piece deselects it.

---

## Out of scope
- Player names or per-player stats (just a global total)
- Authentication
- Leaderboard
- "Flying" rule (in standard Morris, when a player has exactly 3 pieces they can move to any empty node — not included here)
