# Specification: Training and Scouting

## Training

Each player has 40 hours per week distributed across Mechanics, Tactical Decision-Making, Utility, Consistency, Clutch, and Teamplay. Five hours in a skill is the weekly maintenance threshold. Below five hours creates bounded regression risk; above five hours increases improvement chance with diminishing returns. Ratings remain bounded from 1 to 100.

The result records prior rating, allocated hours, maintenance status, random outcome, new rating, and explanation. Training is individual only in the MVP.

## Scouting

The user distributes a configured scout-hour pool among targets. Basic identity, role, affiliation, and contract status are visible. Ratings begin hidden or low-confidence and become more accurate with accumulated hours. Tier 2 targets use low-detail placeholder organizations and lower salary/buyout values.

## Acceptance criteria

- Training allocation totals cannot exceed 40 hours per player.
- Scouting allocation cannot exceed the scout's available weekly hours.
- Maintenance and growth behavior is visible and deterministic under a fixed seed.
- Scouting never reveals a rating with more confidence than configured progress allows.
