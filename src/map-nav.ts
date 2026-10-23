// The map as data: where a player can walk, how far it is by foot, and who can see whom.
//
// Each minimap is a 100 x 100 grid of floor and wall (src/map-grids.ts), the same 0-100 space as
// the layout points, so one cell is one unit. The round view only ever puts players on named
// layout points, so every question here is between two named points, and the answers are cached.
// Nothing here draws random numbers.
import { layoutFor, type Point } from './map-layouts'
import { mapGrids } from './map-grids'

const SIZE = 100
const SIDE = Math.SQRT2
const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SIDE],
  [1, -1, SIDE],
  [-1, 1, SIDE],
  [-1, -1, SIDE],
]

type Nav = {
  floor: Uint8Array
  fields: Map<number, Float64Array>
  paths: Map<number, number[]>
  sight: Map<number, boolean>
}
const navs = new Map<string, Nav>()

const cellOf = (point: Point) => {
  const x = Math.max(0, Math.min(SIZE - 1, Math.floor(point.x)))
  const y = Math.max(0, Math.min(SIZE - 1, Math.floor(point.y)))
  return y * SIZE + x
}

function navFor(map: string): Nav {
  let nav = navs.get(map)
  if (nav) return nav
  const rows = mapGrids[map]
  if (!rows) throw new Error(`No grid for ${map}`)
  const floor = new Uint8Array(SIZE * SIZE)
  rows.forEach((row, y) => {
    for (let x = 0; x < SIZE; x++) floor[y * SIZE + x] = row[x] === '#' ? 1 : 0
  })
  // A named point never sits in a wall: its own cell and the cells round it are floor.
  const layout = layoutFor(map)
  const named = [
    ...layout.attackSpawn,
    ...layout.mid,
    ...layout.flank,
    ...layout.siteNames.flatMap((name) => {
      const site = layout.sites[name]
      return [
        site.plant,
        ...site.entry,
        ...site.lanes,
        ...site.lurk,
        ...site.holds,
        ...site.post,
        ...site.retake,
      ]
    }),
  ]
  for (const point of named) {
    const at = cellOf(point)
    floor[at] = 1
  }
  nav = { floor, fields: new Map(), paths: new Map(), sight: new Map() }
  navs.set(map, nav)
  return nav
}

/** Whether a unit of the map is floor. */
export function walkable(map: string, point: Point): boolean {
  return navFor(map).floor[cellOf(point)] === 1
}

/** Walking distance from one cell to every cell, by Dijkstra over the grid. */
function field(nav: Nav, source: number): Float64Array {
  const cached = nav.fields.get(source)
  if (cached) return cached
  const dist = new Float64Array(SIZE * SIZE).fill(Number.POSITIVE_INFINITY)
  dist[source] = 0
  // A binary heap of [distance, cell].
  const heap: [number, number][] = [[0, source]]
  const push = (entry: [number, number]) => {
    heap.push(entry)
    let at = heap.length - 1
    while (at > 0) {
      const parent = (at - 1) >> 1
      if (heap[parent][0] <= heap[at][0]) break
      ;[heap[parent], heap[at]] = [heap[at], heap[parent]]
      at = parent
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop() as [number, number]
    if (heap.length > 0) {
      heap[0] = last
      let at = 0
      for (;;) {
        const left = at * 2 + 1
        const right = left + 1
        let small = at
        if (left < heap.length && heap[left][0] < heap[small][0]) small = left
        if (right < heap.length && heap[right][0] < heap[small][0]) small = right
        if (small === at) break
        ;[heap[small], heap[at]] = [heap[at], heap[small]]
        at = small
      }
    }
    return top
  }
  while (heap.length > 0) {
    const [d, cell] = pop()
    if (d > dist[cell]) continue
    const x = cell % SIZE
    const y = (cell - x) / SIZE
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue
      const next = ny * SIZE + nx
      if (!nav.floor[next]) continue
      const through = d + cost
      if (through < dist[next]) {
        dist[next] = through
        push([through, next])
      }
    }
  }
  nav.fields.set(source, dist)
  return dist
}

/** How far it is to walk between two points, or infinity if there is no way. */
export function routeLength(map: string, from: Point, to: Point): number {
  const nav = navFor(map)
  return field(nav, cellOf(from))[cellOf(to)]
}

/** The cells a walk from one point to another passes through, following the shortest way. */
function route(map: string, from: Point, to: Point): number[] {
  const nav = navFor(map)
  const start = cellOf(from)
  const end = cellOf(to)
  const key = start * SIZE * SIZE + end
  const cached = nav.paths.get(key)
  if (cached) return cached
  const dist = field(nav, end)
  const cells = [start]
  let cell = start
  while (cell !== end && Number.isFinite(dist[cell])) {
    const x = cell % SIZE
    const y = (cell - x) / SIZE
    let best = cell
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue
      const next = ny * SIZE + nx
      if (dist[next] < dist[best]) best = next
    }
    if (best === cell) break
    cell = best
    cells.push(cell)
  }
  nav.paths.set(key, cells)
  return cells
}

/** Whether walking from one point to another passes within `gap` of a third point. */
export function routePassesNear(map: string, from: Point, to: Point, near: Point, gap: number) {
  const nx = Math.floor(near.x)
  const ny = Math.floor(near.y)
  return route(map, from, to).some((cell) => {
    const x = cell % SIZE
    const y = (cell - x) / SIZE
    return Math.hypot(x - nx, y - ny) < gap
  })
}

/** Whether two points can see each other: a straight line between them crosses only floor. */
export function sees(map: string, a: Point, b: Point): boolean {
  const nav = navFor(map)
  const from = cellOf(a)
  const to = cellOf(b)
  const key = from < to ? from * SIZE * SIZE + to : to * SIZE * SIZE + from
  const cached = nav.sight.get(key)
  if (cached !== undefined) return cached
  const dx = b.x - a.x
  const dy = b.y - a.y
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2))
  let clear = true
  for (let step = 0; step <= steps && clear; step++) {
    const at = step / steps
    clear = nav.floor[cellOf({ x: a.x + dx * at, y: a.y + dy * at })] === 1
  }
  nav.sight.set(key, clear)
  return clear
}
