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
