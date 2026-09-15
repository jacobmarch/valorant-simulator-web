# Specification: Competition Fixtures and Brackets

## Purpose

Use one persisted competition model for the dashboard, weekly simulation, standings, and bracket views. The UI must never invent a generic opponent independently of the simulation.

## Fixture contract

Every scheduled match is stored as a Fixture with season, week, competition phase, scope, round, display label, both team IDs, best-of length, and status. A completed fixture also stores its winner and match-result ID.

- nextFixtureForTeam is the source for the dashboard and match-preparation opponent.
- fixturesForWeek is the source for weekly simulation and matchup lists.
- The competition board groups the same fixtures by round.
- Background teams use the same fixtures and match engine as the managed team.
- Fixtures and results carry a season identifier so a new season cannot reuse the prior season's schedule.
- Older browser saves migrate in place; in-progress Kickoff saves are restarted at week one so they receive the fixed bracket, while completed event history is retained.

## Kickoff triple elimination

Each territory begins with 12 teams and three lives. The four teams that reached the prior season's Champions receive an opening-round bye. The initial 2026 season uses the seeded prior-Champions list in seed.ts; later seasons carry forward the four Stage 2 Champions qualifiers from the completed prior season.

1. Week 1 schedules four matches between the other eight teams. The four returning Champions teams are not assigned a fixture.
2. Week 2 schedules four Upper Round 2 matches pairing each bye team with a week-one winner, plus two Middle Round 1 matches for the week-one losers.
3. Week 3 schedules Upper Round 3 from the Upper Round 2 winners, Middle Round 2 from the Middle Round 1 winners plus Upper Round 2 losers, and Lower Round 1 from the Middle Round 1 losers.
4. Week 4 schedules the Upper Final, Middle Round 3, and Lower Round 2 from those completed results. The Upper Final winner is the first qualifier.
5. Week 5 schedules Middle Round 4 and Lower Round 3 from their fixed predecessor slots.
6. Week 6 schedules the Middle Final as a BO5 and Lower Round 4 as a BO3. The Middle Final winner is the second qualifier.
7. Lower Round 5 is a BO3 when needed to reduce the remaining lower path to two teams. The Lower Final is then a BO5, and its winner is the third qualifier.
8. Only the Upper Final, Middle Final, and Lower Final are best-of-five. Every other Kickoff fixture is best-of-three, including Lower Rounds 4 and 5.
9. A series loss removes one life, and the third loss immediately eliminates the team. Teams stop receiving fixtures once eliminated; no round uses record-based or Swiss pairing.
10. The three path winners are marked qualified for Masters 1. Every other team must have three losses and be eliminated.

The competition screen must show regional Kickoff standings; wins, losses, and three visible life indicators; active, eliminated, or qualified state; all fixtures grouped by round; and the selected week's matchup list.

## Regional split play and qualification

Each territory has one 12-team league table in each split. The split schedule is deliberately divided into league play and a persisted playoff event:

- Stage 1 league play runs in weeks 12–15. The top eight teams by the league table enter the Stage 1 regional playoffs in weeks 16–18.
- Stage 2 league play runs in weeks 24–31. The top eight teams enter the Stage 2 regional playoffs in weeks 32–34.
- Each regional playoff is an eight-team double-elimination bracket. Seeds 1 and 2 enter the upper semifinals; seeds 3–6 play the upper quarterfinals, while seeds 7–8 start in Lower Round 1 against the Upper Quarterfinal losers.
- The bracket contains Upper Quarterfinal, Upper Semifinal, Lower Round 1, Upper Final, Lower Round 2, Lower Round 3, Lower Final, and Grand Final fixtures.
- Stage 1 playoff finishers 1–3 qualify for Masters 2. Stage 2 playoff finishers 1–4 qualify for Champions.
- Regional playoff fixtures are simulated by the same round-by-round match engine as league fixtures. Downstream fixtures are created only after their prerequisite results exist.
- Masters 2 uses the three Stage 1 qualifiers from each territory. Champions uses the four Stage 2 qualifiers from each territory. If a qualifying bracket is not complete, the league table is used only as a temporary projected seed.

Regular series are best-of-three. Regional Lower Final and Grand Final fixtures are best-of-five.

## Acceptance criteria

- A non-bye opening team has a concrete opponent on the week-one dashboard; a returning Champions team clearly shows its opening-round bye and next scheduled Upper Round 2 match.
- The dashboard opponent, tactics opponent, simulated opponent, and fixture board are identical.
- Each territory produces exactly three Kickoff qualifiers.
- Each region creates 12 Stage 1 playoff fixtures, all completed by week 19, and exactly three Stage 1 qualifiers.
- Each region creates 12 Stage 2 playoff fixtures, all completed by week 35, and exactly four Stage 2 qualifiers.
- Masters 2 contains only the Stage 1 playoff qualifiers, and Champions contains only the Stage 2 playoff qualifiers.
- Every eliminated Kickoff team has three losses.
- International fixtures never pair two teams from the same territory.
- Advancing into a second season creates a new Kickoff schedule without deleting match history.
