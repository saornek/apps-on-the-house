# Apps On The House — Games

[![CI](https://github.com/saornek/apps-on-the-house/actions/workflows/ci.yml/badge.svg)](https://github.com/saornek/apps-on-the-house/actions/workflows/ci.yml)
[![Vercel](https://deploy-badge.vercel.app/vercel/apps-on-the-house-web)](https://apps-on-the-house-web.vercel.app/)
[![Games](https://img.shields.io/badge/games-5_live-C2693E.svg)](#games)
[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-orange.png)](https://www.buymeacoffee.com/selinalaraornek)

Open-source games from **Apps On The House**, a small collection of free,
genuinely usable apps and games.

## The promise

**Free. No ads. No subscriptions. No dark patterns.**

Every game here is free to play and free to read. No ads, no tracking, no accounts,
no in-app purchases. Anything a game saves stays on your device.

## How these work

- **Web-first PWAs** — they run in the browser and can be installed to your home
  screen ("Add to Home Screen"). No app store required.
- **Local-only** — no servers, no accounts. Saved data lives on your device, with an
  export/import option so you never lose it.

## Games

### Just Blocks

A calm block puzzle (in the *1010!* / *Block Blast* style). Drag the three tray pieces
onto an 8×8 grid; fill a full row or column to clear it. No falling pieces — play at
your own pace. It's game over when none of your pieces fit. Tracks a local best score,
works with mouse and touch, and installs as an offline PWA.

```bash
cd just-blocks
npm install
npm run dev      # play locally with hot reload
npm run build    # production build into dist/
```

*More games to come.*

## Repo layout

Each game lives in its own folder:

```
just-blocks/        A block puzzle
README.md           This file
LICENSE             GNU GPLv3
```

## Build & publish

Each game is its own self-contained **Vite** app — its own `package.json`, build, and PWA
(manifest + service worker + icons). Build any game on its own with:

```bash
cd <game>
npm install
npm run build    # → <game>/dist/
```

**How games get published to the site:** this repo is pulled into the private website repo
as a **git submodule** (at `website/games/`). The website is the single deploy; its build
builds each game here and serves it at **`appsonthehouse…/games/<name>/`**. There is **no
separate deploy per game** — the website bundles them all.

To publish a change to a game:

1. Commit & push it here (the games repo).
2. In the **website** repo, bump the submodule pointer and redeploy:
   ```bash
   git submodule update --remote games
   git add games && git commit -m "Update games" && git push
   ```

### Adding a new game

1. Create a new folder here (e.g. `my-game/`) as a Vite app.
2. Set Vite **`base: './'`** so its assets resolve under `/games/my-game/`.
3. Push here, then bump the submodule pointer in the website (as above).
4. Add it to the website's Games page list. That's it — no new deploy.

## Contributing

This is a small, for-fun project, but issues and pull requests are welcome. The one
non-negotiable rule mirrors the promise: **nothing that adds ads, tracking, paywalls,
or dark patterns**.

## License

Licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE).

GPLv3 is copyleft: you're free to use, study, share, and modify these games, but any
distributed derivative must also stay open-source under the GPL. In plain terms, nobody
can take this code private, paywall it, or bolt ads onto it and redistribute — which is
exactly the point. © 2026 Apps On The House.
