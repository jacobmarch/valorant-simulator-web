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

Every player stands on a named point from `src/map-layouts.ts`, and only on those. The points per map are the attack spawn, mid, two flank points, and for each site its plant spot, entry points, lanes, lurk spot, defender holds, post-plant points and retake points. The frame moves players only between these. Positions are computed from the events, never from random numbers, so the same round always draws the same way.

- Setup: attackers stand on the attack spawn. Defenders wait on the holds of the site the spike goes down on. If the spike never goes down, defenders are spread across every site.
- Contact: a lurker takes the planted site's lurk point (or a flank point if no spike went down). The other attackers spread over the site's entry points and lanes (or mid). Kills happen where the fighters stand. Victims stay where they fell, marked dead.
- The lurker is the first Sentinel or Controller among the attackers, as a team usually sends one to flank. With neither, the last attacker lurks, so one attacker is always apart from the group.
- Post-plant: attackers stand on the site's post points round the spike. Defenders come in to the site's retake points.
- The planter and the defuser stand beside the spike, on the site's first post point.
- The spike marks the site it went down on. It shows as planted, defused, or detonated on a detonation end.

Setup uses the planted site, which is the sim's own result, so a watched round shows where defenders were set up before the spike went down. A real game would not reveal that; the trade-off is deliberate.

## State changes

None. The stage view only reads the replay. Nothing is saved, and the box score is unchanged.

## Playback

- Step n means the first n events have happened. Each stage's movement applies just before its first event.
- The stages are not shown. There are no stage names, counts or captions, so the round isn't spoiled.
- Paused: Continue Round moves to the next stage of the round, then finishes the round, then moves to the next round at its setup. End round finishes the current round.
- Live: each event takes 900 ms (divided by the speed multiplier). A stage holds for 2200 ms before its first event, and a finished round pauses 1600 ms before the next one.
- Previous round and the round strip show the chosen round finished, as before.

## Map images

Each map in the pool uses its minimap from `map_images/` (imported in `src/map-images.ts`). Breeze's attack spawn is on the right of its image, so its copy in `src/assets/maps/breeze.png` is turned 90° clockwise, which puts the spawn at the bottom with the sites above, like the others. Site letters were read from unlabelled images, so they need checking against the game. To move a point, edit it in `src/map-layouts.ts`. To change a map's art, replace its PNG and re-check the points.

## Acceptance criteria

- Every round in a watched series has two to three stages, the first being setup at step 0.
- Every player's position at every step is one of the map's named points.
- In a planted round, defenders hold the planted site at setup and attackers reach its entry before the plant.
- At step 0, attackers are on their spawn and defenders are in site holds, with no spike.
- A player who is killed stays at the same point for the rest of the round.
- After a plant, living attackers stand on the planted site.
- The final frame's living/dead split and spike state match the round's end reason.
- Frames are a pure function of the round and step.
- Live playback moves through stages without input.
