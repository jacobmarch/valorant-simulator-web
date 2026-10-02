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
- Offseason imports may contain 0–10 roster players. Every organization must field five eligible players in a match lineup when competition begins.
- Match lineups must be legal before a match can begin.
- Active/inactive, starter/substitute, nationality, import, and Game Changers exemption flags are validated.
- Buyout equals annual salary times remaining years. The buyer pays the seller immediately and takes over the contract; the player's salary rises to their asking salary if that is higher.
- Asking salary climbs steeply with overall: `$120k × e^(0.107 × (overall − 75))`, at least $25k. That is about $120k at 75, $350k at 85, $600k at 90 and $1M at 95. Seeded players start on their asking salary, free agents sign at it (the signing cost is asking salary times years), and renewals reset salary to it, so an ageing star's pay falls with their rating.
- AI organizations keep payroll within their sponsor base plus half of their cash above a $300k reserve. At renewal they keep the starters they can still afford, best first, and let the rest walk; buyouts and depth signings must fit that limit. A roster short of five still signs the cheapest affordable free agent.
- Contracts run out at rollover (the end of week 52). From week 43 the manager can renegotiate each player with one year or less left: 1–3 years (veterans 30+ take only 1) at their asking salary, on the Roster page. The new terms take effect at rollover. Anyone not re-signed leaves for free agency, and AI clubs keep re-signing their affordable starters automatically.
- The managed roster may fall below five after rollover. Week 1 preseason can advance with fewer than five players. Kickoff simulation in week 2 blocks until the manager has five eligible players; the signing window is open in weeks 1–2.
- A player cannot be released in a way that creates an invalid match roster without an explicit replacement or valid substitute state.

## Acceptance criteria

- Illegal actions explain the exact failed rule.
- Buyer cash decreases and seller cash increases by the same buyout amount.
- AI organizations can make legal roster changes without breaking their next scheduled match.
- Roster history records every move.
