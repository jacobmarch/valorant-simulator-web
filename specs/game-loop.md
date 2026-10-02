# Specification: Game Loop and Weekly Advance

## Purpose

Allow a user to start with any VCT organization and play the complete 2026 season week by week.

## Inputs

- Selected organization at game creation.
- Manager display name.
- Optional difficulty/configuration settings.
- Weekly commands: roster actions, training allocations, scouting allocations, match preparation, and approvals.

## Behavior

- Start date is 2026-01-01 (week 1 preseason). Kickoff starts in week 2. Incomplete rosters are allowed during preseason; AI teams sign free agents before their first match, and the manager must field five before playing Kickoff.
- Current organization may change through an accepted job offer.
- Advance Week is disabled when a required hands-on decision is unresolved.
- Advance resolves the current week exactly once, then persists the result.
- Other organizations' matches always resolve automatically.

## Acceptance criteria

- New Game offers every seeded VCT organization.
- A user can reach the end of the regional and international calendar.
- Refreshing after Advance Week does not duplicate matches, salary charges, prizes, or training.
- The dashboard clearly shows the next event and all blocking decisions.

## Season rollover

After week 52 the game moves to week 1 of the next season:

- Every player ages one year. Rating changes from age happen week by week through the development curve (see simulation model §5); players 28 and older also lose 1–2 potential.
- Every contracted player's remaining years drop by one. At the start of the offseason (week 44) the inbox lists the managed team's contracts in their final year.
- Players whose contracts reach zero leave for free agency. AI organizations re-sign their expiring starters. Any organization re-signs its best expiring players when it would otherwise drop below five. Renewals run 3 years at age 23 or younger, 2 years up to 29, and 1 year at 30 or older, at a 5% raise.
- Lineups are refilled to five legal starters after departures.
- Championship Points and season win/loss and map records reset to zero. Pending job offers lapse.
- Kickoff resets, with byes for the previous season's Champions qualifiers.

## Year in review

Before rollover resets anything, the finished season is condensed into a review (`src/season-review.ts`) that pops up once on the new season's first screen and stays reachable from Results → Year in review. Every review is kept (a few KB each), so it is the game's permanent record of past winners.

- **Your year:** series and map record, Championship Points, titles, and a placement in each event (bracket place, "Masters seed #N" for Kickoff, or the stage the team went out in).
- **MVPs:** every player's season line (maps, kills, deaths, assists, ACS, first kills) is tallied as each series is played, because pruning strips most box scores during the year. Impact per map = average ACS + 60 × (K/D capped at 2 − 1) + 15 × first kills per map. Players need at least a third of the busiest player's maps. Team MVP and key players rank on impact alone; the global and league MVPs add 1.5 × the team's Championship Points plus 10 for a Masters title and 25 for Champions.
- **Awards & winners:** global MVP, the Masters 1, Masters 2 and Champions winners with runners-up, and each league's Kickoff top seed, Stage 1 and Stage 2 winners.
- **League pages (one per region):** Kickoff seeds, Stage 1 and Stage 2 top four, the four Champions spots, the top six by Championship Points, and the league MVP.

The save only carries raw history the game still reads: the current season in full, and from the previous season just the managed team's series (for Results). Other teams' older series are dropped at rollover, because the whole save is cloned and written on every click; the reviews carry their results forward.
