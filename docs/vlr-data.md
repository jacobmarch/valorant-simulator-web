# Refreshing the player database from VLR

The game has a TypeScript seed and browser career saves, rather than a database server. The importer publishes `public/data/players.json`; the New Career screen loads it and shows its fetch date and stats window. Each new career copies the data. Existing careers keep their transfers, training, contracts, and simulated history.

## API setup

The [upstream repository](https://github.com/axsddlr/vlrggapi) currently warns that its public Vercel instance is down because of free-tier limits. Self-host its FastAPI service using Python 3.11:

```bash
git clone https://github.com/axsddlr/vlrggapi.git
cd vlrggapi
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

The API listens at `http://127.0.0.1:3001`; interactive docs are at `/`. Check `/version` and `/v2/player?id=9&q=profile&timespan=90d`. It needs outbound HTTPS to `www.vlr.gg` (and any VLR hosts its configuration uses). No Riot API key is required. This is unofficial scraped data, dependent on VLR availability and HTML selectors.

## Refresh the game

From the game directory, with the API running:

```bash
VLR_API_BASE_URL=http://127.0.0.1:3001 VLR_TIMESPAN=90d bun run data:refresh
bun run build
```

For deployment, serve the rebuilt `dist/`. The game browser never calls VLR or the Python API directly, avoiding CORS and per-user scraping. Running the refresh before a build obtains current data; it is not a permanent hand-authored snapshot. Schedule this command daily on a machine that runs the API, followed by your normal build/deployment process. A refresh alone does not update a previously deployed `dist/`.

Team discovery uses `/v2/search` with a unique exact name. Renamed or ambiguous teams cause an explicit failure. Create a JSON file mapping game organization IDs to verified numeric VLR team IDs, then supply `VLR_TEAM_MAPPING=/absolute/path/teams.json`. IDs are available in VLR team URLs. Example shape: `{ "sen": "2" }`; include other overrides when needed. No fuzzy name matching or guessed IDs are used. Teams absent from current VLR rosters need review; the game retains its fixed 2026 league membership and calendar.

The importer uses `/v2/team?id=…&q=roster` for active/benched membership, excludes staff/former members, and fetches `/v2/player?id=…&q=profile&timespan=90d` for each player. Stable `vlr-N` IDs prevent one transferred player appearing on two teams. It requires five active players and at most seven total for every game team. An offseason roster with vacancies or six active members fails for review instead of fabricating a lineup. The latest valid file stays intact on failure. Each successful refresh archives raw responses in `data/vlr/`, then atomically replaces the validated database file. Requests run sequentially with a one-second delay, a 30-second timeout, and up to three attempts.

Important: actual current source returns `data.segments[0]` for profiles, with `usage_count`, `usage_pct`, and `current_team`; several README examples show a different shape. The importer follows source, and fails explicitly if that shape changes. Pin a reviewed upstream commit in your deployment for reproducibility.

## Ratings and roles

Agent rounds determine the primary class; another class becomes secondary at 20% of total rounds. Unknown agents remain in total round counts but are not assigned an invented class. No usable agent data gives Flex and neutral ratings. Update the agent-class lookup when Riot releases new agents.

Ratings are game estimates, not official VLR ratings or objectively measured skills. Each metric is round weighted. A proxy is `70 + clamp((metric - center) × scale, -30, 29) × rounds / (rounds + 400)`. Missing metrics use 70. The 400-round prior reduces small-sample spikes. These constants are an initial transparent calibration, not a validated population percentile model; region, opponent strength, and agent effects are not adjusted yet.

| Game skill | Evidence / calculation |
| --- | --- |
| Mechanics | Mean of ACS (center 200, scale .2), ADR (130, .3), KPR (.7, 65) proxies |
| Tactics | VLR rating proxy (1.0, 35); performance proxy, not measured decision quality |
| Utility | APR proxy (.25, 80); assists cannot isolate utility quality |
| Consistency | KAST proxy (70, 1.8); participation/survival, not match-to-match variance |
| Teamplay | Mean of KAST and APR proxies |
| Clutch | Neutral 70: player agent profiles do not expose clutch attempts/successes |

Raw agent stats, source player URL, sample rounds, fetch time, and model version remain attached to imported players. Age (23), one-year contracts, salary, potential, import eligibility, and leadership are gameplay assumptions. Leadership still follows the game's existing Tactics/Teamplay rules. Free-agent/prospect generation remains synthetic. None of those values are claimed as VLR facts.

For stronger ratings later, ingest completed match details and estimate match variance, clutch success with attempt counts, and role/opponent-adjusted percentiles. Do not infer IGL status from agent class. `/v2/match?q=live_score` reports live matches, while profiles are cached for 30 minutes: this integration refreshes recent real statistics and rosters, not frame-by-frame game telemetry.

## Validation and current limitation

Run `bun test tests/player-database.test.ts`, `bun run lint`, `bun test`, and `bun run build`. Tests use deliberately synthetic fixtures; they are not shipped as real player data.

The development workspace's outbound proxy was unreachable during implementation, so no current VLR payload was retrieved and no real database was published. Complete a refresh on a network-enabled host before selecting VLR data in a new career.
