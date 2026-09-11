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
- Buyout equals annual salary times remaining years. The buyer pays the seller immediately and assumes the contract.
- A player cannot be released in a way that creates an invalid match roster without an explicit replacement or valid substitute state.

## Acceptance criteria

- Illegal actions explain the exact failed rule.
- Buyer cash decreases and seller cash increases by the same buyout amount.
- AI organizations can make legal roster changes without breaking their next scheduled match.
- Roster history records every move.
