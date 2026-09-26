# Specification: Sponsors

## Purpose

Give every organization a yearly income that scales with how good it is, so cash does not drain to zero and teams can keep making roster moves. Logic lives in `src/sponsors.ts`; the manager signs deals on the Finances page.

## Rules

- Each season every team holds one sponsor contract: a weekly base and a season bonus tied to a goal.
- The weekly base is paid in the same weekly step as salaries, so the Finances page can show weekly net (sponsor base minus salaries).
- The manager is offered three tiers. Easy has the lowest base and bonus and the easiest goal; High has the highest base and bonus and the hardest goal.
- The competitive season ends when week 43 begins. Then each contract's goal is checked against that season's fixtures, bonuses are paid, the season is added to the team's history, and prestige updates.
- Prestige (0-100) is half the previous prestige plus half the season score: base 15, +15 for a Stage playoff bracket, +15 for each Masters, +20 for Champions, +10 for the Champions playoffs, and +25 for each international title.
- Offer level: Champions if the team won Masters or Champions in either of the last two seasons, or has prestige of 70+. Contender at prestige 45+. Otherwise Regional.
- Goals by level (Easy / Medium / High):
  - Regional: Stage playoffs / Masters / Champions
  - Contender: Masters / Champions / Champions playoffs
  - Champions: Champions / Champions playoffs / international title
- Next season's offers open in week 43. If the manager has not chosen by the end of week 52, the board signs the Medium offer. The current contract keeps paying weekly until it is replaced.
- AI teams sign automatically, picking the cheapest deal whose base covers about 90% of their payroll.
- A new game (and a save from before sponsors existed) opens the current season's offers, due by the end of the current week.
