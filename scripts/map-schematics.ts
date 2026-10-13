// Writes the schematic map images used by the round stage view. Run with `bun scripts/map-schematics.ts`.
// The geometry comes from src/map-layouts.ts, so the drawing and the player dots share one source.
// These are original schematics, not Riot's minimaps; see the note in src/map-layouts.ts.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { layoutFor, mapConfigs, type Point } from '../src/map-layouts'

const outDir = join(import.meta.dir, '..', 'src', 'assets', 'maps')
mkdirSync(outDir, { recursive: true })

const f = (value: number) => value.toFixed(2)
const line = (from: Point, to: Point, width: number, dash = '') =>
  `<line x1="${f(from.x)}" y1="${f(from.y)}" x2="${f(to.x)}" y2="${f(to.y)}" stroke="#2c3a4f" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`

function svg(map: string) {
  const config = mapConfigs.find((entry) => entry.map === map)
  if (!config) throw new Error(`No config for ${map}`)
  const layout = layoutFor(map)
  const { spawn, mid, sites } = config
  const parts = [
    `<rect x="1" y="1" width="98" height="98" rx="6" fill="#141b26" stroke="#2c3a4f" stroke-width="1"/>`,
    line(spawn, mid, 7),
    ...Object.values(sites).map((site) => line(mid, site, 6)),
    `<rect x="${f(spawn.x - 12)}" y="${f(spawn.y - 4)}" width="24" height="8" rx="2" fill="#1f2b3d" stroke="#3a4a63" stroke-width="0.6"/>`,
    `<text x="${f(spawn.x)}" y="${f(spawn.y + 1.4)}" text-anchor="middle" font-family="sans-serif" font-size="3.2" fill="#8393ab">SPAWN</text>`,
    `<circle cx="${f(mid.x)}" cy="${f(mid.y)}" r="7" fill="#1f2b3d" stroke="#3a4a63" stroke-width="0.6" stroke-dasharray="1.5 1"/>`,
    `<text x="${f(mid.x)}" y="${f(mid.y + 1.2)}" text-anchor="middle" font-family="sans-serif" font-size="3.2" fill="#8393ab">MID</text>`,
  ]
  for (const name of layout.siteNames) {
    const at = sites[name]
    parts.push(
      `<circle cx="${f(at.x)}" cy="${f(at.y)}" r="8" fill="#243247" stroke="#5b6f8f" stroke-width="0.8"/>`,
      `<text x="${f(at.x)}" y="${f(at.y + 2.4)}" text-anchor="middle" font-family="sans-serif" font-size="7" font-weight="700" fill="#dbe4f0">${name}</text>`,
    )
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`,
    `<title>${map} schematic layout</title>`,
    ...parts,
    `</svg>`,
    '',
  ].join('\n')
}

for (const config of mapConfigs) {
  const file = `${config.map.toLowerCase()}.svg`
  writeFileSync(join(outDir, file), svg(config.map))
  console.log(`wrote src/assets/maps/${file}`)
}
