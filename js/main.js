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
const boardHighlights = document.getElementById("board-highlights");
const statusText = document.getElementById("status-text");
const phaseText = document.getElementById("phase-text");
const p1Stack = document.getElementById("p1-stack");
const p2Stack = document.getElementById("p2-stack");
const p1StackPile = document.getElementById("p1-stack-pile");
const p2StackPile = document.getElementById("p2-stack-pile");
const p1StackCount = document.getElementById("p1-stack-count");
const p2StackCount = document.getElementById("p2-stack-count");
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
        } else if (owner === state.currentPlayer && getValidMoves(state, adjacency, node.id).length > 0) {
          circle.classList.add("movable");
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
  const size = 36;
  const halfSize = size / 2;
  boardPieces.replaceChildren(
    ...nodes
      .filter((n) => state.board.has(n.id))
      .map((node) => {
        const player = state.board.get(node.id);
        const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
        img.setAttribute("x", node.x - halfSize);
        img.setAttribute("y", node.y - halfSize);
        img.setAttribute("width", size);
        img.setAttribute("height", size);
        img.setAttribute(
          "href",
          player === 1 ? "images/chip-p1.svg" : "images/chip-p2.svg"
        );
        img.classList.add("piece", player === 1 ? "player1" : "player2");
        return img;
      })
  );
}

function makeRing(node, className, radius = 21) {
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", node.x);
  ring.setAttribute("cy", node.y);
  ring.setAttribute("r", radius);
  ring.classList.add(className);
  return ring;
}

function renderHighlights() {
  if (state.awaitingRemoval) {
    boardHighlights.replaceChildren(
      ...nodes
        .filter((n) => canRemove(state, n.id, state.currentPlayer))
        .map((node) => makeRing(node, "removable-ring"))
    );
    return;
  }

  if (state.phase === Phase.MOVEMENT && selectedNodeId !== null) {
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    boardHighlights.replaceChildren(selectedNode ? makeRing(selectedNode, "selected-ring") : []);
    return;
  }

  boardHighlights.replaceChildren();
}

function renderChipStack(pileEl, countEl, player, count) {
  const src = player === 1 ? "images/chip-p1.svg" : "images/chip-p2.svg";
  pileEl.replaceChildren(
    ...Array.from({ length: count }, () => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.className = "stack-chip";
      return img;
    })
  );
  countEl.textContent = String(count);
}

function updateStatus() {
  statusText.textContent = statusMessage(state);
  statusText.classList.toggle("status-text--alert", state.awaitingRemoval);
  statusText.classList.toggle("status-text--win", state.phase === Phase.FINISHED);
  phaseText.textContent = phaseMessage(state);

  renderChipStack(p1StackPile, p1StackCount, 1, remainingPieces(state, 1));
  renderChipStack(p2StackPile, p2StackCount, 2, remainingPieces(state, 2));

  const turnActive = state.phase !== Phase.FINISHED;
  p1Stack.classList.toggle("active", turnActive && state.currentPlayer === 1);
  p2Stack.classList.toggle("active", turnActive && state.currentPlayer === 2);
}

function render() {
  renderLines();
  renderNodes();
  renderPieces();
  renderHighlights();
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
