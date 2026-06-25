# Apps On The House — Games
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
