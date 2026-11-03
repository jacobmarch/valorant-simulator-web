# Specification: Training and Scouting

## Training

Each player has 40 hours per week distributed across Mechanics, Tactical Decision-Making, Utility, Consistency, Clutch, and Teamplay. Five hours in a skill is the weekly maintenance threshold. Below five hours creates bounded regression risk; above five hours increases improvement chance with diminishing returns. Ratings remain bounded from 1 to 100.

The result records prior rating, allocated hours, maintenance status, random outcome, new rating, and explanation. Training is individual only in the MVP.

## Scouting

Scouting covers tier 2 players on the ranked ladder, not the tier 1 rosters. The pool is split into five subregions: NA, SA, EMEA, Asia and China. NA and SA roll up to Americas, Asia to Pacific, and EMEA and China map to themselves.

- The weekly 40-hour pool is shared by regions and individual prospects.
- A region's prospects are hidden until hours are spent on it for a week. That week reveals the list.
- Region hours uncover every prospect in the region very slowly: 0.05 percentage points per hour.
- Once a region's list is known, hours on one prospect uncover that player quickly: 1 point per hour.
- Before a trial, a ladder player's overall shows as a range, never an exact number. The range is 18 points wide at 0% scouted and narrows to 4 points at 100%. It always contains the true overall.
- Scouting shows only general knowledge about skills: once a region is 25% scouted, each skill shows a broad tier (Elite 80+, Strong 70–79, Solid 60–69, Developing below 60). Exact skill numbers appear only after a trial.
- Each subregion keeps at least 24 ladder players, so there are dozens per region. The pool is refilled on load and at season rollover.
- Ladder players are not on the open market. Players who have trialled and then been let go return to the market as ordinary free agents.

## Trials

- A trial can be invited once a player is at least 25% scouted. It runs at once and reveals the exact ratings.
- When the roster has 5 or more players, a trial must take the place of a current player. The manager chooses who to bench. The benched player's status becomes inactive and their morale drops by 25. Every other starter loses 5 morale, since any of them could be benched.
- A benched player below 40 morale will not agree new terms. A trial that is let go restores the affected players' morale and the benched player's status.

## Pages

- The Roster page lists only current players, with their full ratings and contract detail.
- The Scouting page holds the regions, the trials, and the transfers panel. The transfers panel offers free agents and buyouts, roster history and transfer rules.
- The weekly limit is 2 trials in season (weeks 2–42) and 4 in the off-season and preseason (weeks 43–52 and 1). The count resets each week.
- After a trial, the manager either offers a contract or lets the player go. A contract is signed at the player's asking salary for 1–3 years (veterans 30+ take only one; players 23 and under take up to three). It follows the normal transfer window rules and buys the player into the roster, subject to roster size and the debt limit.
- A trialled player who is let go leaves the pool and enters the open market.

## Acceptance criteria

- Training allocation totals cannot exceed 40 hours per player.
- Scouting allocation cannot exceed the scout's available weekly hours.
- Maintenance and growth behavior is visible and deterministic under a fixed seed.
- Scouting never reveals a rating with more confidence than configured progress allows.
- Ladder players cannot be signed from the open market; a contract requires a completed trial.
- Trial invitations never exceed the weekly limit for the current phase.
