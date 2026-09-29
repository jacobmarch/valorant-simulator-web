# Specification: Rosters, Transfers, and Contracts

## Purpose

Make difficult roster decisions central while enforcing configured VCT roster rules.

## Actions

- Sign a free agent.
- Buy out a contracted player.
- Release a player.
- Bench or activate a player.
- Assign starters and substitutes.
- Accept or reject balanced-mode contract proposals.

## Rules

- Transfer actions are allowed only during configured windows.
- Every organization must meet configured minimum/maximum roster size.
- Match lineups must be legal before a match can begin.
- Active/inactive, starter/substitute, nationality, import, and Game Changers exemption flags are validated.
- Buyout equals annual salary times remaining years. The buyer pays the seller immediately and takes over the contract; the player's salary rises to their asking salary if that is higher.
- Asking salary climbs steeply with overall: `$120k × e^(0.107 × (overall − 75))`, at least $25k. That is about $120k at 75, $350k at 85, $600k at 90 and $1M at 95. Seeded players start on their asking salary, free agents sign at it (the signing cost is asking salary times years), and renewals reset salary to it, so an ageing star's pay falls with their rating.
- AI organizations keep payroll within their sponsor base plus half of their cash above a $300k reserve. At renewal they keep the starters they can still afford, best first, and let the rest walk; buyouts and depth signings must fit that limit. A roster short of five still signs the cheapest affordable free agent.
- A player cannot be released in a way that creates an invalid match roster without an explicit replacement or valid substitute state.

## Acceptance criteria

- Illegal actions explain the exact failed rule.
- Buyer cash decreases and seller cash increases by the same buyout amount.
- AI organizations can make legal roster changes without breaking their next scheduled match.
- Roster history records every move.
