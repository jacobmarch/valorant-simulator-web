# Specification: Game Loop and Weekly Advance

## Purpose

Allow a user to start with any VCT organization and play the complete 2026 season week by week.

## Inputs

- Selected organization at game creation.
- Manager display name.
- Optional difficulty/configuration settings.
- Weekly commands: roster actions, training allocations, scouting allocations, match preparation, and approvals.

## Behavior

- Start date is 2026-01-01.
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
