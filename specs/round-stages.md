# Round Stages on a Map

## Purpose

When the manager watches a series round by round, each round is also shown on the map's minimap, with every player marked where they stand. A round is split into stages so the manager can step through its shape: setup, contact, and post-plant. This is only part of the watched replay. Quick sims have no stages and no positions.

## Inputs

- A watched `MapReplay` from `simulateSeries` (`src/round-sim.ts`): each round's attacker, winner, end reason, and events in order (kills, the plant with its site, the defuse).
- The lineups of both teams.
- The map's layout (`src/map-layouts.ts`) and its minimap (`map_images/`).

## Stages

- Setup, always first: starts at step 0, before any event.
- Contact, when there are fights before the spike goes down, or when the round has no plant: starts at step 1.
- Post-plant, when the spike is planted: starts right after the plant event, step `plantIndex + 1`.

A round has two or three stages in practice. The sim has one plant per round, so it never produces more.

## Positions

Positions are computed from the events and never from random numbers, so the same round always draws the same way.

- Setup: attackers stand on the attack spawn. Defenders hold their sites, spread across all of them.
- Contact: alive attackers move up to mid. Kills happen where the players stand, and victims stay where they fell, marked dead.
- Post-plant: the planter stands beside the spike on the planted site. Alive attackers fan out round the site. Alive defenders come in to retake from outside it. A defuser stands beside the spike.
- The spike marks the site it was planted on. It shows as planted, defused, or detonated (on a detonation end).

## State changes

None. The stage view only reads the replay. Nothing is saved, and the box score is unchanged.

## Playback

- Step n means the first n events have happened. Each stage's movement applies just before its first event.
- Paused: Next moves to the next stage of the round. From the last stage it finishes the round, and from a finished round it moves to the next round at its setup. Clicking a stage name jumps to it. End round finishes the current round.
- Live: each event takes 900 ms (divided by the speed multiplier). A stage holds for 2200 ms before its first event, and a finished round pauses 1600 ms before the next one.
- Previous round and the round strip show the chosen round finished, as before.

## Map images

Each map in the pool uses its minimap from `map_images/` (imported in `src/map-images.ts`). The layout points in `src/map-layouts.ts` are placed over those images and snapped to floor pixels, so no dot sits on a wall or in a void. Site letters and which structure is which site were read from unlabelled images, so they need checking against the game. To move a point, edit it in `src/map-layouts.ts`. To change a map's art, replace its PNG and re-check the points.

## Acceptance criteria

- Every round in a watched series has two to three stages, the first being setup at step 0.
- At step 0, attackers are on their spawn and defenders are in site holds, with no spike.
- A player who is killed stays at the same point for the rest of the round.
- After a plant, living attackers stand on the planted site.
- The final frame's living/dead split and spike state match the round's end reason.
- Frames are a pure function of the round and step.
- Live playback moves through stages without input.
