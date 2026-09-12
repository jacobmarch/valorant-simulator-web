# Specification: Match Preparation and Simulation

## Purpose

Provide strategic pre-match decisions followed by a detailed but non-interactive simulation.

## Pre-match inputs

- Legal starting lineup.
- Map veto/pick-ban choices in the configured order.
- Attack style.
- Defense style.

## Simulation rules

- Regular match is Bo3; configured finals are Bo5.
- Simulate rounds internally, including economy, side, player contribution, map modifiers, role fit, and seeded randomness.
- Overtime is win-by-two with side switches every round.
- Enforce a safety cap and deterministic fallback to avoid infinite overtime.

## Output

- Series and map winners/scores.
- Round timeline.
- Player kills, deaths, assists, ACS, ADR, KAST, first kills, first deaths, clutches, plants, defuses, and headshot percentage.
- Team economy.
- Highlights: aces, multikills, clutches, comeback rounds, and 1vX events.
- Match impact on standings, form, finances, qualification, and history.
- The match center must provide an entire-series tab and one tab per map. Series values aggregate kills, deaths, assists, first kills, first deaths, clutches, plants, defuses, and headshots; ACS, ADR, and KAST use a clearly documented series aggregation method.

## Statistical guardrails

- Kills and deaths are generated from shared map-round volume and team outcome; every player must not trend positive by default.
- First kills and first deaths are separate bounded values; zeroes are expected.
- ACS normally remains below 300, 300+ is rare, and the hard ceiling is 360.
- Map and series tables must show FK/FD separately so impossible positive first-kill lines are visible and testable.

## Acceptance criteria

- Invalid vetoes and lineups are blocked before simulation.
- A seeded simulation is repeatable.
- Every result has enough data for both a dense summary and broadcast-style match view.
- Map and series tabs show different, internally consistent stat scopes.
- A deterministic fixture contains both positive and negative K/D examples and at least one zero first-death value.
- Timeout usage is not required in the MVP output.

## Round-event invariants

- Simulate casualties first, then derive the box score from those events.
- A kill and an opposing death are the same event; map-wide kill and death totals must be equal.
- Every round has one opening duel, so map-wide first kills, first deaths, and rounds played must be equal.
- Each player may die at most once per round.
- A losing team has four casualties in a save and five otherwise; saves are intentionally uncommon.
- ACS and ADR are computed from event volume per round. A 300+ ACS map is an outlier, not a baseline.
- Close maps of at least 23 rounds must produce materially higher death totals than short blowouts.
- Overtime begins at 12-12, switches sides every round, and ends only with a two-round lead.
