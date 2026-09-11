# VCT Manager

VCT Manager is a single-player browser game where you run a real 2026 VCT organization through the complete competitive year.

## MVP

- All 48 2026 VCT organizations across Americas, EMEA, Pacific, and China.
- Static 2026 team/player seed with starters and roles.
- Weekly 2026 calendar and automatic background matches.
- Roster moves, free agents, buyouts, contracts, salary burn, and cash.
- Individual 40-hour training and gradual scouting.
- Map veto, lineup role assignment, attack/defense styles, and deterministic round simulation.
- Bo3 matches, post-match statistics/highlights, standings, Championship Points, and international phases.
- Job offers, one automatic browser save, New Game, and Reset Save.

## Run locally

```bash
bun install
bun dev
```

Build for deployment with `bun run build` and serve the generated `dist/` directory. Use `bun run preview` to serve the production bundle locally.

The implementation contract is maintained in [`docs/`](./docs/), with atomic feature specifications in [`specs/`](./specs/).
