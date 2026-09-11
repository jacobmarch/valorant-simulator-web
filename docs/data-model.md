# Data Model and Seed Data

## 1. Entity overview

### Manager

`id`, display name, current organization id or unemployed status, career start date, reputation, career history, and delegation settings. No manager attributes in MVP.

### Organization

`id`, real name, short name, region, league, home country, brand metadata, current cash, salary budget, board expectation, roster ids, manager id, and historical results.

### Player

`id`, real name, real-world team affiliation at seed time, nationality, eligibility flags, age/date of birth if available, primary role, secondary roles, role history, visible ratings, contract id, active/inactive status, starter/substitute status, current form, training state, scouting knowledge by organization, and Tier 2 placeholder status.

### Role and ratings

MVP roles: Duelist, Initiator, Controller, Sentinel, and Flex. MVP visible ratings include Mechanics, Tactical Decision-Making, Utility, Consistency, Clutch, and Teamplay. Ratings use a bounded 1–100 scale and display both value and a plain-language band.

Role history stores official-match evidence. A role becomes a secondary role only when seed data says the player has meaningful official usage. Broad role history can qualify a player as Flex. Unlisted roles incur a role-fit penalty during simulation.

### Contract

`playerId`, organization id, annual salary, remaining years as a numeric term, start date, end date, buyout policy, and status. MVP buyout equals annual salary multiplied by remaining contract years.

### Competition

`id`, name, type, region, stage, start/end weeks, format, participating organizations, qualification rules, bracket/standings state, prize table, and host city if international.

### Match and map result

Match stores competition id, week, teams, format, veto result, selected maps, lineups, styles, series score, map results, winner, loser, highlights, and seed. Map result stores rounds, overtime state, side switches, player statistics, economy snapshots, and map winner.

### Training assignment

Player id, week, 40-hour total, hours by skill, maintenance calculations, applied rating changes, and random seed/result.

### Scouting assignment

Scout owner, target player, week, allocated hours, information revealed, confidence per rating, and accumulated scouting progress. Targets may be VCT, free agent, or a low-detail Tier 2-affiliated player.

### Financial ledger

Organization id, week, transaction type, amount, source/target, description, and resulting cash. MVP types: starting cash, salary, buyout paid, buyout received, prize money, and minimal fixed operating adjustment if needed.

### Job offer

Organization id, offered manager id, offer date, expiry week, reason, expected reputation range, salary/term if used, and status. The AI should primarily create openings after poor prior-year performance; rare retirement/personal-departure events are allowed.

## 2. Seed-data requirements

The 2026 seed must include every VCT organization in Americas, EMEA, Pacific, and China; opening-season starters, substitutes, and inactive players; primary and secondary roles based on official-match role history; initial ratings and provenance; initial contracts and buyouts; league membership; a small list of Tier 2 placeholders; map pool; and stable MVP rules.

Seed files should include `source`, `sourceDate`, and `seedVersion` metadata. Domain code must not depend directly on an external source.

## 3. Derived data

Derived values include standings, qualification, buyout price, role-fit modifier, salary burn, scouting confidence, training result, opponent strength, and job-offer eligibility. They must be recalculable from canonical state and configuration.
