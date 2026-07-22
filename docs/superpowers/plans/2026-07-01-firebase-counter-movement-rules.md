# Firebase Counter + Movement Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live Firebase Firestore global games-played counter and implement the Nine Men's Morris movement phase so the counter increments when a game actually ends.

**Architecture:** Three sequential tasks — Firebase wiring first (self-contained and testable), then movement logic as pure functions in game.js, then UI and event wiring in main.js. Pure functions in game.js are testable via browser console without a DOM.

**Tech Stack:** Firebase JS SDK v10 (modular) via CDN ESM, vanilla JS ES modules, no build step.

## Global Constraints
- No build step — all JS must work as ESM loaded directly in the browser
- No npm dependencies added — Firebase loaded via `https://www.gstatic.com/firebasejs/10.12.2/` CDN URLs
- Verify the latest stable SDK version at firebase.google.com/docs/web/setup before using; substitute into all CDN URLs
- All files are already ESM modules (`type="module"` is set in index.html)

---

### Task 1: Firebase project setup + stats.js rewrite

**Prerequisite — manual steps (~5 minutes before writing any code):**
1. Go to console.firebase.google.com → New Project → name it `11-tehni` → disable Analytics → Create
2. Project overview → Add web app → Register app → skip the "Add Firebase SDK" step → Continue to console
3. Build → Firestore Database → Create database → **Start in test mode** → choose a region → Enable
4. Gear icon → Project Settings → Your apps → SDK setup and configuration → select **Config** → copy the `firebaseConfig` object

**Files:**
- Modify: `js/stats.js` (full rewrite)
- Modify: `js/main.js` (import change + one-line listener wiring)

**Interfaces:**
- Produces: `initStats(onCountUpdate: (n: number) => void): void` — opens onSnapshot listener, calls callback on every change
- Produces: `incrementGamesPlayed(): void` — fires atomic Firestore increment

- [ ] **Step 1: Rewrite js/stats.js**

Replace the entire file:

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, doc, onSnapshot, setDoc, increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Replace all six PASTE_YOUR_* values with your project's config from Firebase Console
const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY",
  authDomain:        "PASTE_YOUR_AUTH_DOMAIN",
  projectId:         "PASTE_YOUR_PROJECT_ID",
  storageBucket:     "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId:             "PASTE_YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const statsDoc = doc(db, 'stats', 'global');

export function initStats(onCountUpdate) {
  onSnapshot(statsDoc, (snap) => {
    onCountUpdate(snap.data()?.gamesPlayed ?? 0);
  });
}

export function incrementGamesPlayed() {
  setDoc(statsDoc, { gamesPlayed: increment(1) }, { merge: true });
}
```

- [ ] **Step 2: Paste your Firebase config into js/stats.js**

Open the file and replace all six `PASTE_YOUR_*` strings with the real values copied from Firebase Console.

- [ ] **Step 3: Update js/main.js imports and listener wiring**

Replace:
```js
import { getGamesPlayed } from "./stats.js";
```
With:
```js
import { initStats, incrementGamesPlayed } from "./stats.js";
```

At the bottom of the file, replace:
```js
gamesCountEl.textContent = String(getGamesPlayed());
render();
```
With:
```js
initStats((count) => { gamesCountEl.textContent = String(count); });
render();
```

Also delete the comment line:
```js
// incrementGamesPlayed() will be wired when movement / win rules are added
```

- [ ] **Step 4: Test — verify live counter across tabs**

1. Run `npx serve .` and open `http://localhost:3000` in two browser tabs
2. DevTools Console in both tabs should show no errors
3. "Games played: 0" (or real count) should appear in both tabs
4. In tab 1's console run:
   ```js
   import('/js/stats.js').then(m => m.incrementGamesPlayed());
   ```
5. Both tabs should update the counter simultaneously without refreshing

- [ ] **Step 5: Commit**
```bash
git add js/stats.js js/main.js
git commit -m "feat: replace localStorage counter with Firebase Firestore live counter"
```

---

### Task 2: Movement phase logic in game.js

All new functions are pure (no DOM, no side effects beyond mutating state) and can be verified in the browser console.

**Files:**
- Modify: `js/game.js`

**Interfaces:**
- Consumes: `edges: [string, string][]` from `buildBoardGraph()` (already returned in main.js)
- Produces:
  - `MILL_LINES: string[][]` — 16 triples of node IDs that form winning lines
  - `buildAdjacency(edges): Map<string, Set<string>>`
  - `getValidMoves(state, adjacency, nodeId: string): string[]`
  - `movePiece(state, adjacency, fromId: string, toId: string): { moved: boolean, millFormed: boolean }`
  - `canRemove(state, nodeId: string, currentPlayer: number): boolean`
  - `removePiece(state, nodeId: string): boolean`
  - `checkWin(state, adjacency): 1 | 2 | null`

- [ ] **Step 1: Add MILL_LINES and buildAdjacency at the top of game.js**

Add after the existing `export const Player = ...` block:

```js
export const MILL_LINES = [
  // Outer rectangle sides
  ['r0-tl','r0-tm','r0-tr'], ['r0-tr','r0-rm','r0-br'],
  ['r0-br','r0-bm','r0-bl'], ['r0-bl','r0-lm','r0-tl'],
  // Middle rectangle sides
  ['r1-tl','r1-tm','r1-tr'], ['r1-tr','r1-rm','r1-br'],
  ['r1-br','r1-bm','r1-bl'], ['r1-bl','r1-lm','r1-tl'],
  // Inner rectangle sides
  ['r2-tl','r2-tm','r2-tr'], ['r2-tr','r2-rm','r2-br'],
  ['r2-br','r2-bm','r2-bl'], ['r2-bl','r2-lm','r2-tl'],
  // Spokes (cross-rectangle collinear nodes)
  ['r0-tm','r1-tm','r2-tm'], ['r0-rm','r1-rm','r2-rm'],
  ['r0-bm','r1-bm','r2-bm'], ['r0-lm','r1-lm','r2-lm'],
];

export function buildAdjacency(edges) {
  const adj = new Map();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  return adj;
}
```

- [ ] **Step 2: Verify MILL_LINES in browser console**

Open `http://localhost:3000`, DevTools Console:
```js
const { MILL_LINES } = await import('/js/game.js');
console.log(MILL_LINES.length);                    // 16
console.log(MILL_LINES.every(l => l.length === 3)); // true
```
Expected: `16`, `true`

- [ ] **Step 3: Fix currentPlayer handoff when placement ends**

In `placePiece`, replace:
```js
if (state.placedCount >= TOTAL_PIECES) {
  state.phase = Phase.MOVEMENT;
}
```
With:
```js
if (state.placedCount >= TOTAL_PIECES) {
  state.phase = Phase.MOVEMENT;
  state.currentPlayer = state.currentPlayer === Player.ONE ? Player.TWO : Player.ONE;
}
```
Without this, currentPlayer stays on whichever player placed last instead of handing off to the other player for the first movement turn.

- [ ] **Step 4: Add getValidMoves and movePiece to game.js**

Add before the `statusMessage` function:

```js
export function getValidMoves(state, adjacency, nodeId) {
  const neighbors = adjacency.get(nodeId) ?? new Set();
  return [...neighbors].filter(id => !state.board.has(id));
}

function checkMill(state, nodeId, player) {
  return MILL_LINES.some(
    line => line.includes(nodeId) && line.every(id => state.board.get(id) === player)
  );
}

export function movePiece(state, adjacency, fromId, toId) {
  if (state.board.get(fromId) !== state.currentPlayer) return { moved: false, millFormed: false };
  if (!getValidMoves(state, adjacency, fromId).includes(toId)) return { moved: false, millFormed: false };
  state.board.delete(fromId);
  state.board.set(toId, state.currentPlayer);
  return { moved: true, millFormed: checkMill(state, toId, state.currentPlayer) };
}
```

- [ ] **Step 5: Test getValidMoves and movePiece in browser console**

```js
const { createGameState, placePiece, buildAdjacency, getValidMoves, movePiece } = await import('/js/game.js');
const { buildBoardGraph } = await import('/js/board.js');
const { edges, nodes } = buildBoardGraph();
const adj = buildAdjacency(edges);
const s = createGameState(true);
// Fill 22 of 24 nodes; r2-bl and r2-lm remain empty
const ids = nodes.map(n => n.id).slice(0, 22);
for (const id of ids) placePiece(s, id);
console.log(s.phase);                          // "movement"
const moves = getValidMoves(s, adj, 'r2-br');  // r2-br is adjacent to r2-bl (empty)
console.log(moves.includes('r2-bl'));          // true
const result = movePiece(s, adj, 'r2-br', 'r2-bl');
console.log(result.moved);                    // true
console.log(s.board.has('r2-br'));            // false
```
Expected: `"movement"`, `true`, `true`, `false`

- [ ] **Step 6: Add canRemove, removePiece, and checkWin to game.js**

Add after `movePiece`:

```js
export function canRemove(state, nodeId, currentPlayer) {
  const owner = state.board.get(nodeId);
  if (!owner || owner === currentPlayer) return false;
  const opponent = currentPlayer === Player.ONE ? Player.TWO : Player.ONE;
  const inMill = MILL_LINES.some(
    line => line.includes(nodeId) && line.every(id => state.board.get(id) === opponent)
  );
  if (!inMill) return true;
  // Can remove from a mill only if every opponent piece is in a mill
  const opponentPieces = [...state.board.entries()].filter(([, v]) => v === opponent).map(([k]) => k);
  return opponentPieces.every(id =>
    MILL_LINES.some(line => line.includes(id) && line.every(nid => state.board.get(nid) === opponent))
  );
}

export function removePiece(state, nodeId) {
  if (!state.board.has(nodeId)) return false;
  state.board.delete(nodeId);
  return true;
}

function countPieces(state, player) {
  let n = 0;
  for (const v of state.board.values()) if (v === player) n++;
  return n;
}

function hasValidMoves(state, adjacency, player) {
  for (const [nodeId, owner] of state.board) {
    if (owner === player && getValidMoves(state, adjacency, nodeId).length > 0) return true;
  }
  return false;
}

export function checkWin(state, adjacency) {
  if (state.phase !== Phase.MOVEMENT) return null;
  for (const player of [Player.ONE, Player.TWO]) {
    if (countPieces(state, player) <= 2) return player === Player.ONE ? Player.TWO : Player.ONE;
    if (!hasValidMoves(state, adjacency, player)) return player === Player.ONE ? Player.TWO : Player.ONE;
  }
  return null;
}
```

- [ ] **Step 7: Test checkWin in browser console**

```js
const { createGameState, placePiece, buildAdjacency, checkWin } = await import('/js/game.js');
const { buildBoardGraph } = await import('/js/board.js');
const { edges, nodes } = buildBoardGraph();
const adj = buildAdjacency(edges);
const s = createGameState(true);
const ids = nodes.map(n => n.id).slice(0, 22);
for (const id of ids) placePiece(s, id);
// Manually drop player 2 to 2 pieces
[...s.board.entries()].filter(([,v]) => v === 2).slice(2).forEach(([k]) => s.board.delete(k));
console.log(checkWin(s, adj)); // 1 — Player ONE wins
```
Expected: `1`

- [ ] **Step 8: Update statusMessage and phaseMessage in game.js**

Replace:
```js
if (state.phase === Phase.MOVEMENT) {
  return `Movement phase — Player ${state.currentPlayer}'s turn (rules coming soon)`;
}
```
With:
```js
if (state.phase === Phase.MOVEMENT) {
  return `Player ${state.currentPlayer}'s turn`;
}
```

Replace:
```js
if (state.phase === Phase.MOVEMENT) {
  return "Movement phase";
}
```
With:
```js
if (state.phase === Phase.MOVEMENT) {
  const p1 = [...state.board.values()].filter(v => v === Player.ONE).length;
  const p2 = [...state.board.values()].filter(v => v === Player.TWO).length;
  return `P1: ${p1} pieces  |  P2: ${p2} pieces`;
}
```

- [ ] **Step 9: Commit**
```bash
git add js/game.js
git commit -m "feat: add movement logic — mill lines, adjacency, move/remove/win functions"
```

---

### Task 3: Movement UI + win wiring in main.js

**Files:**
- Modify: `js/main.js`
- Modify: `css/style.css` (3 new classes)
- Modify: `index.html` (add reset button)

**Interfaces:**
- Consumes from Task 1: `incrementGamesPlayed` (already imported)
- Consumes from Task 2: `buildAdjacency`, `getValidMoves`, `movePiece`, `canRemove`, `removePiece`, `checkWin`
- Consumes from existing game.js: `finishGame` (already exists, needs adding to import list)

- [ ] **Step 1: Add CSS classes to css/style.css**

Add at the end of the file:
```css
.board-node.selected  { fill: #f59e0b; stroke: #d97706; stroke-width: 3px; }
.board-node.movable   { fill: #6ee7b7; cursor: pointer; }
.board-node.removable { fill: #f87171; cursor: pointer; }
```

- [ ] **Step 2: Update js/main.js imports**

Replace the existing `import { ... } from "./game.js"` with:
```js
import {
  createGameState, canPlaceAt, placePiece, statusMessage, phaseMessage,
  setMode, resetGame, finishGame, Phase,
  buildAdjacency, getValidMoves, movePiece, canRemove, removePiece, checkWin,
} from "./game.js";
```

After `const { nodes, edges } = buildBoardGraph();`, add:
```js
const adjacency = buildAdjacency(edges);
```

- [ ] **Step 3: Add movement state variables to js/main.js**

After `let state = createGameState(true);`, add:
```js
let selectedNodeId = null;
let awaitingRemoval = false;
```

- [ ] **Step 4: Replace renderNodes in js/main.js**

Replace the entire `renderNodes` function:
```js
function renderNodes() {
  boardNodes.replaceChildren(
    ...nodes.map((node) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", node.x);
      circle.setAttribute("cy", node.y);
      circle.setAttribute("r", 11);
      circle.dataset.nodeId = node.id;
      circle.classList.add("board-node");
      circle.setAttribute("tabindex", "0");
      circle.setAttribute("role", "button");
      circle.setAttribute("aria-label", `Intersection ${node.id}`);

      const owner = state.board.get(node.id);

      if (state.phase === Phase.PLACEMENT) {
        if (owner) {
          circle.classList.add("occupied");
        } else if (canPlaceAt(state, node.id)) {
          circle.classList.add("valid");
        }
      } else if (state.phase === Phase.MOVEMENT) {
        if (owner) circle.classList.add("occupied");

        if (awaitingRemoval) {
          if (canRemove(state, node.id, state.currentPlayer)) circle.classList.add("removable");
        } else if (selectedNodeId === null) {
          if (owner === state.currentPlayer && getValidMoves(state, adjacency, node.id).length > 0) {
            circle.classList.add("movable");
          }
        } else {
          if (node.id === selectedNodeId) {
            circle.classList.add("selected");
          } else if (!owner && getValidMoves(state, adjacency, selectedNodeId).includes(node.id)) {
            circle.classList.add("valid");
          }
        }
      }

      circle.addEventListener("click", () => onNodeClick(node.id));
      circle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNodeClick(node.id); }
      });
      return circle;
    })
  );
}
```

- [ ] **Step 5: Replace updateStatus in js/main.js**

Replace the existing `updateStatus` function:
```js
function updateStatus() {
  if (state.phase === Phase.MOVEMENT) {
    if (awaitingRemoval) {
      statusText.textContent = `Player ${state.currentPlayer}: remove one opponent piece`;
    } else if (selectedNodeId) {
      statusText.textContent = `Player ${state.currentPlayer}: select a destination`;
    } else {
      statusText.textContent = statusMessage(state);
    }
  } else {
    statusText.textContent = statusMessage(state);
  }
  phaseText.textContent = phaseMessage(state);
}
```

- [ ] **Step 6: Add movement helper functions to js/main.js**

Add these functions before the existing `onNodeClick` function:
```js
function opponentOf(player) { return player === 1 ? 2 : 1; }

function endTurn() {
  state.currentPlayer = opponentOf(state.currentPlayer);
  const winner = checkWin(state, adjacency);
  if (winner !== null) {
    finishGame(state, winner);
    incrementGamesPlayed();
  }
  render();
}

function handleRemovalClick(nodeId) {
  if (!canRemove(state, nodeId, state.currentPlayer)) return;
  removePiece(state, nodeId);
  awaitingRemoval = false;
  const winner = checkWin(state, adjacency);
  if (winner !== null) {
    finishGame(state, winner);
    incrementGamesPlayed();
    render();
    return;
  }
  endTurn();
}

function handleMovementClick(nodeId) {
  if (awaitingRemoval) { handleRemovalClick(nodeId); return; }

  const owner = state.board.get(nodeId);

  if (selectedNodeId === null) {
    if (owner !== state.currentPlayer) return;
    if (getValidMoves(state, adjacency, nodeId).length === 0) return;
    selectedNodeId = nodeId;
    render();
    return;
  }

  if (nodeId === selectedNodeId) {
    selectedNodeId = null;
    render();
    return;
  }

  const { moved, millFormed } = movePiece(state, adjacency, selectedNodeId, nodeId);
  selectedNodeId = null;

  if (!moved) {
    if (owner === state.currentPlayer && getValidMoves(state, adjacency, nodeId).length > 0) {
      selectedNodeId = nodeId;
    }
    render();
    return;
  }

  if (millFormed) {
    awaitingRemoval = true;
    render();
    return;
  }

  endTurn();
}
```

- [ ] **Step 7: Replace onNodeClick in js/main.js**

Replace the existing `onNodeClick` function:
```js
function onNodeClick(nodeId) {
  if (state.phase === Phase.FINISHED) return;

  if (state.phase === Phase.PLACEMENT) {
    if (!canPlaceAt(state, nodeId)) return;
    const placed = placePiece(state, nodeId);
    if (!placed) return;
    if (!state.twoPlayer && state.phase === Phase.PLACEMENT) maybeCpuPlace();
    render();
    return;
  }

  if (state.phase === Phase.MOVEMENT) handleMovementClick(nodeId);
}
```

- [ ] **Step 8: Reset movement state on mode toggle and add reset button**

In `onModeToggle`, after `resetGame(state);`, add:
```js
selectedNodeId = null;
awaitingRemoval = false;
```

Add a reset button to `index.html` inside `<aside class="controls">`, after the mode-toggle button:
```html
<button type="button" id="reset-btn" class="mode-toggle">New Game</button>
```

In `js/main.js`, after the `modeToggle.addEventListener` line, add:
```js
const resetBtn = document.getElementById("reset-btn");
resetBtn.addEventListener("click", () => {
  resetGame(state);
  selectedNodeId = null;
  awaitingRemoval = false;
  render();
});
```

- [ ] **Step 9: Manual UI test — full game walkthrough**

1. Open `http://localhost:3000`
2. Place all 22 pieces (11 per player, alternating clicks) — board enters movement phase, status shows "Player 1's turn", phase shows piece counts
3. Green-highlighted nodes are movable pieces for the current player
4. Click a green piece — it turns yellow (selected); valid destinations turn blue/green
5. Click a destination — piece moves; turn passes (or removal mode activates if a mill formed)
6. If mill formed: status reads "Player 1: remove one opponent piece"; opponent pieces turn red
7. Click a red piece — it's removed; turn passes
8. Continue until one player has ≤ 2 pieces — win message shows, "Games played" counter increments on all open tabs
9. Click "New Game" — board resets cleanly

- [ ] **Step 10: Commit**
```bash
git add js/main.js css/style.css index.html
git commit -m "feat: implement movement UI, mill removal, win detection, and Firebase counter wiring"
```
