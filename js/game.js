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

export function createGameState(twoPlayer = true) {
  return {
    twoPlayer,
    phase: Phase.PLACEMENT,
    currentPlayer: Player.ONE,
    placedCount: 0,
    /** @type {Map<string, Occupant>} */
    board: new Map(),
    winner: null,
  };
}

/** @param {ReturnType<typeof createGameState>} state @param {string} nodeId */
export function canPlaceAt(state, nodeId) {
  if (state.phase !== Phase.PLACEMENT) return false;
  if (state.board.has(nodeId)) return false;
  return true;
}

/** @param {ReturnType<typeof createGameState>} state @param {string} nodeId */
export function placePiece(state, nodeId) {
  if (!canPlaceAt(state, nodeId)) return false;

  state.board.set(nodeId, state.currentPlayer);
  state.placedCount += 1;

  if (state.placedCount >= TOTAL_PIECES) {
    state.phase = Phase.MOVEMENT;
  } else {
    state.currentPlayer =
      state.currentPlayer === Player.ONE ? Player.TWO : Player.ONE;
  }
  return true;
}

/** @param {ReturnType<typeof createGameState>} state */
export function statusMessage(state) {
  if (state.phase === Phase.FINISHED && state.winner) {
    return `Player ${state.winner} wins!`;
  }
  if (state.phase === Phase.MOVEMENT) {
    return `Movement phase — Player ${state.currentPlayer}'s turn (rules coming soon)`;
  }
  const vs = state.twoPlayer ? "" : " vs CPU";
  return `Place your pieces${vs} — Player ${state.currentPlayer}'s turn`;
}

/** @param {ReturnType<typeof createGameState>} state */
export function phaseMessage(state) {
  if (state.phase === Phase.PLACEMENT) {
    return `Placement: ${state.placedCount} / ${TOTAL_PIECES}`;
  }
  if (state.phase === Phase.MOVEMENT) {
    return "Movement phase";
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
  state.board.clear();
  state.winner = null;
}
