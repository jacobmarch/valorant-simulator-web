# Round Tactics on the Map

## Purpose

A watched round is played out on the minimap (see `round-stages.md`). The first version moved players through fixed stages, and the sim's events picked who fought whom. It did not look like a real round: attackers stood in mid and fought whoever happened to be there. This spec sets out the tactical layer that fixes that, the decisions behind it, and the plan for later work.

The layer is presentation only. It does not change the sim, its random draws, its results or its box scores. It decides where players stand around events the sim has already written.

## What a round looks like now

1. **Setup** (step 0). Attackers spawn. Defenders take a formation (below).
2. **Scouting** (step 0.5). The attack opens one of four ways, picked per round (`ATTACK_OPENINGS`):
   - `mid`: the attackers stand together in the middle of the map.
   - `a-main` / `b-main` / `c-main`: the attackers start on the main route to site A, B or C, at that site's entry. They have not committed, so they can still pivot onto another site at contact. `c-main` only exists on maps with a third site (Haven and Lotus).
   - `default`: the attackers spread out as their attack formation has them, and the lurker reads a flank.

   Defenders do not move. They have not seen the attack yet.
3. **Contact** (step 1). Two decisions, in this order:
   - **Decision 1, the attack commits.** Attackers go in to the hit site's entry and lanes in their formation. The lurker takes the site's lurk spot.
   - **Decision 2, the defence answers.** If three or more defenders are on the hit site's holds, they fight, and the rest of the defence rotates in to the free holds. If fewer than three are there, they fall off to the site's retake points, and the rest of the team plays the retake later.
4. **Post-plant**, when the spike goes down. Attackers stand round the spike and defenders come to the retake points. This is unchanged.

The round has two decision points before the plant, which is the minimum asked for:
- **The attack picks its site** at contact, after the opening. The pick is fixed by the sim's site (see "The hit site" below), so the opening only changes where the attackers wait. An `a-main` or `b-main` opening that lands on the other site is a visible pivot.
- **The defence answers** the attack's commit.

## Openings

Each opening is chosen per round from the map and round number, so the same round always opens the same way. On two-site maps the four openings are equally likely. On three-site maps the pool adds `c-main`, so each opening is one in five.

- `mid` stacks the attackers in the middle of the map, so the attack has no visible plan until it commits.
- `a-main`, `b-main` and `c-main` put the attackers at the entry of that site. The pivot is visible when the hit site is another one.
- `default` spreads them out, as their attack formation has them.

Checked in the browser on Haven. Site letters on Haven put B in the middle, with A at the bottom and C at the top. On round 2, a `b-main` opening scouts from B's entry and hits B, with no pivot. On round 3, a `c-main` opening scouts from C's entry at the top, then pivots down to A at the bottom at contact. That round had no plant, so the hit site alternated to A.

## Formations

Formations are picked per round from the map and round number, so the same round always lines up the same way.

**Defence** (`DEFENSE_FORMATIONS`): `4-1`, `2-1-2`, `3-2`.

| Formation | Main group (`main`) holds | Rest (`off`) | Effect |
| --- | --- | --- | --- |
| 4-1 | four hold the **other** site | one on the hit site's first hold | the attack reads four on one site and pivots to the other |
| 2-1-2 | two hold the **hit** site | one in mid, two on the other site | two on the site fall off to retake |
| 3-2 | three hold the **hit** site | two on the other site | three fight, and two rotate in |

**Attack** (`ATTACK_FORMATIONS`): `5-0`, `2-1-2`, `3-1-1`. These are the shapes of the four attackers who are not the lurker. They pick the staging points in mid (scouting) and the points they go in to on the hit site.

- `5-0`: entry, then lane.
- `2-1-2`: both lanes, then two on the entry.
- `3-1-1`: three on the entry, then one on the far lane.

The lurker is always separate. It is the first Sentinel or Controller, or the last attacker if neither.

## The hit site

The hit site is the site the spike went down on, which is the sim's result. On a round with no plant it alternates by round number, and that is the site every position is built around.

The formation then has to read consistently with that site. This is the main compromise in this layer. The sim does not yet choose sites from formations, so `defenseSetup` decides the setup to fit the site the sim chose. A 4-1 setup holds the other site so the attack appears to pivot, and 2-1-2 and 3-2 hold the hit site. This keeps the picture honest with the box score, but it is not a real decision. See "Plans" below.

## Kills

The sim decides who kills whom. The layer makes sure every kill reads as a fight on the hit site:

- Both players are moved onto a spot their side holds on the hit site, if they are not already on one. The victim settles first, then the killer.
- A killer more than `FIGHT_RANGE` (30 units) from the victim moves to the nearest free spot on the site. Free means no other living player is on it.
- The killer is always on the opposite side from the victim (the sim already guarantees this, and a test checks it).

`FIGHT_RANGE` is about a site's width. A holder and an entry attacker on the same site can be that far apart, so a tighter range would move players around needlessly.

## Named points

Everything above moves players only between the named points in `src/map-layouts.ts`. A player is never placed on a free coordinate, so the minimap always matches the layout. The test `every position is a named point` checks this for every round in the test fixture.

## Testing

`tests/round-stages.test.ts` covers the layer:

- Every position is a named point.
- A planted round is played on the planted site.
- After contact, attackers stand on the hit site, and defenders stand on the hit site's holds or retake points, on the other site's holds (a pivot), or in mid (2-1-2).
- Every kill is between opposing sides, and both players stand on the hit site.
- A dead player stays where they fell.
- Attackers stand on separate spots, and the lurker is chosen by role.

## Plans

These are not built yet. They are ordered by what they unlock.

1. **Sim chooses the site from formations.** The sim should pick the hit site from the attack's read of the defence, and then the defence's setup should follow from the sim's own decision, rather than the other way round. This removes the compromise above. It changes results, so it needs its own change and a review of the box scores.
2. **Scouting that changes the plan.** Attackers scout a site first, see the formation, and pick the site or the formation based on what they see. This needs decision 1 to be taken from the scout, not fixed.
3. **Defence decisions beyond fight or fall off.** Rotations that depend on what the defenders saw (a flank call, a late rotate, a hold on the site with a utility-led stand). Each adds a branch to decision 2.
4. **Utility.** Smokes, flashes and molly can change where players stand. Each one needs its own point and timing, and the sim has to record it first.
5. **Retake timing.** The retake now starts at the plant. A real retake waits for the defence to see the spike and leaves a gap for the attack to hold. That needs a delay stage after the plant, and the defence's rotation to start from its position at the plant rather than from setup.
6. **Live match simulation.** When the sim plays live matches, the same decision points should be driven by the sim's own state (money, alive count, site control) rather than the formations. The layer should then read the sim's decisions directly, not infer them.

## Adding a formation

1. Add the name to `DEFENSE_FORMATIONS` or `ATTACK_FORMATIONS`.
2. Add its setup to `defenseSetup` (defence) or its staging and hit points to `ATTACK_STAGING` and `ATTACK_HITS` (attack). Each setup has five players, so the counts must add up.
3. Keep every point on a named layout point.
4. Extend the tests if the new formation changes which points a player can stand on.
