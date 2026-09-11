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

## Acceptance criteria

- Invalid vetoes and lineups are blocked before simulation.
- A seeded simulation is repeatable.
- Every result has enough data for both a dense summary and broadcast-style match view.
- Timeout usage is not required in the MVP output.
