# Debt and firing

## Purpose
A managed club with no cash could not sign or buy out anyone, even while its roster sat under the limit. Clubs may now borrow, and the board fires the manager once the debt passes a fixed limit.

## Inputs
- `DEBT_LIMIT` in `src/debt.ts`: $500,000. Starting cash is $1.0M–$1.55M and a typical payroll is about $1M a year, so half a starting balance is a real runway.
- `FIRED_TEAM_OPTIONS` in `src/debt.ts`: 4 clubs offered after a firing.

## State changes
- Team `cash` may go negative for the managed club only.
- `GameState.fired` is set when the managed club's cash is below `-DEBT_LIMIT` at week end. It holds the season, week, lost club id, the balance at firing, and the offered club ids.
- Firing sets the old club's cash to 0 (the board settles its books) and adds an inbox entry.
- Taking an offer sets `currentTeamId` to the chosen club, clears `fired`, reassigns its roles, and refills the old club's roster to the minimum. The save, its history, fixtures and season are kept.

## Validation
- A signing or buyout by the managed club is refused only when the balance after paying would be below `-DEBT_LIMIT`.
- Other organizations still need the cash on hand.
- Time-advancing actions (advance week, sim round, sim match) do nothing while `fired` is set.
- An offer can only be taken if its club is in `fired.options`.

## User-visible output
- Top bar shows a negative balance in the negative color.
- Finances shows the debt and the firing threshold.
- The transfer rules text explains the debt allowance.
- After a firing the app shows the Fired screen: the balance at firing, the debt limit, and four clubs replacing their coaches, weakest first, each with a Take the job button.

## Edge cases
- A balance exactly at `-DEBT_LIMIT` is not fired; the first week that passes it fires the manager.
- Weekly salaries can push a club over the limit during a week, so the firing check runs at week end, after the calendar moves on.
- Options are fixed when the firing happens, so the list does not change on reload.

## Acceptance criteria
- A managed club with zero cash and an open roster slot can sign a free agent and sees a negative balance.
- A signing that would breach the limit is refused with a message that names the limit.
- Crossing the limit at week end shows the Fired screen and blocks further time advancement.
- Taking an offer resumes play at the same week and season with the new club managed.
