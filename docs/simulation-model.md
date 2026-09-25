# Simulation Model

## 1. Time

The calendar starts on 2026-01-01. The player advances in weekly increments. Events belong to a week; if multiple events occur in one week, resolve them in configured order and show a weekly summary. Explicit transition weeks are no-match breaks before each major stage so the dashboard can clearly communicate the change from regional play to international play and back again. The schedule must be data-driven so real 2026 dates can be represented as week buckets.

## 2. Competition model

Use the official 2026 sequence: regional Kickoff, Masters 1 (officially Masters Santiago), regional Stage 1, Masters 2 (officially Masters London), regional Stage 2, and Champions (officially Champions Shanghai). The 2026 configuration contains 48 teams across Americas, EMEA, Pacific, and China.

Kickoff is a 12-team triple-elimination event in each territory. The top three teams from each territory qualify for Masters 1 and receive configured Championship Points. Stage 1 uses a 12-team regional league in weeks 12–15. The top eight teams by regional standings advance to an eight-team double-elimination playoff in weeks 16–18. The lower final and grand final are Bo5. The top three Stage 1 finishers from each territory qualify for Masters 2 and receive configured Championship Points.

Stage 2 uses a 12-team regional league in weeks 24–31. The top eight teams in each region advance to an eight-team double-elimination playoff in weeks 32–34; the top four regional playoff finishers qualify for Champions.

International events use fictional host-city assignments selected from major real cities in different global regions. Within one season, Masters 1, Masters 2, and Champions must not repeat the same host region. City assignment is configuration, not random at runtime, so a save is reproducible. The official event names and real-world host cities are not required to be used as the game's venue assignments.

Masters uses the official 12-team structure. Each territory's first seed advances directly to playoffs. The other eight teams play a two-win/two-loss Swiss stage for four playoff places. The resulting eight-team field plays double elimination. Champions uses four GSL-style double-elimination groups of four; two teams survive each group and enter an eight-team double-elimination playoff. Lower finals and grand finals are best-of-five.

The MVP calendar compresses multiple sequential playoff rounds into a weekly resolution boundary when necessary. Fixtures are created and simulated in dependency order within that week, so every downstream participant comes from an actual completed upstream result. The Competition Center still displays each named round separately.

## 3. Roster legality

Every active roster must satisfy configured minimum and maximum sizes, starter/substitute rules, inactive-player rules, and the requested one-international-player limit, with the defined Game Changers exemption. Validation runs at game start, before each match, after every transaction, and when a transfer window closes.

The engine distinguishes contracted/free-agent players, active/inactive/benched/starter/substitute status, VCT/Tier 2 affiliation, eligibility/import status, and legal match lineups. The UI explains the exact rule blocking an action.

## 4. Transfer windows and contracts

Transfer windows are configured by calendar week. MVP actions are sign free agent, buy out contracted player, release, bench, activate, and assign starter/substitute status. AI organizations perform equivalent actions automatically when allowed.

Buyout is `annualSalary * remainingYears`, rounded according to currency configuration. The buyer pays the seller immediately; the buyer inherits the remaining salary commitment. The seller receives cash. Complex negotiations and clauses are later features.

Salary is charged weekly using annual salary divided by the configured weeks-per-year value. If a transaction changes mid-week, apply it at the next weekly boundary unless configuration permits proration.

## 5. Training

Each player receives exactly 40 available training hours per week. The user allocates hours among Mechanics, Tactical Decision-Making, Utility, Consistency, Clutch, and Teamplay. Five hours per skill is the maintenance threshold. Below five hours creates bounded regression risk; above five hours increases improvement chance with diminishing returns, subject to rating caps. Players the manager does not train (AI rosters, free agents) follow a default balanced plan slightly above maintenance.

Training results show hours, maintenance status, prior rating, result, and reason. Training is individual only; team synergy is later.

### Potential, age, form and morale

Every player has an age and a potential (their overall-rating ceiling). Seed ages range 19–28 for VCT players and 17–20 for free agents; younger players start with more headroom above their current overall. Training growth chance is multiplied by an age factor (1.5× at 20 and under down to 0.45× past 29), a potential factor (full speed with 5+ points of headroom, about 8% once the player reaches potential), and a morale factor (0.8×–1.2×). From 27, Mechanics and Clutch carry a weekly decline chance regardless of training; tactical skills start declining after 30. At season rollover every player ages one year and players 28 and older lose 1–2 potential.

Form (−6 to +6) reflects recent individual performance: after each series it moves toward the player's average ACS relative to 200, plus a small win/loss nudge, and decays 20% per week. Morale (5–95, default 60) rises 4 after a series win, falls 5 after a loss, and drifts each week toward a target set by status (starter 55, substitute 42, inactive 35). In the match engine each player's strength includes form plus (morale − 50) / 25, so a hot, happy lineup gains a few points of team strength.

## 6. Scouting

The user distributes a configured weekly scout-hour pool among targets. Basic identity, role, affiliation, and contract status are visible. Ratings begin hidden or low-confidence and become more accurate with accumulated hours. Tier 2 targets use low-detail placeholder organizations and lower salary/buyout values.

## 7. Match preparation

Before each user-team match, require or permit a legal starting lineup, map veto/pick-ban sequence, attack style, and defense style. Styles influence round probabilities but are broad MVP controls. Detailed agent compositions, pistol plans, economy plans, anti-stratting, timeouts, and between-map changes are later extensions.

## 8. Match simulation

Regular matches are best-of-3. Grand finals and lower finals are best-of-5. Each map is simulated round by round behind the scenes using team strength, player ratings, lineup legality, role fit, map/style modifiers, form, opponent strength, and seeded randomness.

Overtime is win-by-two with side switches every round. The engine must guarantee termination through a configurable safety cap and deterministic tiebreak fallback clearly marked as a safeguard.

Results include series/map scores, every round result, player kills/deaths/assists/ACS/ADR/KAST/first kills/first deaths/clutches/plants/defuses/headshot percentage, team economy, and highlights including aces, multikills, clutches, comeback rounds, and notable 1vX events. Timeout usage is not required in MVP output.

## 9. Background simulation

All matches not involving the user's current organization resolve automatically using the same engine and rules. Regional phases select opponents from the manager's territory; Masters and Champions select opponents from the full international field. Their results update standings, brackets, qualification, player form, financial ledgers, and news.

## 10. Statistical guardrails

Player lines are generated from map rounds and team outcome rather than independent high rolls. Kills and deaths use a shared round-volume scale, with winners receiving only a modest expected edge; negative K/D lines are normal. First kills and first deaths are separate bounded events, and zeroes are common. ACS normally falls in a professional range below 300; 300+ is a rare outlier and 360 is a hard ceiling. ADR, KAST, headshots, plants, defuses, assists, and clutches are also bounded. These rules are required for both map-level and series-aggregate views.

## 10. Manager movement

The MVP starts with a selected organization but does not lock the manager there. Organizations that struggled in the prior year can dismiss their manager and produce offers based on the user's success. A top-performing organization should not normally replace a successful manager. Rare retirement or personal-departure events may create exceptions. Unemployed starts are later.

## 11. Official-format reference

The 2026 event sequence and territory structure are based on the official [VALORANT Esports League Handbook](https://valorantesports.com/en-US/season/115571062868511862/handbook). The game intentionally uses fictional configured host cities per the product requirement, even where official venues are known.

## 12. Persisted fixture and event invariants

The fixture list is the single source of truth for dashboard opponents, match preparation, weekly resolution, matchup lists, and bracket columns. A fixture is generated before its week is shown and stores both participants, format, round, scope, status, result link, and season. Older browser saves are migrated to the current fixture schema; in-progress Kickoff saves are restarted at week one when the bracket rules change.

Kickoff uses three lives and fixed bracket slots. Round-one winners are paired one-to-one with the four opening-bye teams in Upper Round 2. Middle Round 1 contains four matches, each pairing an Upper Round 1 loser with an Upper Round 2 loser. From that point onward, every active team advances through an explicit predecessor slot; there are no additional byes or record-based pairings. Each region therefore resolves exactly 30 series: 11 upper, 10 middle, and 9 lower. Only Upper Final, Middle Final, and Lower Final are BO5. Every other Kickoff fixture is BO3, and each non-qualifier reaches elimination at three losses. The bracket screen shows every round, scheduled/completed state, remaining lives, and connected feeder paths.

Every simulated death has an opposing killer. Each round creates exactly one first kill and one first death. The losing side has four or five casualties in a normal round, while the winning side has zero to four. A player cannot die twice in one round. This produces realistic death volume in close maps without independently fabricating player totals.
