# Specification: VCT Competition and Calendar

## Purpose

Simulate the full VCT-style 2026 competitive cycle.

## Scope

Regional VCT leagues in Americas, EMEA, Pacific, and China, plus Masters 1, Masters 2, and Champions. Tier 2 is not playable in the MVP.

## Behavior

- Use the official 2026 sequence: Kickoff, Masters 1, Stage 1, Masters 2, Stage 2, and Champions.
- Seed four territories—Americas, EMEA, Pacific, and China—with 12 VCT organizations each.
- Kickoff is triple elimination with 12 teams per territory. The four prior-Champions teams receive opening-round byes, eight teams play in week one, and the top three qualify for Masters 1.
- Stage 1 draws each region's 12 teams into two groups of six in weeks 11–15, seeded in tiers of two from the Kickoff finish (1–2, 3–4, …) with one team from each tier going to each group at random. Each team plays its group once (five matches). The top four of each group enter an eight-team double-elimination playoff in weeks 16–18. The top three finishers qualify for Masters 2.
- Stage 2 redraws two groups of six in weeks 24–28, tiered the same way from the Stage 1 playoff finish, followed by an eight-team double-elimination playoff in weeks 29–31. Weeks 32–35 are a break before Champions. Per region, the two Stage 2 finalists qualify for Champions as seeds 1 and 2, and the next two teams by Championship Points, wherever they finished, take seeds 3 and 4.
- Maintain Championship Points as a first-class standings field because they affect international qualification. Points use the 2026 VCT table: Kickoff 4/3/2/1 for 1st–4th; Masters 1 6/4/3/2/1/1 and Masters 2 8/6/5/4/3/3 for 1st–6th; Stage 1 playoffs 6/4/3/2 and Stage 2 playoffs 5/4 for 3rd/4th; one point per Stage 1 and Stage 2 group win. Champions earns none, and points reset each season. Totals are rebuilt from completed fixtures, and the Competition page shows each region's race with a per-event breakdown.
- Use standings, playoffs, lower brackets, qualification slots, international seeding, and elimination.
- Regular matches are Bo3; Kickoff closing-path matches, lower finals, and grand finals are Bo5.
- The schedule is bucketed into weeks beginning from 2026-01-01.
- Each international event has a configured major-city host. Masters 1, Masters 2, and Champions must use different global regions in the same season.

## Reference

The structure is based on the official [2026 VCT League Handbook](https://valorantesports.com/en-US/season/115571062868511862/handbook). If the official rules change, update the versioned game configuration and this specification together.

## Acceptance criteria

- A team can qualify from its regional league into an international event.
- A qualified team can play the event and the event updates records and prize money.
- Standings and brackets remain correct after background matches.
- No international event repeats a host region in the same season.
- A territory.s Stage 1 teams play five group matches before playoffs are seeded, and the eight highest-ranked teams enter the regional bracket.
- A 16-team Champions field can be produced from Stage 2 and Championship Points without simulating a Tier 2 league.
