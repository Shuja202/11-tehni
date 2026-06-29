# 11 Tehni

A single-page web version of the traditional Pakistani board game **11 Tehni**.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source**: Deploy from a branch.
3. Branch: `main`, folder: `/ (root)`.
4. Your game will be at `https://<username>.github.io/<repo>/`.

No build step required — static HTML, CSS, and JavaScript only.

## Games played counter

GitHub Pages hosts **static files only**. There is no server and no built-in database.

| Approach | Scope | Setup |
|----------|--------|--------|
| **localStorage** (current) | Per browser / device | None — works offline |
| **Firebase Firestore** | Global across all visitors | Free tier; add a small JS snippet |
| **Supabase** | Global | Free tier; REST or client SDK |
| **CountAPI** | Global single number | One HTTP URL, no account |

**Recommendation:** Keep `localStorage` for a personal counter. If you want one shared “total games played worldwide” number on GitHub Pages, use **Firebase** or **Supabase** (both have generous free tiers and work from static sites).

The counter is wired in `js/stats.js` and will increment when a game is won (once movement rules are added). Until then it reads from storage but stays at 0 for new players.

## Project structure

```
index.html      — single page, no scroll
css/style.css   — full-viewport layout
js/board.js     — board geometry (3 rectangles + 4 spokes)
js/game.js      — placement phase state
js/stats.js     — games played persistence
js/main.js      — rendering and UI
```
