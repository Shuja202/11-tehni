const STORAGE_KEY = "11tehni_games_played";

/** Games played — stored in the browser (see README for global counter options). */
export function getGamesPlayed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = parseInt(raw ?? "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementGamesPlayed() {
  const next = getGamesPlayed() + 1;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* private browsing / quota */
  }
  return next;
}
