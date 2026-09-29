# Specification: Sponsors

## Purpose

Give every organization a yearly income that scales with how good it is, so cash does not drain to zero and teams can keep making roster moves. Logic lives in `src/sponsors.ts`; the manager signs deals on the Finances page.

## Rules

- Each season every team holds one sponsor contract: a weekly base and a season bonus tied to a goal.
- The weekly base is paid in the same weekly step as salaries, so the Finances page can show weekly net (sponsor base minus salaries).
- The manager is offered three tiers. Easy has the lowest base and bonus and the easiest goal; High has the highest base and bonus and the hardest goal.
- The competitive season ends when week 43 begins. Then each contract's goal is checked against that season's fixtures, bonuses are paid, the season is added to the team's history, and prestige updates.
- Missing the goal forfeits the bonus. It also costs prestige, taken off after the yearly update: Easy 0, Medium 5, High 12. The offer cards and the current deal show this, and the season history marks it.
- Prestige (0-100) is half the previous prestige plus half the season score: base 15, +15 for a Stage playoff bracket, +15 for each Masters, +20 for Champions, +10 for the Champions playoffs, and +25 for each international title.
- Offer level: Champions if the team won Masters or Champions in either of the last two seasons, or has prestige of 70+. Contender at prestige 45+. Otherwise Regional.
- Goals by level (Easy / Medium / High):
  - Regional: Stage playoffs / Masters / Champions
  - Contender: Masters / Champions / Champions playoffs
  - Champions: Champions / Champions playoffs / international title
- Next season's offers open in week 43. If the manager has not chosen by the end of week 52, the board signs the Medium offer. The current contract keeps paying weekly until it is replaced.
- AI teams sign automatically, picking the cheapest deal whose base covers about 90% of their payroll.
- Medium-deal annual base by level: Regional $600k, Contender $750k, Champions $900k (Easy ×0.8, High ×1.25; bonus ×0.15 / ×0.35 / ×0.7 of the level value).
- Sponsors cover a normal payroll, not a roster of stars. Prize money (`src/prizes.ts`) is paid to every team as soon as each event's final is played:
  - Kickoff: $100k to each of the three Masters seeds, $40k to the Lower Final loser.
  - Stage 1 and Stage 2 playoffs: $150k, $90k, $60k, $40k, $25k (5th–6th), $15k (7th–8th).
  - Masters: $500k, $250k, $150k, $100k, $60k, $40k.
  - Champions: $1M, $500k, $300k, $200k, $120k, $80k.
- Balance target: a roster of four or five top-tier players (85+) costs roughly $2M+ a year, so it needs one or two international titles and deep runs elsewhere to make money. A normal roster on a Contender deal makes a small profit.
- A new game (and a save from before sponsors existed) opens the current season's offers, due by the end of the current week.
