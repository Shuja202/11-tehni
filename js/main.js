import { buildBoardGraph, edgesToSegments, BOARD } from "./board.js";
import {
  createGameState,
  canPlaceAt,
  placePiece,
  statusMessage,
  phaseMessage,
  remainingPieces,
  setMode,
  resetGame,
  finishGame,
  Phase,
  buildAdjacency,
  getValidMoves,
  movePiece,
  canRemove,
  removePiece,
  checkWin,
} from "./game.js";
import { initStats, incrementGamesPlayed, runFirebaseConnectionTest } from "./stats.js";

const { nodes, edges } = buildBoardGraph();
const segments = edgesToSegments(edges, nodes);
const adjacency = buildAdjacency(edges);

const boardLines = document.getElementById("board-lines");
const boardNodes = document.getElementById("board-nodes");
const boardPieces = document.getElementById("board-pieces");
const statusText = document.getElementById("status-text");
const phaseText = document.getElementById("phase-text");
const piecesLeftEl = document.getElementById("pieces-left");
const p1LeftEl = document.getElementById("p1-left");
const p2LeftEl = document.getElementById("p2-left");
const modeToggle = document.getElementById("mode-toggle");
const modeLabel = modeToggle.querySelector(".mode-label");
const gamesCountEl = document.getElementById("games-count");
const resetBtn = document.getElementById("reset-btn");

let state = createGameState(true);
let selectedNodeId = null;

function renderLines() {
  boardLines.replaceChildren(
    ...segments.map((seg) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", seg.x1);
      line.setAttribute("y1", seg.y1);
      line.setAttribute("x2", seg.x2);
      line.setAttribute("y2", seg.y2);
      line.classList.add("board-line");
      return line;
    })
  );
}

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

      if (state.awaitingRemoval) {
        if (owner) circle.classList.add("occupied");
        if (canRemove(state, node.id, state.currentPlayer)) {
          circle.classList.add("removable");
        }
      } else if (state.phase === Phase.PLACEMENT) {
        if (owner) {
          circle.classList.add("occupied");
        } else if (canPlaceAt(state, node.id)) {
          circle.classList.add("valid");
        }
      } else if (state.phase === Phase.MOVEMENT) {
        if (owner) circle.classList.add("occupied");

        if (selectedNodeId === null) {
          if (owner === state.currentPlayer && getValidMoves(state, adjacency, node.id).length > 0) {
            circle.classList.add("movable");
          }
        } else if (node.id === selectedNodeId) {
          circle.classList.add("selected");
        } else if (!owner && getValidMoves(state, adjacency, selectedNodeId).includes(node.id)) {
          circle.classList.add("valid");
        }
      }

      circle.addEventListener("click", () => onNodeClick(node.id));
      circle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNodeClick(node.id);
        }
      });

      return circle;
    })
  );
}

function renderPieces() {
  boardPieces.replaceChildren(
    ...nodes
      .filter((n) => state.board.has(n.id))
      .map((node) => {
        const player = state.board.get(node.id);
        const piece = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        piece.setAttribute("cx", node.x);
        piece.setAttribute("cy", node.y);
        piece.setAttribute("r", 14);
        piece.classList.add("piece", player === 1 ? "player1" : "player2");
        return piece;
      })
  );
}

function updateStatus() {
  statusText.textContent = statusMessage(state);
  phaseText.textContent = phaseMessage(state);

  piecesLeftEl.hidden = state.phase !== Phase.PLACEMENT;
  p1LeftEl.textContent = `Player 1: ${remainingPieces(state, 1)} left`;
  p2LeftEl.textContent = `Player 2: ${remainingPieces(state, 2)} left`;
  p1LeftEl.classList.toggle(
    "active",
    state.phase === Phase.PLACEMENT && state.currentPlayer === 1
  );
  p2LeftEl.classList.toggle(
    "active",
    state.phase === Phase.PLACEMENT && state.currentPlayer === 2
  );
}

function render() {
  renderLines();
  renderNodes();
  renderPieces();
  updateStatus();
}

function evaluateWin() {
  const winner = checkWin(state, adjacency);
  if (winner !== null) {
    finishGame(state, winner);
    incrementGamesPlayed();
  }
}

function handleRemovalClick(nodeId) {
  const removed = removePiece(state, nodeId);
  if (!removed) return;

  if (state.phase === Phase.MOVEMENT) evaluateWin();
  render();

  if (state.phase === Phase.PLACEMENT && !state.twoPlayer && state.currentPlayer === 2) {
    maybeCpuPlace();
    render();
  }
}

function handleMovementClick(nodeId) {
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

  if (!moved) {
    selectedNodeId =
      owner === state.currentPlayer && getValidMoves(state, adjacency, nodeId).length > 0
        ? nodeId
        : null;
    render();
    return;
  }

  selectedNodeId = null;

  if (!millFormed) evaluateWin();
  render();
}

function onNodeClick(nodeId) {
  if (state.phase === Phase.FINISHED) return;

  if (state.awaitingRemoval) {
    handleRemovalClick(nodeId);
    return;
  }

  if (state.phase === Phase.PLACEMENT) {
    if (!canPlaceAt(state, nodeId)) return;

    const placed = placePiece(state, nodeId);
    if (!placed) return;

    if (!state.awaitingRemoval && !state.twoPlayer && state.phase === Phase.PLACEMENT) {
      maybeCpuPlace();
    }

    render();
    return;
  }

  if (state.phase === Phase.MOVEMENT) handleMovementClick(nodeId);
}

function autoCpuRemoval() {
  const removable = nodes.filter((n) => canRemove(state, n.id, state.currentPlayer));
  if (removable.length === 0) return;
  const pick = removable[Math.floor(Math.random() * removable.length)];
  removePiece(state, pick.id);
}

function maybeCpuPlace() {
  if (state.twoPlayer || state.phase !== Phase.PLACEMENT) return;
  if (state.currentPlayer !== 2) return;

  if (state.awaitingRemoval) {
    autoCpuRemoval();
  } else {
    const empty = nodes.filter((n) => canPlaceAt(state, n.id));
    if (empty.length === 0) return;
    const pick = empty[Math.floor(Math.random() * empty.length)];
    placePiece(state, pick.id);
  }

  if (state.phase === Phase.PLACEMENT && state.currentPlayer === 2) {
    maybeCpuPlace();
  }
}

function onModeToggle() {
  const twoPlayer = modeToggle.getAttribute("aria-pressed") === "true";
  const nextTwoPlayer = !twoPlayer;

  modeToggle.setAttribute("aria-pressed", String(!nextTwoPlayer));
  modeLabel.textContent = nextTwoPlayer ? "2 Players" : "1 Player vs CPU";

  resetGame(state);
  selectedNodeId = null;
  setMode(state, nextTwoPlayer);
  render();
}

modeToggle.addEventListener("click", onModeToggle);

resetBtn.addEventListener("click", () => {
  resetGame(state);
  selectedNodeId = null;
  render();
});

initStats((count) => { gamesCountEl.textContent = String(count); });

runFirebaseConnectionTest()
  .then(() => {
    console.info("Firebase connection test passed.");
  })
  .catch((error) => {
    console.error("Firebase connection test failed:", error);
  });

document.querySelector(".copy-count-btn").addEventListener("click", () => {
  navigator.clipboard.writeText(gamesCountEl.textContent).catch(() => {});
});
render();
