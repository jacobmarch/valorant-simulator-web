# Technical Architecture

## 1. Architecture goals

- Keep simulation deterministic and testable when supplied with a seed.
- Keep the 2026 rules and data configurable rather than hard-coded into UI components.
- Keep UI state separate from the canonical game state.
- Make future Supabase persistence an adapter replacement, not a rewrite.
- Make each feature understandable and independently implementable by another agent.

## 2. Recommended application shape

Use a small TypeScript web stack already compatible with the repository. Prefer:

- Component-based frontend with typed models.
- A pure domain/simulation layer with no browser or framework imports.
- Local persistence adapter using versioned JSON in `localStorage` for MVP.
- Repository interfaces for teams, players, schedules, contracts, and saves.
- Deterministic seeded random-number service injected into simulation functions.
- Configuration files for competition formats, rules, map pool, cities, ratings, and transfer windows.

Do not put simulation formulas directly in page components. UI actions dispatch domain commands; commands validate and produce a new game state plus an event log.

## 3. Logical layers

1. **Presentation:** dashboard, forms, match view, tables, charts, modals, and navigation.
2. **Application services:** advance-week orchestration, roster command handlers, match preparation, job-offer resolution, and save/load.
3. **Domain:** entities, legal validators, standings, tournament bracket, training, scouting, contracts, and match simulation.
4. **Data:** static 2026 seed, configuration, migrations, local-save adapter, and future Supabase adapter.

## 4. Canonical state

`GameState` must contain a schema version, current date/week, manager, organizations, players, contracts, competitions, scheduled matches, completed matches, standings, tournament state, financial ledgers, scouting knowledge, training assignments, pending decisions, job offers, event log, random seed/state, and configuration version.

All mutations return a new state or an equivalent immutable update. Avoid storing derived values when they can be recomputed, except for historical records and audit events.

## 5. Advance-week transaction

`advanceWeek()` is the primary orchestration boundary:

1. Validate that no required hands-on decision is unresolved.
2. Apply training and scouting allocations.
3. Apply salary and recurring financial ledger entries.
4. Resolve availability and scheduled matches in deterministic order.
5. Update standings, brackets, ratings, qualifications, and event highlights.
6. Resolve AI roster actions and job-market actions allowed in the week.
7. Generate pending approvals, news, and notifications.
8. Move the date to the next week.
9. Persist the resulting state and return a summary.

The transaction must be safe to retry. Use an event or processed-week identifier so a browser refresh cannot pay salaries or simulate matches twice.

## 6. Persistence and future backend

MVP local storage stores one versioned serialized save under a namespaced key, including schema version and seed/configuration version. New Game creates a new state after confirmation. Reset Save deletes the local save only after confirmation.

Future Supabase work should introduce authenticated users, save-slot rows, serialized state or normalized tables, optimistic version checks, and server-side validation for cloud saves. The MVP must not depend on Supabase being configured.

## 7. Testing requirements

- Unit tests for every pure rule and formula.
- Fixture tests for every competition stage and roster window.
- Property tests for roster legality, budget rules, overtime termination, and bracket advancement.
- Snapshot tests for seeded match summaries.
- Browser tests for start game, advance week, roster change, match preparation, match review, save/resume, New Game, and Reset Save.
- A migration test for every save schema change.

## 8. Error handling

User errors are recoverable validation messages. Simulation errors must not leave a partially advanced game. Log a user-readable event plus a developer diagnostic identifier. Unknown configuration versions and corrupt saves must offer recovery or reset, never silently overwrite the save.
