// Where players stand on each map during a watched round. Every point is in a 0-100 square
// (x right, y down) that matches the schematic drawn for the map in src/assets/maps.
//
// These are schematic layouts, not Riot's minimaps: they keep the map's site count and the
// attack spawn, mid and site positions in roughly the right places, and they are the only
// geometry the round stage view reads. See scripts/map-schematics.ts.

export type Point = { x: number; y: number }
export type SiteLayout = {
  /** Centre of the site, where the spike goes down. */
  plant: Point
  /** Where defenders hold the site before anything happens. */
  holds: Point[]
  /** Where attackers stand around a planted spike. */
  post: Point[]
  /** Where defenders come from when they retake the site. */
  retake: Point[]
}
export type MapLayout = {
  map: string
  attackSpawn: Point[]
  mid: Point[]
  siteNames: string[]
  sites: Record<string, SiteLayout>
}

type MapConfig = {
  map: string
  spawn: Point
  mid: Point
  sites: Record<string, Point>
}

const point = (x: number, y: number): Point => ({ x, y })

/** Site and mid positions per map. Haven and Lotus have three sites; the rest have two. */
export const mapConfigs: MapConfig[] = [
  {
    map: 'Abyss',
    spawn: point(50, 90),
    mid: point(50, 50),
    sites: { A: point(18, 30), B: point(82, 30) },
  },
  {
    map: 'Bind',
    spawn: point(50, 90),
    mid: point(50, 52),
    sites: { A: point(22, 22), B: point(78, 22) },
  },
  {
    map: 'Breeze',
    spawn: point(50, 90),
    mid: point(46, 50),
    sites: { A: point(20, 24), B: point(80, 28) },
  },
  {
    map: 'Haven',
    spawn: point(50, 90),
    mid: point(50, 55),
    sites: { A: point(18, 22), B: point(50, 14), C: point(82, 22) },
  },
  {
    map: 'Icebox',
    spawn: point(50, 90),
    mid: point(48, 52),
    sites: { A: point(18, 28), B: point(80, 22) },
  },
  {
    map: 'Lotus',
    spawn: point(50, 90),
    mid: point(50, 52),
    sites: { A: point(18, 22), B: point(50, 14), C: point(82, 22) },
  },
  {
    map: 'Sunset',
    spawn: point(50, 90),
    mid: point(50, 52),
    sites: { A: point(20, 30), B: point(80, 30) },
  },
]

/** Up to `count` points in a row, centred on `center`. Used for players standing together. */
function row(center: Point, count: number, gap: number): Point[] {
  return Array.from({ length: count }, (_, index) =>
    point(center.x + (index - (count - 1) / 2) * gap, center.y + (index % 2 ? 1.5 : -0.5)),
  )
}
/** Spacing between players on the map, wide enough that their dots don't overlap. */
const GAP = 8

/** Offsets a point along the site's direction to mid (`along`) and across it (`across`). */
function offset(from: Point, toward: Point, along: number, across: number): Point {
  const dx = toward.x - from.x,
    dy = toward.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length,
    uy = dy / length
  return point(from.x + ux * along - uy * across, from.y + uy * along + ux * across)
}

function siteLayout(site: Point, mid: Point): SiteLayout {
  return {
    plant: site,
    holds: [offset(site, mid, 0, 6), offset(site, mid, 0, -6), offset(site, mid, -7, 0)],
    // Spike spot is the centre of the site, so players stand around it, not on it.
    post: [
      offset(site, mid, 0, 8),
      offset(site, mid, 0, -8),
      offset(site, mid, -8, 0),
      offset(site, mid, 8, 0),
    ],
    retake: [
      offset(site, mid, 13, 8),
      offset(site, mid, 13, -8),
      offset(site, mid, 17, 0),
      offset(site, mid, 9, 0),
    ],
  }
}

function buildLayout(config: MapConfig): MapLayout {
  const siteNames = Object.keys(config.sites)
  return {
    map: config.map,
    attackSpawn: row(config.spawn, 5, GAP),
    mid: row(config.mid, 5, GAP),
    siteNames,
    sites: Object.fromEntries(
      siteNames.map((name) => [name, siteLayout(config.sites[name], config.mid)]),
    ),
  }
}

export const mapLayouts: Record<string, MapLayout> = Object.fromEntries(
  mapConfigs.map((config) => [config.map, buildLayout(config)]),
)

export function layoutFor(map: string): MapLayout {
  const layout = mapLayouts[map]
  if (!layout) throw new Error(`No layout for ${map}`)
  return layout
}
