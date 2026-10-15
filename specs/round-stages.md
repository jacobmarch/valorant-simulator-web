# Round Stages on a Map

## Purpose

When the manager watches a series round by round, each round is also shown on the map's minimap, with every player marked where they stand. A round is split into stages so the manager can step through its shape: setup, opening, map control, the hit, and the post-plant. This is only part of the watched replay. Quick sims have no stages and no positions.

## Inputs

- A watched `MapReplay` from `simulateSeries` (`src/round-sim.ts`): each round's attacker, winner, end reason, and events in order (kills, the plant with its site, the defuse).
- The lineups of both teams.
- The map's layout (`src/map-layouts.ts`) and its minimap (`map_images/`).

## Stages

The stages are beats of the round. A step is how many events have happened, and a fractional step is a beat between two events. The plan for the round (`src/round-plan.ts`, see `round-tactics.md`) decides which beats it has and where they fall.

- Setup, always first: step 0.
- Opening: step 0.25. The attack goes where its plan has it.
- Map control: step 0.5, for the plans that take control (default, fake, slow). Rush and split skip it.
- Reads: step `h + 0.6`, where `h` is how many kills fell before the hit. Defenders off the site start rotating if they read the attack.
- Hit: step `h + 0.8`. Skipped when the plant is the first event after map control.
- Rotation: step `h + 1.5`, partway through the fight, when more events follow.
- Post-plant: step `plantIndex + 0.8`. Retake: step `plantIndex + 1.5`, when more events follow the plant.

Every stage after setup starts on a fractional step, so its movement shows before the event that follows it. Each kill also has a fight step at `index + 0.9` (`FIGHT_AT`): the two fighters have moved together and both are alive. The kill lands on step `index + 1`, where the victim is marked dead where they stand. Players are always moved first, then die.

A round has between four and nine stages. The live timer holds each stage start for a moment, and a Continue Round press jumps to the next one.

## Positions

Every player stands on a named point from `src/map-layouts.ts`, and only on those. The points per map are the attack spawn, mid, two flank points, and for each site its plant spot, entry points, lanes, lurk spot, defender holds, post-plant points and retake points. The frame moves players only between these. Positions are computed from the events, never from random numbers, so the same round always draws the same way.

- The hit site is the one the spike goes down on. If the spike never goes down, the attack goes for a site that alternates by round, and every position below uses that site.
- Formations are picked per round from the map and round number, so the same round always lines up the same way. Defence is 4-1, 2-1-2 or 3-2; attack is 5-0, 2-1-2 or 3-1-1.
- Setup: attackers stand on the attack spawn. Defenders take their formation, with players shuffled across its slots by the plan. See `round-tactics.md`.
- Movement: after setup, nobody jumps. Each beat gives a side goals (staging points, hit points, retake points), the goals are handed out so the group walks the least, and every player takes one walk toward theirs: at most 40 units along the named points, or 70 on the opening, which leaves the spawn. A long trip, such as a rotation from one site to the other, takes several beats and passes through mid.
- Spacing: a player never stands within 12 units of an enemy or 7 of a teammate, except the two players about to fight. So nobody stands beside an enemy without a fight.
- Opening and map control: the attackers walk toward the points their plan has them on (mid, a main route, two routes, a pair showing on the other site), and the lurker takes a flank. A pushing defender may come forward.
- Hit: the attackers walk in to the hit site. Three or more defenders on the site fight it, and the rest keep walking in through mid and arrive at the rotation beat. Fewer than three fall off to the retake points, and the rest of the team plays the retake.
- Fights: before a kill, the fighters are moved to the pair of points within 30 units of each other that takes the least walking, so players already close barely move. Before the hit that can be anywhere on the map. From the hit on it is on the hit site, or on the mid and flanks leading to it.
- The lurker is the first Sentinel or Controller among the attackers, as a team usually sends one to flank. With neither, the last attacker lurks, so one attacker is always apart from the group.
- Post-plant: attackers stand on the site's post points round the spike. Defenders regroup (stacked in mid, or spread round the map), then come in to the retake points, on two points or all of them.
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
- In a planted round, at least two defenders hold the planted site at setup, and attackers reach its entry or lanes before the plant.
- At step 0, attackers are on their spawn and defenders are in their formation, with no spike.
- A player who is killed stays at the same point for the rest of the round.
- After a plant, living attackers stand on the planted site.
- The final frame's living/dead split and spike state match the round's end reason.
- Frames are a pure function of the round and step.
- Live playback moves through stages without input.
