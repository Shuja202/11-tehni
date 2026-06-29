import { buildBoardGraph, edgesToSegments, BOARD } from "./board.js";
import {
  createGameState,
  canPlaceAt,
  placePiece,
  statusMessage,
  phaseMessage,
  setMode,
  resetGame,
  Phase,
} from "./game.js";
import { getGamesPlayed } from "./stats.js";
// incrementGamesPlayed() will be wired when movement / win rules are added

const { nodes, edges } = buildBoardGraph();
const segments = edgesToSegments(edges, nodes);

const boardLines = document.getElementById("board-lines");
const boardNodes = document.getElementById("board-nodes");
const boardPieces = document.getElementById("board-pieces");
const statusText = document.getElementById("status-text");
const phaseText = document.getElementById("phase-text");
const modeToggle = document.getElementById("mode-toggle");
const modeLabel = modeToggle.querySelector(".mode-label");
const gamesCountEl = document.getElementById("games-count");

let state = createGameState(true);

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

      if (state.board.has(node.id)) {
        circle.classList.add("occupied");
      } else if (state.phase === Phase.PLACEMENT && canPlaceAt(state, node.id)) {
        circle.classList.add("valid");
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
}

function render() {
  renderLines();
  renderNodes();
  renderPieces();
  updateStatus();
}

function onNodeClick(nodeId) {
  if (state.phase !== Phase.PLACEMENT) return;
  if (!canPlaceAt(state, nodeId)) return;

  const placed = placePiece(state, nodeId);
  if (!placed) return;

  if (!state.twoPlayer && state.phase === Phase.PLACEMENT) {
    maybeCpuPlace();
  }

  render();
}

function maybeCpuPlace() {
  if (state.twoPlayer || state.phase !== Phase.PLACEMENT) return;
  if (state.currentPlayer !== 2) return;

  const empty = nodes.filter((n) => canPlaceAt(state, n.id));
  if (empty.length === 0) return;

  const pick = empty[Math.floor(Math.random() * empty.length)];
  placePiece(state, pick.id);

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
  setMode(state, nextTwoPlayer);
  render();
}

modeToggle.addEventListener("click", onModeToggle);

gamesCountEl.textContent = String(getGamesPlayed());
render();
