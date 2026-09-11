# Atomic Feature Specifications

Each file describes one feature contract. Implementers should read the relevant file before changing code and update it when behavior changes.

- `game-loop.md` — new game, weekly progression, event ordering, and dashboard.
- `roster-contracts.md` — roster state, legality, transfer windows, contracts, salaries, and buyouts.
- `competition.md` — VCT calendar, standings, qualification, brackets, events, and host cities.
- `match-simulation.md` — preparation, simulation, overtime, statistics, and highlights.
- `training-scouting.md` — individual hours, rating movement, and scouting discovery.
- `automation-save.md` — delegation modes, disabled systems, local persistence, New Game, and Reset Save.

Every specification should contain purpose, inputs, state changes, validation, user-visible output, edge cases, and acceptance criteria.
