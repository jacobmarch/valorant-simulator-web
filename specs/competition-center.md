# Specification: Competition Center

## Purpose

The Competition Center is the single place to understand where the current season stands, who plays next, how qualification works, and how a team moves through an event. It renders persisted fixtures from the simulation; it does not construct display-only opponents or results.

## Global navigation

The screen begins with a chronological six-event rail: Kickoff, Masters 1, Stage 1, Masters 2, Stage 2, and Champions. Every event shows its sequence number, host/location, and Complete, In progress, or Upcoming state. Selecting an event never changes simulation time.

Regional events expose an Americas, EMEA, Pacific, and China selector. International events do not show a region selector.

The event header always identifies:

- Event name and host/location.
- Regional or global scope.
- Scheduled week range and calendar dates.
- Tournament format.
- Qualification or championship stakes.

## Kickoff view

Kickoff is presented as a true three-path bracket rather than a standings grid or a set of life-status boxes. The opening-round byes are listed above the bracket, and every persisted fixture appears in its named round column.

- Upper path: Upper Round 1 through Upper Final. Its winner qualifies undefeated.
- Middle path: Middle Round 1 through Middle Final. Its winner qualifies with one loss.
- Lower path: Lower Round 1 through Lower Final. Every match is elimination and its winner takes the third qualification place.

Columns progress from left to right. Connector lines originate at the edge of source match cards, merge between paired feeder matches where two winners produce one downstream match, and terminate at the receiving match card. Empty downstream columns remain visible as placeholders so the user can understand the complete event structure before those matchups are known. Completed cards show scores and open their full match report when selected.

The Middle Round 1 header explicitly identifies its feeder rule: each of the four Upper Round 1 losers plays one of the four Upper Round 2 losers. The UI must never render a post-opening bye. Upper, middle, and lower lanes use distinct connector colors and short source labels so cross-lane drops remain understandable without tracing an unlabeled grid.

The page explains that a third loss eliminates a team. It also includes a full regional table and a matchday browser. Eliminated teams remain in the table so the user can understand the complete field.

## Tournament progression controls

When the calendar is currently inside Kickoff, a regional playoff, Masters, or Champions, the global calendar action reads **Advance round**. League-stage weeks continue to read **Advance week**.

The current event also exposes two explicit actions:

- **Play next match:** resolves exactly one scheduled fixture in the selected event and, for regional events, the selected region. It does not advance the week or apply weekly training, scouting, or financial updates.
- **Simulate round:** resolves every remaining fixture in the current calendar round, applies the normal weekly transaction once, builds the next round, advances the calendar, and leaves the user on the Competition Center.

The control shows the next named round and the number of unresolved matches in the selected view. Browsing a completed or future event never exposes controls that would mutate the current competition.

## Regional split view

Stage 1 and Stage 2 each expose two explicit tabs:

1. League stage. The table shows all 12 regional organizations, their series and map records, and whether they sit in the top-eight playoff line. The selected matchday browser shows only the regional league fixtures for the selected week.
2. Regional playoffs. The screen shows the eight-team upper/lower double-elimination bracket and the selected week's playoff fixtures. The Grand Final is displayed separately as the title match.

Stage 1 runs weeks 12–18, with league play in weeks 12–15 and playoffs in weeks 16–18. The top three playoff finishers are labeled as Masters 2 qualifiers. Stage 2 runs weeks 24–34, with league play in weeks 24–31 and playoffs in weeks 32–34. The top four playoff finishers are labeled as Champions qualifiers. The user's organization is visually marked in both the table and bracket.

## Masters view

Masters has two explicit tabs:

1. Swiss stage.
2. Playoff bracket.

The Swiss view separates the four regional champions who advance directly to playoffs from the eight Swiss participants. Swiss rows show team, territory, record, and Advanced, Eliminated, or In play status. Two wins advance and two losses eliminate.

The playoff view contains an Upper bracket lane, a Lower bracket lane, and a separate Grand final panel. Each lane is organized by named competitive round, not by raw numeric round. Empty downstream rounds say that teams are awaiting previous results.

## Champions view

Champions has two explicit tabs:

1. Group stage.
2. Playoff bracket.

The group view shows Groups A through D independently. Each group contains four teams and five fixtures. Records are calculated from that group's fixtures only. The top two survivors feed the eight-team playoff.

The playoff uses the same upper-path, elimination-path, and grand-final presentation as Masters.

## Fixture requirements

Every international Fixture stores stage and bracket metadata. Champions group fixtures also store a group ID. The UI derives all participants, records, scores, and status from these fixtures and their linked MatchResult.

Masters must contain:

- Eight Swiss participants and ten Swiss matches.
- Four direct playoff seeds.
- A 14-match double-elimination playoff.
- Best-of-five lower and grand finals.

Champions must contain:

- Four groups of four.
- Five fixtures per group.
- Two qualifiers per group.
- A 14-match double-elimination playoff.
- Best-of-five lower and grand finals.

## Save migration

Game state version 8 adds the corrected Kickoff feeder graph with four Middle Round 1 matches and no post-opening byes. A version 7 save still inside Kickoff restarts that event at week one. Only current-season Kickoff fixtures and linked match results are removed; roster and career state remain intact. An inbox message explains the restart. Earlier migrations continue to add tournament stage, bracket path, regional playoff, and qualification metadata.

## Acceptance criteria

- Event selection is chronological and understandable without knowing internal week numbers.
- Kickoff visibly communicates all three lives and all three qualification paths.
- A regional league table and the week's fixtures are visible together on desktop.
- Masters clearly distinguishes direct seeds, Swiss status, upper bracket, lower bracket, and grand final.
- Champions clearly distinguishes four groups and the playoff bracket.
- No raw round-number grid is used as the primary tournament visualization.
- Kickoff is rendered as connected upper, middle, and lower round columns, with downstream placeholders.
- Middle Round 1 displays four matches made from all four Upper Round 1 losers and all four Upper Round 2 losers.
- Connector lines visibly meet both their source cards and their next-round destination; paired feeders visibly merge.
- The user can resolve one visible tournament match without moving time or simulate the entire remaining round.
- Tournament advancement keeps the Competition Center open and changes the global action label to Advance round.
- The managed team is highlighted consistently in tables, lanes, groups, and matchup cards.
- Scheduled fixtures show opponent, event round, week, and best-of format.
- Completed fixtures show the winner and series score.
- Mobile layouts stack without hiding any competition data.
