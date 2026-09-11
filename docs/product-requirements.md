# Product Requirements: Valorant Manager Simulator

## 1. Vision

The player is the manager of a professional Valorant organization. They build and rebuild a roster, make contract decisions, prepare map vetoes and broad tactical styles, develop players, scout replacements, navigate a real-world VCT calendar, and try to win regional leagues and international events.

The experience should feel like a focused browser version of Football Manager: meaningful roster decisions, a clear calendar, strong statistical feedback, and a satisfying cycle of preparation, competition, consequence, and rebuilding. Depth is configurable so a player can delegate secondary work without losing the core management game.

## 2. Audience and constraints

- Single player only; no multiplayer, PvP, chat, or shared league state.
- Browser-first and deployable as a simple web application.
- MVP may run entirely locally in the browser.
- Supabase is the target for future authentication and cloud persistence.
- Real teams and players are used for private/personal play. The data layer must still be structured so the seed can be updated or replaced.
- The first playable season is always 2026 and begins on 2026-01-01.

## 3. Core gameplay loop

1. Review dashboard, inbox, schedule, standings, roster health, finances, and pending decisions.
2. Manage the current week: roster transactions, contract actions, training assignments, scouting assignments, and tactical preparation.
3. Advance one week.
4. Resolve scheduled matches and non-match events. Matches involving other organizations simulate automatically.
5. Review the match center: series result, map scores, round results, player statistics, economy, and highlights.
6. Respond to consequences: form changes, rating movement, contract events, qualification changes, and job activity.
7. Repeat through regional competition, Masters qualification, Masters events, later regional stages, and Champions.
8. At season end, resolve awards, job offers, roster windows, and the next season. The MVP can continue the cycle using the same 2026 ruleset and static universe.

## 4. Finished-product feature areas

Every area is a player capability and may eventually be delegated:

- Roster construction and depth-chart management.
- Contracts, salaries, buyouts, renewals, releases, and transfer windows.
- Individual training and player development.
- Scouting and gradual information discovery.
- Map vetoes, lineups, compositions, map plans, attack style, defense style, and later timeout/between-map adjustments.
- Regional leagues, qualification, Masters 1, Masters 2, and Champions.
- Simple-to-detailed finances: cash, salaries, prize money, sponsorships, costs, and board expectations.
- Staff, analysts, coaches, performance staff, and facilities.
- Player personalities, relationships, morale, confidence, fatigue, and cohesion.
- Manager job offers, reputation, fired managers, retirements, and unemployed starts.
- Historical records, awards, statistics, news, and career history.

## 5. MVP scope

### Included

- 2026 VCT regional leagues and international events, using the official 48-team/four-territory structure and configured event dates.
- Every VCT organization and its 2026 opening roster, including substitutes and inactive players.
- Static player/team data with visible skill ratings, role data, contract data, and Tier 2 placeholder affiliations for eligible non-VCT targets.
- Any-team start.
- Weekly calendar beginning January 1, 2026.
- Automatic simulation of all non-player matches.
- Roster actions: sign free agents, buy contracted players, release, bench, activate, and assign starters/substitutes.
- Configurable transfer windows and roster validation.
- Simple annual salary contracts, remaining-term buyouts, cash, salary commitments, prize money, and a minimal budget.
- Individual training with 40 hours per player per week.
- Gradual scouting assignment with scout hours.
- Match preparation with map veto/pick-ban, starting lineup, attack style, and defense style.
- Hidden round simulation and post-match statistics/highlights.
- Regional standings, Championship Points, brackets, qualification, Masters 1, Masters 2, Champions, and tournament host cities.
- Player/team dashboard, calendar/inbox, roster, training, tactics, match center, standings, tournament, transfers/contracts, scouting, and finances views.
- One automatic local browser save plus New Game and Reset Save.
- Basic automation settings and three delegation modes.

### Excluded from MVP or intentionally simplified

- No Tier 2 league simulation; Tier 2 may appear only as a low-detail affiliation for scouting targets.
- No manager attributes.
- No player potential system.
- No player personalities, relationships, morale simulation, or team cohesion simulation.
- No staff or facilities.
- No detailed sponsorship system.
- No complex contract negotiation, clauses, bonuses, agent interactions, or multi-party deals.
- No live/round-by-round interactive match control.
- No timeout decisions or strategy changes during/between maps.
- No dynamic agent buffs/nerfs or patch history.
- No unemployed start.

## 6. UX and presentation

The application has two complementary modes:

- **Manager dashboard:** information-dense, actionable, and persistent. It surfaces what needs attention before the user advances the week.
- **Match view:** simpler and broadcast-inspired. It emphasizes series identity, teams, map progression, scores, player lines, round timeline, and memorable events.

The UI must always expose the current date/week, organization, cash, upcoming event, pending decisions, and a clear Advance Week action. Destructive roster actions require confirmation. Invalid rosters and invalid map vetoes must be explained before submission.

## 7. Configuration principles

Automation is configured per area. Each major area has one of:

- **Hands-on:** user handles normal actions and must approve major actions.
- **Balanced:** AI handles routine work and proposes major actions for approval.
- **Hands-off:** AI handles the area automatically.

Secondary immersion systems may also be disabled. A disabled system does not create hidden obligations, penalties, or required screens. The core competition, match, roster legality, and qualification systems cannot be disabled.

## 8. MVP acceptance criteria

An MVP is complete when a user can choose any seeded VCT organization, play weekly from January 1 through the full 2026 regional and international calendar, make legal roster changes, assign training and scouting, prepare and simulate matches, view complete results and statistics, qualify for and play Masters/Champions, receive prize money, switch organizations through a job offer, and resume from the automatic browser save.
