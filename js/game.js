export const PIECES_PER_PLAYER = 11;
export const TOTAL_PIECES = PIECES_PER_PLAYER * 2;

export const Phase = {
  PLACEMENT: "placement",
  MOVEMENT: "movement",
  FINISHED: "finished",
};

export const Player = {
  ONE: 1,
  TWO: 2,
};

/** @typedef {1 | 2 | null} Occupant */

export const MILL_LINES = [
  // Outer rectangle sides
  ["r0-tl", "r0-tm", "r0-tr"], ["r0-tr", "r0-rm", "r0-br"],
  ["r0-br", "r0-bm", "r0-bl"], ["r0-bl", "r0-lm", "r0-tl"],
  // Middle rectangle sides
  ["r1-tl", "r1-tm", "r1-tr"], ["r1-tr", "r1-rm", "r1-br"],
  ["r1-br", "r1-bm", "r1-bl"], ["r1-bl", "r1-lm", "r1-tl"],
  // Inner rectangle sides
  ["r2-tl", "r2-tm", "r2-tr"], ["r2-tr", "r2-rm", "r2-br"],
  ["r2-br", "r2-bm", "r2-bl"], ["r2-bl", "r2-lm", "r2-tl"],
  // Spokes (cross-rectangle collinear nodes)
  ["r0-tm", "r1-tm", "r2-tm"], ["r0-rm", "r1-rm", "r2-rm"],
  ["r0-bm", "r1-bm", "r2-bm"], ["r0-lm", "r1-lm", "r2-lm"],
];

/** @param {[string, string][]} edges */
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

function opponentOf(player) {
  return player === Player.ONE ? Player.TWO : Player.ONE;
}

function checkMill(state, nodeId, player) {
  return MILL_LINES.some(
    (line) => line.includes(nodeId) && line.every((id) => state.board.get(id) === player)
  );
}

function countPieces(state, player) {
  let n = 0;
  for (const v of state.board.values()) if (v === player) n += 1;
  return n;
}

export function createGameState(twoPlayer = true) {
  return {
    twoPlayer,
    phase: Phase.PLACEMENT,
    currentPlayer: Player.ONE,
    placedCount: 0,
    /** Pieces each player has placed so far — does not decrease if a piece is later captured. */
    placedByPlayer: { [Player.ONE]: 0, [Player.TWO]: 0 },
    /** @type {Map<string, Occupant>} */
    board: new Map(),
    awaitingRemoval: false,
    winner: null,
  };
}

/** @param {ReturnType<typeof createGameState>} state @param {string} nodeId */
export function canPlaceAt(state, nodeId) {
  if (state.phase !== Phase.PLACEMENT) return false;
  if (state.awaitingRemoval) return false;
  if (state.board.has(nodeId)) return false;
  return true;
}

/** @param {ReturnType<typeof createGameState>} state @param {string} nodeId */
export function placePiece(state, nodeId) {
  if (!canPlaceAt(state, nodeId)) return false;

  const player = state.currentPlayer;
  state.board.set(nodeId, player);
  state.placedCount += 1;
  state.placedByPlayer[player] += 1;

  const millFormed = checkMill(state, nodeId, player);

  if (state.placedCount >= TOTAL_PIECES) {
    state.phase = Phase.MOVEMENT;
  }

  if (millFormed) {
    state.awaitingRemoval = true;
  } else {
    state.currentPlayer = opponentOf(player);
  }
  return true;
}

/** @param {ReturnType<typeof createGameState>} state @param {Map<string, Set<string>>} adjacency @param {string} nodeId */
export function getValidMoves(state, adjacency, nodeId) {
  const neighbors = adjacency.get(nodeId) ?? new Set();
  return [...neighbors].filter((id) => !state.board.has(id));
}

/** @param {ReturnType<typeof createGameState>} state @param {Map<string, Set<string>>} adjacency */
export function movePiece(state, adjacency, fromId, toId) {
  if (state.phase !== Phase.MOVEMENT || state.awaitingRemoval) {
    return { moved: false, millFormed: false };
  }
  if (state.board.get(fromId) !== state.currentPlayer) return { moved: false, millFormed: false };
  if (!getValidMoves(state, adjacency, fromId).includes(toId)) {
    return { moved: false, millFormed: false };
  }

  state.board.delete(fromId);
  state.board.set(toId, state.currentPlayer);

  const millFormed = checkMill(state, toId, state.currentPlayer);
  if (millFormed) {
    state.awaitingRemoval = true;
  } else {
    state.currentPlayer = opponentOf(state.currentPlayer);
  }
  return { moved: true, millFormed };
}

/** @param {ReturnType<typeof createGameState>} state @param {string} nodeId @param {1 | 2} currentPlayer */
export function canRemove(state, nodeId, currentPlayer) {
  if (!state.awaitingRemoval) return false;
  const owner = state.board.get(nodeId);
  if (!owner || owner === currentPlayer) return false;

  const opponent = opponentOf(currentPlayer);
  const inMill = MILL_LINES.some(
    (line) => line.includes(nodeId) && line.every((id) => state.board.get(id) === opponent)
  );
  if (!inMill) return true;

  // Can only take a piece out of a mill if every opponent piece is in a mill.
  const opponentPieces = [...state.board.entries()]
    .filter(([, v]) => v === opponent)
    .map(([k]) => k);
  return opponentPieces.every((id) =>
    MILL_LINES.some((line) => line.includes(id) && line.every((nid) => state.board.get(nid) === opponent))
  );
}

/** @param {ReturnType<typeof createGameState>} state @param {string} nodeId */
export function removePiece(state, nodeId) {
  if (!canRemove(state, nodeId, state.currentPlayer)) return false;
  state.board.delete(nodeId);
  state.awaitingRemoval = false;
  state.currentPlayer = opponentOf(state.currentPlayer);
  return true;
}

function hasValidMoves(state, adjacency, player) {
  for (const [nodeId, owner] of state.board) {
    if (owner === player && getValidMoves(state, adjacency, nodeId).length > 0) return true;
  }
  return false;
}

/** @param {ReturnType<typeof createGameState>} state @param {Map<string, Set<string>>} adjacency */
export function checkWin(state, adjacency) {
  if (state.phase !== Phase.MOVEMENT || state.awaitingRemoval) return null;
  for (const player of [Player.ONE, Player.TWO]) {
    if (countPieces(state, player) <= 2) return opponentOf(player);
    if (!hasValidMoves(state, adjacency, player)) return opponentOf(player);
  }
  return null;
}

/** @param {ReturnType<typeof createGameState>} state */
export function statusMessage(state) {
  if (state.phase === Phase.FINISHED && state.winner) {
    return `Player ${state.winner} wins!`;
  }
  if (state.awaitingRemoval) {
    return `Player ${state.currentPlayer}: mill! Remove one opponent piece`;
  }
  return "";
}

/** @param {ReturnType<typeof createGameState>} state @param {1 | 2} player */
export function remainingPieces(state, player) {
  return PIECES_PER_PLAYER - state.placedByPlayer[player];
}

/** @param {ReturnType<typeof createGameState>} state */
export function phaseMessage(state) {
  if (state.phase === Phase.PLACEMENT) {
    return `Placement: ${state.placedCount} / ${TOTAL_PIECES}`;
  }
  if (state.phase === Phase.MOVEMENT) {
    return `P1: ${countPieces(state, Player.ONE)} pieces  |  P2: ${countPieces(state, Player.TWO)} pieces`;
  }
  return "Game over";
}

/** @param {ReturnType<typeof createGameState>} state @param {boolean} twoPlayer */
export function setMode(state, twoPlayer) {
  state.twoPlayer = twoPlayer;
}

/** Call when a game is won — increments the global games-played stat. */
export function finishGame(state, winner) {
  state.phase = Phase.FINISHED;
  state.winner = winner;
}

/** @param {ReturnType<typeof createGameState>} state */
export function resetGame(state) {
  state.phase = Phase.PLACEMENT;
  state.currentPlayer = Player.ONE;
  state.placedCount = 0;
  state.placedByPlayer = { [Player.ONE]: 0, [Player.TWO]: 0 };
  state.board.clear();
  state.awaitingRemoval = false;
  state.winner = null;
}
