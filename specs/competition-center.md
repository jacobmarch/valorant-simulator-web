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

Kickoff is not represented as a conventional championship tree. Its primary board has four life lanes, with opening-round byes shown separately:

- Opening-round byes: the four returning Champions teams, shown separately with their Upper Round 2 entry.
- Upper bracket: active teams with zero losses.
- Middle bracket: active teams with one loss.
- Lower bracket: active teams with two losses and no remaining safety net.
- Masters bound: teams that won one of the three qualification finals.

The page explains that a third loss eliminates a team. It also includes a full regional table and a matchday browser. Eliminated teams remain in the table so the user can understand the complete field.

## Regional split view

Stage 1 and Stage 2 each expose two explicit tabs:

1. League stage. The table shows all 12 regional organizations, their series and map records, and whether they sit in the top-six playoff line. The selected matchday browser shows only the regional league fixtures for the selected week.
2. Regional playoffs. The screen shows the six-team upper/lower double-elimination bracket and the selected week's playoff fixtures. The Grand Final is displayed separately as the title match.

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

Game state version 4 adds regional playoff scheduling and qualification metadata on top of the tournament stage, bracket path, and group metadata. When an older save is loaded, that broken event restarts at its opening week. Only fixtures and linked match results from that event are removed. Regional progress, roster state, and career state remain intact. An inbox message explains the restart.

## Acceptance criteria

- Event selection is chronological and understandable without knowing internal week numbers.
- Kickoff visibly communicates all three lives and all three qualification paths.
- A regional league table and the week's fixtures are visible together on desktop.
- Masters clearly distinguishes direct seeds, Swiss status, upper bracket, lower bracket, and grand final.
- Champions clearly distinguishes four groups and the playoff bracket.
- No raw round-number grid is used as the primary tournament visualization.
- The managed team is highlighted consistently in tables, lanes, groups, and matchup cards.
- Scheduled fixtures show opponent, event round, week, and best-of format.
- Completed fixtures show the winner and series score.
- Mobile layouts stack without hiding any competition data.
