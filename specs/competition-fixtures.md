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
2. Week 2 schedules four Upper Round 2 matches, pairing each bye team with exactly one Upper Round 1 winner. No middle- or lower-path match is scheduled yet.
3. Week 3 schedules two Upper Round 3 matches from the Upper Round 2 winners and four Middle Round 1 matches. Each Middle Round 1 match pairs one Upper Round 1 loser with one Upper Round 2 loser.
4. Week 4 schedules the Upper Final, two Middle Round 2 matches from the Middle Round 1 winners, and two Lower Round 1 matches from the Middle Round 1 losers. The Upper Final winner is the first qualifier.
5. Week 5 schedules two Middle Round 3 matches, pairing the Upper Round 3 losers with the Middle Round 2 winners, and two Lower Round 2 matches, pairing the Middle Round 2 losers with the Lower Round 1 winners.
6. Week 6 begins with Middle Round 4 and two Lower Round 3 matches. The remaining closing rounds resolve in dependency order: Lower Round 4; Middle Final and Lower Round 5; then Lower Final.
7. The Middle Final pairs the Upper Final loser with the Middle Round 4 winner. Lower Round 5 pairs the Middle Round 4 loser with the Lower Round 4 winner. The Lower Final pairs the Middle Final loser with the Lower Round 5 winner.
8. Only the Upper Final, Middle Final, and Lower Final are best-of-five. Every other Kickoff fixture is best-of-three, including Lower Rounds 4 and 5.
9. A series loss removes one life, and the third loss immediately eliminates the team. Teams stop receiving fixtures once eliminated; no round uses record-based or Swiss pairing.
10. The three path winners are marked qualified for Masters 1. Every other team must have three losses and be eliminated.
11. The only byes are the four opening byes. Every generated fixture has two real participants, and a team that has entered the bracket never skips a later round.

The competition screen must show regional Kickoff standings; wins, losses, and three visible life indicators; active, eliminated, or qualified state; all fixtures grouped by round; and the selected week's matchup list.

## Regional split play and qualification

Each territory has one 12-team league table in each split. The split schedule is deliberately divided into league play and a persisted playoff event:

- Stage 1 group play runs in weeks 11–15: two groups of six per region, drawn one team per Kickoff seeding tier (1–2, 3–4, …) at random, single round robin. The top four of each group enter the Stage 1 regional playoffs in weeks 16–18: group winners take the upper semifinal byes, 2nd and 3rd meet cross-group in the quarterfinals, and 4th start in the lower bracket.
- Stage 2 group play runs in weeks 24–28, drawn the same way from the Stage 1 playoff finish. The top four of each group enter the Stage 2 regional playoffs in weeks 29–31.
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
- Each region creates 12 Stage 2 playoff fixtures, all completed by week 32, and exactly four Stage 2 qualifiers.
- Masters 2 contains only the Stage 1 playoff qualifiers, and Champions contains only the Stage 2 playoff qualifiers.
- Every eliminated Kickoff team has three losses.
- Every region creates exactly 30 Kickoff fixtures: 11 upper, 10 middle, and 9 lower. None is a bye fixture.
- International fixtures never pair two teams from the same territory.
- Advancing into a second season creates a new Kickoff schedule without deleting match history.
