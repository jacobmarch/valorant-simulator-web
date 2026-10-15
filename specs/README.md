# Atomic Feature Specifications

Each file describes one feature contract. Implementers should read the relevant file before changing code and update it when behavior changes.

- `game-loop.md` — new game, weekly progression, event ordering, and dashboard.
- `roster-contracts.md` — roster state, legality, transfer windows, contracts, salaries, and buyouts.
- `competition.md` — VCT calendar, standings, qualification, brackets, events, and host cities.
- `match-simulation.md` — preparation, simulation, overtime, statistics, and highlights.
- `training-scouting.md` — individual hours, rating movement, and scouting discovery.
- `debt-and-firing.md` — managed-club debt limit, the firing screen, and taking over a new club.
- `automation-save.md` — delegation modes, disabled systems, local persistence, New Game, and Reset Save.
- `round-stages.md` — stages within a watched round, player positions on a schematic map, and stage playback.
- `round-tactics.md` — the tactical layer on the minimap: round plans, beats, formations, decision points, where kills fall, and the plan for later work.

Every specification should contain purpose, inputs, state changes, validation, user-visible output, edge cases, and acceptance criteria.
