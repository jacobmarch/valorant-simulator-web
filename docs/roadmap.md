# MVP-to-Finished Roadmap

## Phase 0: Foundations

- Confirm repository stack and routing conventions.
- Create typed domain models, configuration schema, seed versioning, command/result pattern, deterministic RNG, and test harness.
- Maintain `docs/` and `specs/` as the living contract.

## Phase 1: MVP vertical slice

- Seed all 2026 VCT organizations and opening rosters.
- Implement game creation, selected-team start, weekly calendar, dashboard, inbox, and local save.
- Implement roster legality, transfer windows, simple contracts, salaries, buyouts, releases, benching, activation, and AI roster actions.
- Implement 40-hour individual training and gradual scouting in simplified form.
- Implement regional schedule, standings, playoffs, international qualification, Masters 1, Masters 2, and Champions.
- Implement pre-match map veto, legal lineup, attack/defense style, Bo3/Bo5 simulation, overtime, full statistics, highlights, match review, prize money, job offers, New Game, and Reset Save.

## Phase 2: Reliability and depth

- Improve data provenance and seed-update workflow.
- Add historical records, awards, news, dashboard filters, and local save export/import.
- Improve AI transfer behavior, job-market logic, scouting confidence, and schedule edge cases.
- Add agent compositions, map-specific plans, pistol preferences, opponent scouting, and richer tactical formulas.

## Phase 3: Finished manager experience

- Add between-map strategy decisions and legal timeout decision points: two timeouts per map plus the overtime timeout, with strategy changes only at permitted moments.
- Add player personalities, morale, confidence, fatigue, relationships, and team cohesion.
- Add staff, analysts, coaches, performance staff, facilities, and delegation quality.
- Add richer sponsorships, operating budgets, salary negotiations, renewals, clauses, bonuses, and board objectives.
- Add player potential, aging, career arcs, injuries/availability, and detailed development.
- Add unemployed starts, reputation progression, applications, interviews, and broader job market.
- Add multiple local save slots, save management, and Supabase authentication/cloud saves.

## Phase 4: Live-world simulation

- Add versioned patches, agent/map balance changes, pick-rate-driven buffs/nerfs, and historical meta.
- Add roster/news data update tooling and optional imported data snapshots.
- Add richer match replay, map-by-map tactical analytics, and long-term records.

## Sequencing rule

Do not add depth systems before the full annual cycle is playable. A feature is lower priority than the ability to start, compete regionally, qualify internationally, make roster changes, continue into another season, and see consequences.
