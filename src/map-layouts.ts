// Where players stand on each map during a watched round. Every point is in a 0-100 square
// (x right, y down) over that map's minimap in map_images/ (imported through src/map-images.ts).
//
// The points were placed by hand from the images and snapped to the nearest floor pixel, so
// every point sits on walkable floor, not on a wall or in a void. The site letters and which
// structure is which site are read from the images without labels, so check them against the
// game before relying on them. Each map's table is data: edit a point here to move it.
//
// The round stage view reads only these tables, so nothing else needs to change if a point moves.

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

export const mapLayouts: Record<string, MapLayout> = {
  Abyss: {
    map: 'Abyss',
    attackSpawn: [
      { x: 26.73, y: 83.78 },
      { x: 31.43, y: 91.49 },
      { x: 39, y: 89.5 },
      { x: 47, y: 91.5 },
      { x: 54.95, y: 88.79 },
    ],
    mid: [
      { x: 34.03, y: 49.85 },
      { x: 42, y: 51.5 },
      { x: 50.05, y: 49.75 },
      { x: 58, y: 51.5 },
      { x: 66, y: 49.5 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 12, y: 45 },
        holds: [
          { x: 10.83, y: 53.92 },
          { x: 13.17, y: 36.08 },
          { x: 4.07, y: 43.96 },
        ],
        post: [
          { x: 10.96, y: 52.93 },
          { x: 13.04, y: 37.07 },
          { x: 4.07, y: 43.96 },
          { x: 17.72, y: 46.05 },
        ],
        retake: [
          { x: 25.83, y: 53.05 },
          { x: 28.33, y: 41.04 },
          { x: 28.85, y: 47.22 },
          { x: 17.72, y: 46.15 },
        ],
      },
      B: {
        plant: { x: 87.09, y: 51.95 },
        holds: [
          { x: 90.45, y: 43.01 },
          { x: 89.59, y: 58.16 },
          { x: 96.8, y: 52.35 },
        ],
        post: [
          { x: 90.4, y: 44.01 },
          { x: 89.59, y: 58.16 },
          { x: 96.8, y: 52.35 },
          { x: 82.01, y: 51.6 },
        ],
        retake: [
          { x: 77.42, y: 43.36 },
          { x: 77.48, y: 59.36 },
          { x: 69.27, y: 51.15 },
          { x: 81.01, y: 51.55 },
        ],
      },
    },
  },
  Bind: {
    map: 'Bind',
    attackSpawn: [
      { x: 46.74, y: 76.85 },
      { x: 50.89, y: 82.79 },
      { x: 53.71, y: 85.61 },
      { x: 58, y: 91.5 },
      { x: 64.99, y: 89.47 },
    ],
    mid: [
      { x: 33.83, y: 41.54 },
      { x: 42, y: 43.5 },
      { x: 48.96, y: 42.58 },
      { x: 58.31, y: 43.47 },
      { x: 66, y: 41.5 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 27, y: 25 },
        holds: [
          { x: 21.65, y: 32.24 },
          { x: 32.34, y: 18.69 },
          { x: 20.57, y: 20.24 },
        ],
        post: [
          { x: 22.24, y: 31.43 },
          { x: 31.75, y: 18.69 },
          { x: 20.57, y: 20.24 },
          { x: 33.43, y: 29.76 },
        ],
        retake: [
          { x: 32.7, y: 39.16 },
          { x: 42.14, y: 22.11 },
          { x: 36.2, y: 30.42 },
          { x: 34.24, y: 30.35 },
        ],
      },
      B: {
        plant: { x: 72, y: 30 },
        holds: [
          { x: 67.66, y: 21.96 },
          { x: 76.31, y: 37.9 },
          { x: 79.02, y: 26.17 },
        ],
        post: [
          { x: 68.1, y: 23.89 },
          { x: 75.83, y: 37.02 },
          { x: 79.02, y: 26.17 },
          { x: 64.69, y: 33.83 },
        ],
        retake: [
          { x: 57.27, y: 30.56 },
          { x: 64.42, y: 43.25 },
          { x: 57.27, y: 38.13 },
          { x: 64.09, y: 33.98 },
        ],
      },
    },
  },
  Breeze: {
    map: 'Breeze',
    attackSpawn: [
      { x: 72, y: 41.5 },
      { x: 80, y: 43.5 },
      { x: 88, y: 41.5 },
      { x: 96, y: 43.5 },
      { x: 97.49, y: 41.5 },
    ],
    mid: [
      { x: 28.41, y: 54.87 },
      { x: 43.45, y: 51.53 },
      { x: 50, y: 49.5 },
      { x: 57.94, y: 50.97 },
      { x: 66, y: 49.5 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 15, y: 25 },
        holds: [
          { x: 9.47, y: 32.31 },
          { x: 20.23, y: 17.68 },
          { x: 8.49, y: 20.35 },
        ],
        post: [
          { x: 10.35, y: 31.51 },
          { x: 19.65, y: 18.49 },
          { x: 8.49, y: 20.35 },
          { x: 21.51, y: 29.65 },
        ],
        retake: [
          { x: 20.93, y: 39.07 },
          { x: 30.36, y: 26.74 },
          { x: 27.3, y: 33.15 },
          { x: 22.32, y: 30.23 },
        ],
      },
      B: {
        plant: { x: 27.3, y: 84.96 },
        holds: [
          { x: 32.32, y: 90.23 },
          { x: 22.84, y: 74.37 },
          { x: 27.3, y: 84.96 },
        ],
        post: [
          { x: 31.51, y: 89.65 },
          { x: 23.4, y: 75.21 },
          { x: 27.3, y: 84.96 },
          { x: 29.65, y: 78.49 },
        ],
        retake: [
          { x: 39.07, y: 79.07 },
          { x: 25.91, y: 69.64 },
          { x: 36.49, y: 69.36 },
          { x: 30.23, y: 77.68 },
        ],
      },
    },
  },
  Haven: {
    map: 'Haven',
    attackSpawn: [
      { x: 27.6, y: 76.85 },
      { x: 31.31, y: 85.46 },
      { x: 36, y: 83.5 },
      { x: 44, y: 85.5 },
      { x: 52, y: 83.5 },
    ],
    mid: [
      { x: 34, y: 54.5 },
      { x: 42, y: 56.5 },
      { x: 50, y: 54.5 },
      { x: 58.31, y: 56.53 },
      { x: 66, y: 54.5 },
    ],
    siteNames: ['A', 'B', 'C'],
    sites: {
      A: {
        plant: { x: 37, y: 12 },
        holds: [
          { x: 28.39, y: 14.6 },
          { x: 45.61, y: 9.4 },
          { x: 34.27, y: 8.61 },
        ],
        post: [
          { x: 29.34, y: 14.32 },
          { x: 44.66, y: 9.68 },
          { x: 34.27, y: 8.61 },
          { x: 39.32, y: 19.66 },
        ],
        retake: [
          { x: 34.27, y: 26.71 },
          { x: 48.42, y: 22.13 },
          { x: 41.99, y: 27.89 },
          { x: 39.6, y: 20.61 },
        ],
      },
      B: {
        plant: { x: 39, y: 50 },
        holds: [
          { x: 35.28, y: 58.19 },
          { x: 42.73, y: 42.43 },
          { x: 31.75, y: 46.88 },
        ],
        post: [
          { x: 35.69, y: 57.28 },
          { x: 42.31, y: 42.72 },
          { x: 31.75, y: 46.88 },
          { x: 46.28, y: 53.31 },
        ],
        retake: [
          { x: 47.52, y: 62.66 },
          { x: 54.15, y: 48.1 },
          { x: 54.3, y: 58.9 },
          { x: 46.74, y: 53.71 },
        ],
      },
      C: {
        plant: { x: 79.23, y: 34.27 },
        holds: [
          { x: 66.47, y: 27.74 },
          { x: 87.54, y: 42.43 },
          { x: 79.23, y: 34.27 },
        ],
        post: [
          { x: 77, y: 34.27 },
          { x: 86.94, y: 42.43 },
          { x: 79.23, y: 34.27 },
          { x: 75.7, y: 34.93 },
        ],
        retake: [
          { x: 66.47, y: 31.75 },
          { x: 76.68, y: 44.31 },
          { x: 68.6, y: 40.47 },
          { x: 74.91, y: 35.54 },
        ],
      },
    },
  },
  Icebox: {
    map: 'Icebox',
    attackSpawn: [
      { x: 59, y: 79.5 },
      { x: 67, y: 81.5 },
      { x: 75, y: 79.5 },
      { x: 81.75, y: 79.38 },
      { x: 88.13, y: 79.08 },
    ],
    mid: [
      { x: 34, y: 54.5 },
      { x: 42, y: 56.5 },
      { x: 49.11, y: 54.45 },
      { x: 58, y: 56.5 },
      { x: 66, y: 54.5 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 54.6, y: 20.92 },
        holds: [
          { x: 46.1, y: 20.65 },
          { x: 63.9, y: 23.35 },
          { x: 56.2, y: 14.09 },
        ],
        post: [
          { x: 47.09, y: 20.8 },
          { x: 62.91, y: 23.2 },
          { x: 56.2, y: 14.09 },
          { x: 56.23, y: 29.97 },
        ],
        retake: [
          { x: 45.14, y: 33.65 },
          { x: 60.09, y: 36.05 },
          { x: 53.56, y: 38.87 },
          { x: 56.23, y: 30.86 },
        ],
      },
      B: {
        plant: { x: 21.66, y: 51.93 },
        holds: [
          { x: 21.04, y: 60.95 },
          { x: 23.15, y: 43.18 },
          { x: 14.09, y: 54.01 },
        ],
        post: [
          { x: 21.15, y: 59.95 },
          { x: 23.15, y: 44.07 },
          { x: 14.09, y: 54.01 },
          { x: 29.95, y: 52.85 },
        ],
        retake: [
          { x: 34.07, y: 61.34 },
          { x: 35.78, y: 45.43 },
          { x: 38.9, y: 53.81 },
          { x: 30.95, y: 52.96 },
        ],
      },
    },
  },
  Lotus: {
    map: 'Lotus',
    attackSpawn: [
      { x: 36.95, y: 83.28 },
      { x: 45.55, y: 86.51 },
      { x: 52, y: 84.5 },
      { x: 58.85, y: 86.51 },
      { x: 68.04, y: 78.01 },
    ],
    mid: [
      { x: 34.31, y: 54.55 },
      { x: 42, y: 56.5 },
      { x: 50, y: 54.5 },
      { x: 53.37, y: 56.5 },
      { x: 69.4, y: 57.97 },
    ],
    siteNames: ['A', 'B', 'C'],
    sites: {
      A: {
        plant: { x: 15, y: 45 },
        holds: [
          { x: 12.53, y: 53.65 },
          { x: 17.5, y: 35.97 },
          { x: 7.33, y: 44.77 },
        ],
        post: [
          { x: 12.8, y: 52.69 },
          { x: 17.2, y: 37.54 },
          { x: 7.33, y: 44.77 },
          { x: 22.69, y: 47.2 },
        ],
        retake: [
          { x: 25.3, y: 56.26 },
          { x: 29.7, y: 40.88 },
          { x: 30.99, y: 49.85 },
          { x: 23.65, y: 47.47 },
        ],
      },
      B: {
        plant: { x: 48, y: 40 },
        holds: [
          { x: 39.1, y: 40.37 },
          { x: 56.92, y: 38.81 },
          { x: 46.92, y: 29.13 },
        ],
        post: [
          { x: 40.08, y: 40.37 },
          { x: 55.93, y: 38.94 },
          { x: 46.92, y: 29.13 },
          { x: 49.06, y: 47.93 },
        ],
        retake: [
          { x: 41.79, y: 53.94 },
          { x: 57.67, y: 50.54 },
          { x: 50.25, y: 56.85 },
          { x: 49.19, y: 48.92 },
        ],
      },
      C: {
        plant: { x: 88, y: 32 },
        holds: [
          { x: 83.34, y: 24.3 },
          { x: 92.66, y: 39.7 },
          { x: 92.86, y: 27.86 },
        ],
        post: [
          { x: 83.87, y: 24.93 },
          { x: 92.14, y: 38.84 },
          { x: 92.86, y: 27.86 },
          { x: 81.16, y: 36.14 },
        ],
        retake: [
          { x: 72.74, y: 31.89 },
          { x: 81.02, y: 45.58 },
          { x: 73.46, y: 40.8 },
          { x: 80.3, y: 36.66 },
        ],
      },
    },
  },
  Sunset: {
    map: 'Sunset',
    attackSpawn: [
      { x: 33.98, y: 78.34 },
      { x: 46.88, y: 91.54 },
      { x: 50, y: 89.5 },
      { x: 58, y: 91.5 },
      { x: 64.09, y: 87.39 },
    ],
    mid: [
      { x: 33.98, y: 53.12 },
      { x: 43.03, y: 55.49 },
      { x: 50, y: 54.5 },
      { x: 58, y: 56.5 },
      { x: 67.36, y: 53.41 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 13.95, y: 47.03 },
        holds: [
          { x: 11.37, y: 52.61 },
          { x: 16.63, y: 35.39 },
          { x: 6.35, y: 41.66 },
        ],
        post: [
          { x: 11.66, y: 51.65 },
          { x: 16.34, y: 36.35 },
          { x: 6.35, y: 41.66 },
          { x: 21.65, y: 46.34 },
        ],
        retake: [
          { x: 24.04, y: 53.12 },
          { x: 28.19, y: 40.8 },
          { x: 30.26, y: 48.97 },
          { x: 22.61, y: 46.63 },
        ],
      },
      B: {
        plant: { x: 82, y: 37 },
        holds: [
          { x: 78.19, y: 29.23 },
          { x: 86.35, y: 43.62 },
          { x: 88.97, y: 33.08 },
        ],
        post: [
          { x: 78.19, y: 29.97 },
          { x: 85.91, y: 43.62 },
          { x: 88.97, y: 33.08 },
          { x: 75.03, y: 40.92 },
        ],
        retake: [
          { x: 67.36, y: 36.35 },
          { x: 74.59, y: 50.35 },
          { x: 67.36, y: 45.4 },
          { x: 74.16, y: 41.41 },
        ],
      },
    },
  },
}

export function layoutFor(map: string): MapLayout {
  const layout = mapLayouts[map]
  if (!layout) throw new Error(`No layout for ${map}`)
  return layout
}
