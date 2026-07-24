# Tiebreak Racket Direction Design

**Date:** 2026-07-23
**Status:** Approved in conversation; awaiting written-spec review

## Goal

Make each monster's racket visibly follow horizontal movement and shot aim:

- left input places the racket on the screen-left side;
- right input places the racket on the screen-right side;
- centered or vertical-only input preserves the last horizontal side;
- the actual horizontal shot aim takes priority during serves and returns.

The arm and racket must mirror together and remain visibly attached to the
monster. The monster body continues to face the court.

## State and Data Flow

Each simulated player stores a `racketDirection` value of `-1` for screen-left
or `1` for screen-right.

Horizontal movement above the existing input dead zone updates the remembered
direction. Zero or vertical-only movement does not reset it. This applies to
keyboard, touch, and laptop movement because all three feed the same simulation
movement path.

At a serve or return, the horizontal shot target becomes authoritative for the
swing pose. A non-zero horizontal aim updates `racketDirection` immediately
before the shot is rendered. This prevents the laptop's interception movement
from disagreeing with its selected return direction.

## Sprite Geometry

`spritePlan` accepts an optional local racket side. Pose data retains the
monster-body offsets and racket reach, while the racket head, handle, and
connecting arm are reflected together around the body.

The canvas renderer converts the remembered screen direction into the local
sprite direction after accounting for the top player's existing court-facing
mirror. Menu and setup illustrations keep their current default racket side.

No new raster assets are required; the current crisp pixel primitives remain the
single source for all four monsters and every pose.

## Edge Cases

- A player who has not moved keeps the current default side.
- Vertical movement does not cause side flicker.
- Small analog or touch jitter inside the input dead zone does not switch sides.
- Serve aim can change the server's racket side during the countdown.
- A shot with no horizontal aim keeps the remembered side.
- Pause and point transitions preserve the last side for the current simulation;
  a newly created point simulation starts from the default side.

## Testing

Automated tests will be written before production changes and will verify:

- left and right movement update `racketDirection`;
- centered and vertical-only movement preserve it;
- serve and return aim override the side at contact;
- all four monsters keep the racket arm geometrically attached on both sides
  across every required pose;
- the top and bottom players render the requested screen-facing side despite
  their different court-facing transforms.

The full game suite and production build must remain green.

## Playtest

The production build will be checked in the browser by:

1. starting a playable match;
2. tapping left and capturing the screen-left racket pose;
3. tapping right and capturing the screen-right racket pose;
4. confirming both players remain readable, attached, and unobstructed at game
   scale.
