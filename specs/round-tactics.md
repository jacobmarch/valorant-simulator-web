# Round Tactics on the Map

## Purpose

A watched round is played out on the minimap (see `round-stages.md`). The first version moved players through fixed stages, and the sim's events picked who fought whom. It did not look like a real round: attackers stood in mid and fought whoever happened to be there. This spec sets out the tactical layer that fixes that, the decisions behind it, and the plan for later work.

The layer is presentation only. It does not change the sim, its random draws, its results or its box scores. It decides where players stand around events the sim has already written.

## Why it was reworked

The first tactical pass (formations, scouting, a defence that answers the attack) fixed the worst of it, but rounds still read as copies. Every round was setup, scout, contact, post-plant. The formation and opening were picked from the map and round number alone, so round 7 on Haven was the same round in every match, and all the positions came from a handful of fixed point lists. The rework is aimed at that: more detailed movement and more interaction between the players, with rounds that do not repeat.

## What a round looks like now

A round is a **plan** (`roundPlan` in `src/round-plan.ts`) played out as a list of **beats**. The plan is a pure function of the map and the round, but it is seeded from what the round contains: who attacked and won, how many events there were, the round's end time, and the times of its first events. Two matches on the same map and round number therefore get different plans. Nothing draws from the sim's random stream, so results and box scores are unchanged.

**The plan chooses:**

| Choice | Options | Effect |
| --- | --- | --- |
| Attack plan | `default`, `rush`, `split`, `fake`, `slow` | Where the attack goes, and when it hits |
| Opening | `mid`, `a-main`, `b-main`, `c-main`, `default` | Where `default`, `fake` and `slow` start. `rush` and `split` open on the hit site's main route |
| Attack formation | `5-0`, `2-1-2`, `3-1-1` | Where the hit lands on the site |
| Defence formation | `4-1`, `2-1-2`, `3-2` | Who holds which site. On a three-site map every site always has a defender, so no site is left open |
| Push | yes or no | A defender comes forward for information and may fight early |
| Reads | yes or no | Defenders off the site rotate before the hit lands |
| Retake | `tight` or `wide` | Whether the defence retakes from two points or spreads over all of them |
| Lurker | flank side, and when it takes the lurk spot | Early or at the hit |
| Slot shuffle | one per side | Which player stands on which point, so the same player is not always on the same spot |

**The attack plans:**
- `default`: take map control from the opening (mid, a main route, or a spread), then hit.
- `rush`: skip map control and go straight at the hit site. It hits in the first seconds, so few kills fall before it.
- `split`: reach the site from two routes at once, entries on one and lanes on the other.
- `fake`: two attackers show on the other site during map control. They then come round onto the hit site's lanes. A defence that reads the fake rotates early and arrives in time. One that does not is caught on the wrong site and plays a retake.
- `slow`: take the whole map first, and hit late, so more kills fall in map control.

**The beats** (see `round-stages.md` for their steps):
1. **Setup.** Attackers spawn. Defenders take their formation.
2. **Opening.** The attack goes where its plan has it. A pushing defender may come forward.
3. **Map control**, for `default`, `fake` and `slow`. The attack takes control points. The lurker takes a flank, or the lurk spot if it lurks early.
4. **Kills in map control.** The sim's kills that fall before the plan's hit time (up to three) are fought wherever the two players already are, since nobody is forced to a fixed spot. The hit time depends on the plan, so a `rush` has almost none and a `slow` has several.
5. **Reads.** Defenders off the hit site rotate through mid, if the plan says they read the attack.
6. **Hit.** The attack commits to the site. Three or more defenders on it fight, and the rest rotate. Fewer fall off to the retake.
7. **Rotation.** After the first fight on the site, the defenders who were rotating arrive: on the site's holds if the defence held, or on its retake points if it fell off.
8. **Post-plant.** The attackers set up round the spike. The defence regroups, stacked in mid or spread round the map.
9. **Retake.** The defence pushes in to the retake points, on two of them or on all.

The round has several decision points, which is more than the "one or two" first asked for:
- **The attack picks a plan**, and with a `fake` or a main-route opening it picks a site it may not hit.
- **The defence reads or does not.** This changes whether a rotation arrives in time.
- **The defence answers the hit** by fighting or falling off.
- **The retake** is tight or wide.

Time is used, but only lightly. The sim writes a time for every event, and the plan uses the first events' times to set the seed and to decide how many kills fall before the hit. The beats themselves are not timed: the live timer holds each stage for a moment, and the stage view steps between them.

## Formations

Formations are picked per round from the map and round number, so the same round always lines up the same way.

**Defence** (`DEFENSE_FORMATIONS`): `4-1`, `2-1-2`, `3-2`.

| Formation | Main group (`main`) holds | Rest (`off`) | Effect |
| --- | --- | --- | --- |
| 4-1 | four hold the **other** site | one on the hit site's first hold | the attack reads four on one site and pivots to the other |
| 2-1-2 | two hold the **hit** site | one in mid, two on the other site | two on the site fall off to retake |
| 3-2 | three hold the **hit** site | two on the other site | three fight, and two rotate in |

**Attack** (`ATTACK_FORMATIONS`): `5-0`, `2-1-2`, `3-1-1`. These are the shapes of the four attackers who are not the lurker. They pick the points the attackers stage on (for the default opening) and the points they go in to on the hit site. A `rush` always goes in as a `5-0`, a `split` as a `2-1-2`, and a `fake` sends two to the lanes and two to the entries.

- `5-0`: entry, then lane.
- `2-1-2`: both lanes, then two on the entry.
- `3-1-1`: three on the entry, then one on the far lane.

The lurker is always separate. It is the first Sentinel or Controller, or the last attacker if neither.

## The hit site

The hit site is the site the spike went down on, which is the sim's result. On a round with no plant it alternates by round number, and that is the site every position is built around.

The formation then has to read consistently with that site. This is the main compromise in this layer. The sim does not yet choose sites from formations, so `defenseSetup` decides the setup to fit the site the sim chose. A 4-1 setup holds the other site so the attack appears to pivot, and 2-1-2 and 3-2 hold the hit site. This keeps the picture honest with the box score, but it is not a real decision. See "Plans" below.

## Movement and fights

The first version of the rework put each beat's players on fixed lists of points, and it showed. A team could be in mid, then be reset to a point near the other site, and kills moved players across the map right as the death icon showed. The movement model is now built around three rules.

**Nobody jumps.** Setup is the only place players are put anywhere. After that each beat gives a side *goals*, and a player only *walks*: to the named point, within a limit, that gets closest to their goal (40 units a beat, and 70 for the opening, which leaves the spawn). Goals are handed out so the group walks the least in total, which stops two players crossing over. A long trip, like a rotation from one site to the other, takes several beats and passes through mid. The `read`, `hit` and `rotate` beats are one rotation spread over time.

**Players keep their distance.** A player never walks to a point within 12 units of an enemy or 7 of a teammate, except the two players who are about to fight. So a team that walks up to an enemy stops short, and nobody stands beside an enemy for a whole beat without a fight.

**Lanes are blocked by enemies.** A walk is refused if it would pass within 9 units of a living enemy, so nobody walks through a lane an enemy is standing in, and a defender cannot appear behind attackers who hold both ends of a main. Fighters about to meet are the only exception. The map has no wall data, so this nearness check stands in for line of sight.

**A plant needs the site cleared.** At the post-plant beat any defender within 28 units of the spike is pushed off the site, by the nearest way out that does not cross an enemy. The attack never plants with a defender beside the spike.

**Players move first, then die.** Every kill has a fight step before it (`FIGHT_AT`, 0.9 into the step). On it the killer and victim are moved to the pair of points within `FIGHT_RANGE` (30 units) of each other that takes the least walking. If they are already in range they do not move. On the next step the victim is marked dead where they stand, so the death icon never appears before a move. Before the hit the fight can be anywhere on the map. From the hit on it is on the hit site, or on the mid and flanks leading to it.

The killer is always on the opposite side from the victim (the sim already guarantees this, and a test checks it).

## Named points

Everything above moves players only between the named points in `src/map-layouts.ts`. A player is never placed on a free coordinate, so the minimap always matches the layout. The test `every position is a named point` checks this for every round in the test fixture.

## Testing

`tests/round-stages.test.ts` covers the layer:

- Every position is a named point, at every step.
- A planted round is played on the planted site.
- After the rotation beat, more defenders are on the site than before.
- Every kill is between opposing sides. The fighters meet within range and both are alive on the fight step, and the victim dies where they stand. After the hit the fight is on the site, mid or the flanks.
- On three-site maps every site has at least one defender at setup. The spike goes down with the site cleared. A walk does not pass through an enemy in the lane.
- Nobody jumps: between beats a player only walks one step to a nearby point. Opposing players are never side by side unless they are about to fight.
- Every attack plan and every opening happens, a fake shows a pair on the other site, and the defence rotates onto the site.
- Rounds are not copies of each other: over the test fixture, nearly every round walks its own route, no one plan shape makes up more than 5% of rounds, and the same round number gets different plans in different matches.
- A dead player stays where they fell. Attackers stand on separate spots, and the lurker is chosen by role.

## How uniqueness is measured

The test `rounds are not copies of each other` builds a signature for every round: the positions of all ten players at every beat and event. Over the 8-seed fixture (every map, every round), more than 97% of the signatures are distinct, and no plan shape (attack plan, opening, formations, hit time, push, reads, retake and site) covers more than 5% of rounds. Before the rework, the shape was set by the map and the round number alone.

## Plans

These are not built yet. They are ordered by what they unlock.

1. **Sim chooses the site from formations.** The sim should pick the hit site from the attack's read of the defence, and then the defence's setup should follow from the sim's own decision, rather than the other way round. This removes the compromise above. It changes results, so it needs its own change and a review of the box scores.
2. **Map control that changes the plan.** Attackers take control, see the defence, and pick the site or the plan from what they see. At the moment the plan is fixed, and a fake only fools the defence's rotation, not the site. This needs decision 1 to be taken from the control phase.
3. **Defence decisions beyond fight or fall off.** Rotations that depend on what the defenders saw (a flank call, a late rotate, a hold on the site with a utility-led stand). Each adds a branch to decision 2.
4. **Utility.** Smokes, flashes and molly can change where players stand. Each one needs its own point and timing, and the sim has to record it first.
5. **Retake timing.** The retake beat comes straight after the plant, with a regroup first. A real retake waits on the clock. Beats could then be placed by event time, not only by order.
6. **Trades and assists.** A kill that trades a recent kill should be placed next to it, and assists should be placed beside the killer. The events already carry both.
7. **Walking routes.** Players now walk from named point to named point. A route that follows the map's corridors, rather than the straight-line closest point, would make the path read as the map's own.
8. **Live match simulation.** When the sim plays live matches, the same decision points should be driven by the sim's own state (money, alive count, site control) rather than the formations. The layer should then read the sim's decisions directly, not infer them.

## Adding a plan or a formation

1. Add the name to `ATTACK_PLANS`, `DEFENSE_FORMATIONS` or `ATTACK_FORMATIONS` (`src/round-plan.ts`).
2. For a plan, add it to `PLAN_POOL` (its weight) and `HIT_TIME` (when it hits), and give it a case in `openingPoints`, `controlPoints` and `hitPoints` in `src/round-stages.ts`. For a defence formation, add it to `defenseSetup`. For an attack formation, add it to `ATTACK_STAGING` and `ATTACK_HITS`. Each setup has five players, so the counts must add up.
3. Keep every point on a named layout point.
4. Extend the tests if the new plan or formation changes which points a player can stand on.
