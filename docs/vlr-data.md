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

Team discovery uses `/v2/search`, normalizes accents/punctuation/case, and accepts only the game name or an explicit organization alias. For example, KRÜ Visa also searches KRÜ Esports/KRU; Kiwoom DRX also searches DRX. These fallback queries use the same request pacing. Academy and Game Changers suffixes are not stripped, and inactive results are excluded. Discovered IDs come from API responses; confirmed defaults and explicit mappings may bypass search. Unknown or ambiguous identities still cause an explicit failure with candidate names/IDs. Create a JSON file mapping game organization IDs to verified numeric VLR team IDs, then supply `VLR_TEAM_MAPPING=/absolute/path/teams.json`. IDs are available in VLR team URLs. Example shape: `{ "sen": "2" }`; include other overrides when needed. No fuzzy name matching or guessed IDs are used. Teams absent from current VLR rosters need review; the game retains its fixed 2026 league membership and calendar.

The importer uses `/v2/team?id=…&q=roster` for active/benched membership, excludes staff/former members, and fetches `/v2/player?id=…&q=profile&timespan=90d` for each player. Stable `vlr-N` IDs prevent one transferred player appearing on two teams. It accepts 0–10 active players and at most 10 total players including benched members for every game team. Offseason rosters with vacancies, including empty rosters, are imported as they are. All accepted members are retained. Up to five active players in VLR display order form the default game lineup; other active players and benched members become game substitutes. This is a configurable game lineup, not a claim about the real match starting five. Rosters outside those limits fail for review. The latest valid file stays intact on failure. Each successful refresh archives raw responses in `data/vlr/`, then atomically replaces the validated database file. Requests run sequentially with at least four seconds between attempts (about 15 calls/minute), a 30-second timeout, and up to six attempts. Retries share the same pacing clock. HTTP 429 honors Retry-After (seconds or HTTP date) plus a one-second margin; without a valid header it starts with a 60-second cooldown and backs off exponentially. Permanent HTTP errors such as 400/404 fail immediately.

Important: actual current source returns `data.segments[0]` for profiles, with `usage_count`, `usage_pct`, and `current_team`; several README examples show a different shape. The importer follows source, and fails explicitly if that shape changes. Pin a reviewed upstream commit in your deployment for reproducibility.

Eternal Fire replaces inactive ULF Esports in the EMEA slot. The internal ID remains `ulf` to preserve save and database references; searches now use Eternal Fire. If an existing mapping file contains an `ulf` override for ULF, remove it to use name discovery or replace it with Eternal Fire's verified VLR ID. Refresh the database and start a new career to use Eternal Fire's current roster. Existing saves update the organization name and abbreviation while retaining their simulated rosters.

ALL GAMERS (`ag`) uses the confirmed VLR team ID `1119` by default because VLR search also returns `22257` with the same name. This default skips name discovery for that team. `VLR_TEAM_MAPPING` still takes precedence if you supply an explicit override.

### Request rate limits

The upstream API shares a 20-requests-per-minute tier across `/v2/player` and `/v2/team`, so those endpoints cannot each use a separate 20-call allowance. The default four-second spacing stays below that limit for one importer. Other callers from the same client address also consume that allowance; 429 cooldowns handle an already-used window.

For a slower run, set the interval in milliseconds:

```bash
VLR_REQUEST_INTERVAL_MS=6000 bun run data:refresh
```

This allows about 10 calls/minute. Keep the interval at least 4000 ms for the upstream default limit; increase it for a stricter deployment or shared traffic. A full 48-team import will take roughly 20–40 minutes depending on roster sizes and server latency, plus any cooldowns. The importer logs its spacing at startup and warns when it pauses after a rate limit. Run a single refresh process at a time.

## Preseason roster completion

New careers start in week 1 with no matches. Kickoff begins in week 2. Advancing preseason lets AI organizations sign free agents until they can field five; the pool replenishes as they hire, so it can fill vacancies across the whole league. The manager's roster is never automatically filled. It may stay short during week 1, but Kickoff simulation blocks until five eligible players are signed. Signings remain open in weeks 1–2. The free-agent pool includes generated prospects; these additions are game players, not real-world signings reported by VLR.

Later events retain their dates: Kickoff rounds six through nine share its closing week. Version 18 saves preserve the new calendar; older saves move opening Kickoff rounds forward one week without replaying completed fixtures.

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

Run `bun test tests/player-database.test.ts tests/vlr-client.test.ts tests/vlr-teams.test.ts`, `bun run lint`, `bun test`, and `bun run build`. Tests use deliberately synthetic fixtures; they are not shipped as real player data.

The development workspace's outbound proxy was unreachable during implementation, so no current VLR payload was retrieved and no real database was published. Complete a refresh on a network-enabled host before selecting VLR data in a new career.
