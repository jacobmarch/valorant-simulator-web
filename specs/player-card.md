# Specification: Player Card

## Purpose

Give the manager one overview of a player: ratings, potential, contract, and career history. Logic lives in `src/player-card.ts` and the season log is written in `src/season-review.ts`. The view is `src/player-card-view.tsx`.

## Rules

- A player's card opens as a pop-up from their name on the Roster page, in the depth chart and in the Available talent list.
- The card shows overall, potential, contract (salary per year and years left, plus any pending re-signing), career ACS, all six ratings on a 1–100 scale, clubs, contracts, titles and awards, and recent transfers.
- Ratings and potential are readable for the managed club's players. Other players need scouting progress of at least 60%; below that, the card shows `??` and the scouting percentage.
- Career history is written once per season at rollover (`closeSeasonReview`), before ages and contracts move on. Each rostered player (or player with a season line) gets one entry with club, salary, years left, overall, potential, maps, ACS, K/D, titles and awards.
- A title is an event whose winner was the player's club at rollover: Masters, Champions, and each regional Stage playoff. Kickoff does not count.
- Awards come from the season review: Global MVP, Team MVP, and each region's MVP.
- Only the last 10 seasons are kept per player.
- Clubs are runs of consecutive seasons at one club. Contracts are runs of consecutive seasons at one club and salary; the current contract is marked.
- Recent moves come from the transfer log (signings, buyouts, releases, renewals, expiries, retirements), which keeps two seasons.

## Edge cases

- A new save shows empty career sections until the first season closes. The clubs section still shows the current club.
- Free agents with no career entries show "No seasons completed" and "Not on a club yet".
- Saves from before the career log existed load unchanged; the field is optional.

## Acceptance criteria

- Clicking a player's name on the Roster page opens the card; Escape or the close button dismisses it.
- The card fits a phone-width screen without horizontal scrolling.
- Unscouted rival players show `??` for ratings and potential.
- After a season closes, each rostered player has a career entry with their club and contract.
