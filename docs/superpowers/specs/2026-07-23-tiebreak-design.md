# Tiebreak — Game Design

**Date:** 2026-07-23
**Status:** Approved for implementation planning
**Repository:** `games`
**License:** GPL-3.0-or-later

## Summary

Tiebreak is a fast, overhead pixel-tennis game starring original pixel monsters
with clearly visible rackets. It supports single-player matches against the
laptop and local two-player matches on one device.

Each match is one tennis tiebreak: the first player to reach seven points with a
two-point lead wins. Players choose a monster and distribute an equal stat budget
before every match. The monsters differ visually, while the selected stat build
creates the gameplay differences.

Tiebreak follows the Apps On The House promise: free, offline-capable, no ads, no
tracking, no accounts, no subscriptions, and no dark patterns.

## Product Goals

- Make a complete match playable in roughly three to five minutes.
- Make movement and aiming understandable with only directional input.
- Support desktop keyboard play and mobile or tablet multi-touch play.
- Make Forehand, Backhand, Serve, and Footwork visibly affect play.
- Give the roster personality without creating character-balance problems.
- Keep the live court readable by using a minimal match HUD.

## Non-Goals

- Online multiplayer or networking
- Accounts, leaderboards, or cloud saves
- Permanent upgrades or progression
- Monster-specific powers or passive traits
- Tournaments, careers, unlock systems, or multiple court types
- Realistic tennis simulation

## Match Rules

### Scoring

- A player wins by reaching at least seven points with a lead of two or more.
- A score such as 7–5 ends the match.
- A score such as 7–6 does not end the match; play continues until one player
  leads by two.
- There is no score cap.

### Serving

- The opening server is selected at random and shown before the first point.
- The opening server serves the first point.
- Service then alternates in groups of two points, matching tennis tiebreak
  rotation.
- A rematch gives the other player the opening serve.
- The server enters a short countdown before the ball launches automatically.
- Directional input during the countdown biases the serve placement.
- Serves always target a legal service box. Serve rating changes pace, width,
  and placement consistency rather than creating random double faults.

### Rally Rules

- The ball uses a readable 2.5D trajectory: court position, visible height, and a
  ground shadow.
- The ball may be returned before or after its first bounce.
- A second bounce awards the point to the opponent.
- A shot that lands outside the opponent's court is out.
- A shot that reaches the net plane below net height is a net fault.
- Point results appear briefly as `OUT`, `NET`, or `DOUBLE BOUNCE`.
- Players cannot cross the net or leave the playable boundary around their half.

## Player Controls

### Movement and Swinging

- Players move freely in two dimensions within their own half.
- Player 1 uses WASD.
- Player 2 uses the arrow keys.
- In single-player, either keyboard layout controls the human player.
- On touch devices, a touch that begins within a player's half belongs to that
  player until it ends or is cancelled.
- Dragging within a half supplies relative movement, allowing two simultaneous
  touches without permanent virtual-stick graphics.
- In face-to-face touch play, the top player's input and setup UI are rotated so
  movement reads naturally from that side of the device.
- A swing triggers automatically when the ball enters the monster's legal reach.
- The direction held at contact aims the shot. With no input, the monster returns
  safely toward the middle of the opponent's court.
- Sideways input creates wider angles. Input toward the opponent creates a deeper
  shot; input away from the opponent creates a shorter shot.

### Forehand and Backhand

- All v1 monsters use the same racket hand.
- The ball's position relative to the monster determines whether the automatic
  return is a forehand or backhand.
- Forehand and backhand have distinct, readable racket poses.
- The active stroke's stat changes shot speed and target precision.
- The game never asks the player to press a separate swing or stroke button.

### Pause and Interrupted Input

- Escape or a small corner button opens pause and help.
- Movement clears when the window loses focus, a key is released, or a touch is
  cancelled.
- The match pauses when the page becomes hidden, preventing an unattended point.

## Monster Roster and Stat Allocation

### Roster

Version 1 includes four original pixel monsters. Each has:

- a distinct silhouette, palette, and name;
- a visible pixel racket in every pose;
- idle, run, serve, forehand, backhand, win, and loss animation states.

Monster choice is cosmetic. Monsters have no hidden modifiers, passive traits, or
special moves.

### Stat Build

Before every match, each human player receives 20 points to distribute across:

- **Forehand:** forehand return speed and target precision;
- **Backhand:** backhand return speed and target precision;
- **Serve:** serve speed, width, and placement consistency;
- **Footwork:** movement speed and post-swing recovery.

Each stat has a minimum of 1 and a maximum of 9. The allocation screen begins at
the balanced 5/5/5/5 build. Lowering a stat returns points to the available pool;
raising another spends them. The Ready action remains disabled unless all 20
points are allocated. A Reset action restores 5/5/5/5.

In local two-player mode, players select and allocate in sequence. Both receive
the same budget, and both completed builds are visible before the match.

## Single-Player Laptop

Single-player offers Easy, Normal, and Hard.

- The laptop chooses from curated 20-point builds and never receives extra stat
  points.
- Difficulty changes reaction delay, anticipation, recovery positioning, and
  target error.
- Easy reacts late, recenters imperfectly, and chooses safer targets.
- Normal provides the intended balanced match.
- Hard reacts quickly, anticipates likely trajectories, and uses wider targets,
  but remains constrained by its selected stats and movement limits.
- Laptop decisions consume the same simulation inputs used by human players so
  it cannot teleport or bypass swing recovery.
- Randomness is seeded or injectable in tests so difficulty behavior can be
  verified deterministically.

## Screens and User Flow

1. **Home:** Tiebreak title, `1 Player`, `2 Players`, help, and mute.
2. **Difficulty:** Easy, Normal, or Hard when single-player is selected.
3. **Monster select:** choose one of four original monsters.
4. **Stat allocation:** distribute 20 points and confirm.
5. **Opponent setup:** laptop build reveal or second-player setup.
6. **Match intro:** shows both monsters, builds, and opening server.
7. **Match:** countdown, rallies, point results, and score updates.
8. **Result:** winner, final score, rematch, or return home.

The match HUD contains only player names, score, and a server indicator. Help,
settings, and detailed controls stay behind pause or setup screens.

## Visual Direction

- Overhead court inspired by compact arcade tennis rather than a realistic
  broadcast view.
- Warm clay, cream, deep teal, mustard, mint, and pink palette established in the
  approved visual mockups.
- Chunky, original pixel-monster sprites with strong silhouettes.
- Rackets are part of every sprite frame, not a hidden collision effect.
- Forehand and backhand poses are unmistakably different.
- Court lines, ball shadow, net, and player shadows make depth readable.
- `image-rendering: pixelated` preserves hard sprite edges.
- Pixel-styled display lettering is used for short labels; body and help copy
  remain highly readable.
- Strong motion is reserved for serves, contact, point results, and celebrations.
- Reduced-motion mode removes screen shake, long celebrations, and nonessential
  motion while preserving gameplay feedback.

## Audio

- Short, lightweight sounds cover serve, racket contact, bounce, net, out, point,
  and match win.
- Audio begins only after user interaction to respect browser autoplay rules.
- A persistent mute setting is stored locally when storage is available.
- Muting affects all game audio immediately.

## Technical Architecture

Tiebreak is a self-contained React 19 and Vite application under
`games/tiebreak/`, following the existing game packages.

### Simulation

A renderer-independent simulation owns:

- match phase and point transitions;
- score and server rotation;
- player movement and boundaries;
- ball position, height, velocity, bounce, net, and out checks;
- automatic swing selection and recovery;
- stat-derived tuning;
- laptop decisions.

The simulation uses a fixed timestep so keyboard, touch, laptop behavior, and
render frame rate do not change the rules.

### Rendering

A canvas renderer owns:

- the court, lines, net, shadows, and ball;
- sprite animation and racket-contact frames;
- short contact and point effects;
- responsive scaling from a fixed virtual resolution.

Rendering reads simulation state but does not own gameplay rules.

### React and DOM UI

React and semantic DOM elements own:

- mode, difficulty, monster, and stat screens;
- score and server HUD;
- countdown and point messages;
- pause, help, mute, and results;
- live-region announcements for score and point results.

### Input

One input module maps physical controls to player actions:

- Player 1 movement;
- Player 2 movement;
- pause;
- confirm and cancel.

It supports multiple simultaneous touch identifiers and clears interrupted input.
Renderer objects are never used as the source of input or simulation state.

### App State

The high-level state machine contains:

`home → difficulty/setup → intro → countdown → rally → point-result → countdown`

From `point-result`, a completed match moves to `match-over`. Pause is an overlay
state that suspends the fixed-step simulation without discarding match state.

### Assets

- Sprite sheets and audio ship locally with stable manifest keys.
- Runtime code refers to asset keys rather than filenames.
- No gameplay asset depends on a third-party network request.
- The PWA uses `base: './'` so it can run at `/games/tiebreak/`.

### Persistence

Local storage may retain:

- mute preference;
- last selected monster.

Match outcomes and stat allocations are not permanent progression. Storage access
is wrapped so privacy settings or quota errors cannot stop the game.

## Responsive and Accessibility Behavior

- Desktop play supports one or two players at one keyboard.
- Portrait phones prioritize a tall court and one-player touch readability.
- Local two-player touch remains functional on phones but is optimized for
  tablets or larger screens.
- Touch targets in menus meet a minimum comfortable size.
- Score and server state are communicated with text or icons, not color alone.
- Keyboard focus remains visible in menus.
- Canvas gameplay has adjacent DOM instructions and live score announcements.
- Resizing or device rotation preserves simulation coordinates and active score.

## Failure Handling

- Invalid or incomplete stat builds cannot start a match.
- Stat values are clamped to 1–9 and the total must equal 20.
- Lost focus, visibility changes, and touch cancellation clear movement.
- Large frame gaps are capped so returning to a tab cannot advance the ball
  through the court in one step.
- Resize events change rendering scale rather than simulation dimensions.
- Missing optional audio falls back to silent play.
- Local-storage failures are ignored after preserving in-memory preferences.
- Asset-loading failure produces a readable retry screen instead of a blank
  canvas.

## Testing and Verification

### Unit Tests

- first-to-seven and win-by-two match completion;
- continued play at 6–6 and 7–6;
- opening serve plus two-serve rotation;
- rematch opening-server alternation;
- 20-point allocation, min/max values, reset, and invalid builds;
- court bounds, legal bounces, second bounce, out, and net faults;
- automatic forehand/backhand selection;
- stat effects remain within configured limits;
- laptop reaction and target error by difficulty;
- keyboard release, multi-touch ownership, and cancellation;
- fixed-timestep stability across different render frame intervals.

### Integration Tests

- home-to-match flow for single-player;
- sequential two-player setup;
- pause and resume without state loss;
- match result and rematch;
- mute and last-monster persistence with storage available or blocked.

### Manual Playtest

- desktop single-player with WASD and arrows;
- desktop two-player with simultaneous keyboard input;
- phone single-player touch;
- tablet face-to-face two-player multi-touch;
- portrait and landscape resize behavior;
- Easy, Normal, and Hard fairness;
- readable racket poses and ball depth at gameplay scale;
- reduced-motion mode;
- offline PWA launch after installation.

## Website Integration

After the game package is complete:

- add a Tiebreak preview image to the website;
- replace the current Pixel Tennis coming-soon entry with Tiebreak;
- link the card to `/games/tiebreak/`;
- assign the Sports category and the release date;
- confirm the website build discovers and assembles the new game automatically.

Existing unrelated website changes are outside this feature's scope.

## Definition of Done

Tiebreak is complete when:

- single-player and local two-player matches can be finished reliably;
- scoring and serve rotation follow the approved rules;
- every monster visibly holds a racket in all required states;
- stat allocation measurably changes play without breaking fairness;
- all three laptop difficulties are distinct and beatable;
- keyboard and multi-touch controls pass the planned playtests;
- the game builds as an offline-capable PWA;
- automated tests pass;
- the website card launches the assembled `/games/tiebreak/` build.
