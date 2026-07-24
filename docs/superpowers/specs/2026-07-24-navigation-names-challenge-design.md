# Tiebreak Navigation, Player Names, and Friend Challenge Design

**Date:** 2026-07-24
**Status:** Approved in conversation; awaiting written-spec review

## Goal

Improve Tiebreak's setup and result flows by:

- adding predictable Back navigation;
- allowing local multiplayer players to choose distinct names;
- adding the same result-screen “Challenge a Friend” sharing experience used
  by the other Apps On The House games.

This is not online multiplayer. The game remains single-player versus the
laptop or local two-player on one device.

## Navigation

The setup flow gains a visible Back button with these destinations:

- laptop difficulty → home;
- single-player setup → laptop difficulty;
- local Player 1 setup → home;
- local Player 2 setup → local Player 1 setup.

Going back from local Player 2 preserves both player drafts. Player 1 can edit
their name, monster, or stats and confirm again; Player 2 then returns with
their previous draft intact. Going back from single-player setup preserves that
player's draft while a different laptop difficulty is selected.

Returning to home ends the current setup flow and resets its drafts. Result
screen Home and Rematch behavior remain unchanged.

## Player Draft State

Setup data moves into reducer-owned player drafts. Each local draft contains:

```text
name
monsterId
build
```

The single-player draft uses the same structure internally but keeps the
displayed player name “Player 1”; name editing is shown only in local
multiplayer.

The setup screen reads and edits the active draft. Confirming a player stores a
normalized copy, rather than appending an irreversible player object. This lets
Back navigation revisit Player 1 without losing Player 2's work or creating
duplicate players.

The last-monster preference continues to seed newly created drafts. It does not
overwrite a draft when navigating backward.

## Multiplayer Name Rules

Each local player setup screen includes a labeled text field.

- Defaults are `Player 1` and `Player 2`.
- Leading and trailing whitespace is removed when validating and confirming.
- A valid name contains 1–10 characters after trimming.
- The two names must be unique after trimming and case folding.
- Duplicate names such as `Alex` and ` alex ` are rejected.
- Internal spaces and ordinary Unicode characters are allowed.

The Ready button is disabled when either the 20-point stat build or the active
name is invalid. A concise live validation message explains whether the name is
empty, over 10 characters, or already used by the other player.

The confirmed names appear everywhere the current generated names appear:
intro, score HUD, serve announcements, pause/help context, results, and
challenge text.

## Challenge a Friend

The result screen gains a `Challenge a Friend` button in both single-player and
local multiplayer. It sits between `Rematch` and `Home` in the result actions.
This is social sharing, not online matchmaking.

Its share text is:

```text
{Winner name} won {winner score}–{loser score} in Tiebreak. Can you beat that score?

Free. No ads. No signup.
{share URL}
```

The score is written winner-first in the message even when the winner occupies
the second match slot.

The share URL is the canonical game route:

```text
/games/tiebreak/
```

When already served from a `/games/` route, the current origin is used.
Otherwise the fallback is:

```text
https://appsonthehouse.com/games/tiebreak/
```

Behavior matches the other games:

- supported mobile browsers use `navigator.share` with one precomposed text
  value;
- desktop fallback opens a compact menu for X, Facebook, LinkedIn, and
  WhatsApp;
- `Copy for Instagram` copies the complete message and briefly confirms
  success;
- Escape and outside click close the menu;
- native-share cancellation and clipboard failure are silent;
- external destinations open only after an explicit player action.

The control adopts Tiebreak's pixel button styling while keeping the established
label and behavior. Tiebreak adds `lucide-react` and uses its bundled `Share2`
and `Check` icons, matching the reference games without creating a runtime
network request.

## Accessibility and Responsive Behavior

- Back controls appear in the setup header with a quiet secondary style.
- Back and Challenge controls are native buttons with visible focus styles.
- The name field has a persistent label, `maxlength="10"`, autocomplete
  disabled, and an associated validation message.
- The share fallback uses menu semantics and remains keyboard dismissible.
- Status text for copied/validation states is announced without moving focus.
- Setup actions remain reachable at the existing mobile and desktop
  breakpoints.
- The result actions wrap when needed and never cover the monsters or final
  score.

## Failure Handling

- Unsupported native sharing falls back to the desktop menu.
- Cancelling native sharing changes no app state.
- Clipboard failure leaves the menu usable and does not block Rematch or Home.
- Invalid or duplicate names never enter the confirmed match players.
- Back navigation never partially confirms a player.

## Testing

Automated coverage will verify:

- every Back transition and its preservation/reset behavior;
- local drafts survive Player 2 → Player 1 → Player 2 navigation;
- trimmed 1–10 character names are accepted;
- empty, over-limit, and case-insensitive duplicate names are rejected;
- confirmed names flow into intro, match, result, and challenge data;
- winner-first challenge score formatting for either winner index;
- canonical and local-origin share URLs;
- native-share, desktop-menu, copy, outside-click, and Escape paths;
- no change to match scoring, rematch serve alternation, offline shell
  generation, or single-player AI.

The game test suite, production build, website share-link integration test, and
assembled website build must remain green.

## Browser Playtest

The production build will be checked through:

1. every Back destination;
2. preserved Player 1 and Player 2 drafts;
3. empty, 10-character, 11-character, and duplicate-name states;
4. a completed local match showing both custom names;
5. the result share button, desktop fallback, Escape dismissal, and copy
   confirmation;
6. setup/result layout at desktop and narrow mobile widths.
