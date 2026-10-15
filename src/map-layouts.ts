// Named points on each map's minimap, in a 0-100 square (x right, y down). Players stand only on
// these points, and the round stage view moves them only between them.
//
// Each map's minimap is turned so its sites sit above the mid and the attack spawn sits at the
// bottom. The highlighted zones on the source images are the sites, and each one is a site point.
// Site letters follow left-to-right order after the turn, which is a guess for the images without
// labels, so check them against the game. Haven's letters were set by hand, so B is the middle site
// with A and C on the outside, as on Lotus. Every point was placed on the turned image and snapped to
// the nearest floor pixel, so none sits on a wall or in a void. To move a point, edit it here.
//
// Attackers spread out across these points rather than moving as one group: some take the site's
// entry, some take its lanes, and a lurker (a Sentinel or Controller, when the team has one) takes
// the lurk spot. `flank` points are where attackers wait on mid when no site has been taken.

export type Point = { x: number; y: number }
export type SiteLayout = {
  /** Spike spot, the centre of the site. */
  plant: Point
  /** Where attackers come in to the site from mid. */
  entry: Point[]
  /** Lanes that lead to the site, away from its entry. */
  lanes: Point[]
  /** A flank spot off the site, where a lurker waits. */
  lurk: Point[]
  /** Where defenders hold the site before the round is decided. */
  holds: Point[]
  /** Where attackers stand round a planted spike. */
  post: Point[]
  /** Where defenders come from to retake the site. */
  retake: Point[]
}
export type MapLayout = {
  map: string
  /** Attack spawn, where attackers start the round. */
  attackSpawn: Point[]
  /** Mid, where attackers gather before picking a site. */
  mid: Point[]
  /** Points either side of mid, for attackers who hold back when no site is taken. */
  flank: Point[]
  siteNames: string[]
  sites: Record<string, SiteLayout>
}

export const mapLayouts: Record<string, MapLayout> = {
  Abyss: {
    map: 'Abyss',
    attackSpawn: [
      { x: 32.23, y: 87.29 },
      { x: 42, y: 91.5 },
      { x: 51.75, y: 89.49 },
      { x: 58, y: 91.5 },
      { x: 62.86, y: 89.49 },
    ],
    mid: [
      { x: 33.73, y: 46.75 },
      { x: 43.64, y: 51.45 },
      { x: 50, y: 49.5 },
      { x: 57.96, y: 50.65 },
      { x: 66, y: 49.5 },
    ],
    flank: [
      { x: 73.99, y: 49.24 },
      { x: 26.03, y: 46.75 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 9, y: 36.4 },
        entry: [
          { x: 23.52, y: 35.84 },
          { x: 27.98, y: 42.7 },
          { x: 20.4, y: 46.5 },
        ],
        lanes: [
          { x: 41.84, y: 33.93 },
          { x: 33.07, y: 59.13 },
        ],
        lurk: [{ x: 9.71, y: 60.46 }],
        holds: [
          { x: 7.11, y: 42.09 },
          { x: 10.91, y: 31.43 },
          { x: 2.36, y: 34.2 },
          { x: 1.6, y: 41.74 },
          { x: 4.9, y: 31.43 },
        ],
        post: [
          { x: 6.48, y: 43.99 },
          { x: 11.51, y: 31.43 },
          { x: 1.41, y: 33.88 },
          { x: 16.59, y: 38.92 },
        ],
        retake: [
          { x: 18.82, y: 46.75 },
          { x: 22.32, y: 32.93 },
          { x: 25.13, y: 41.94 },
          { x: 17.54, y: 39.23 },
        ],
      },
      B: {
        plant: { x: 90.3, y: 41.4 },
        entry: [
          { x: 77.86, y: 50.19 },
          { x: 71.17, y: 45.55 },
          { x: 75.36, y: 38.45 },
        ],
        lanes: [
          { x: 63.88, y: 61.35 },
          { x: 58.04, y: 33.97 },
        ],
        lurk: [{ x: 77.88, y: 19.22 }],
        holds: [
          { x: 89.05, y: 35.53 },
          { x: 91.59, y: 49.95 },
          { x: 97.15, y: 39.94 },
          { x: 95.48, y: 32.12 },
          { x: 96.9, y: 48.55 },
        ],
        post: [
          { x: 88.63, y: 33.58 },
          { x: 91.99, y: 49.95 },
          { x: 98.12, y: 39.73 },
          { x: 82.48, y: 43.07 },
        ],
        retake: [
          { x: 75.92, y: 36.29 },
          { x: 79.26, y: 51.94 },
          { x: 73.67, y: 44.95 },
          { x: 81.5, y: 43.28 },
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
      { x: 33.83, y: 48.81 },
      { x: 42, y: 51.5 },
      { x: 50.74, y: 50.59 },
      { x: 58, y: 51.5 },
      { x: 64.09, y: 49.55 },
    ],
    flank: [
      { x: 71.96, y: 50.89 },
      { x: 29.38, y: 48.81 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 29, y: 26.9 },
        entry: [
          { x: 36.2, y: 30.42 },
          { x: 42.45, y: 41.7 },
          { x: 33.83, y: 41.25 },
        ],
        lanes: [
          { x: 60.39, y: 39.76 },
          { x: 38.82, y: 58.52 },
        ],
        lurk: [{ x: 18.1, y: 47.62 }],
        holds: [
          { x: 24.56, y: 30.94 },
          { x: 33.44, y: 22.86 },
          { x: 24.29, y: 21.72 },
          { x: 18.37, y: 27.1 },
          { x: 30.27, y: 18.69 },
        ],
        post: [
          { x: 23.08, y: 32.28 },
          { x: 34.92, y: 21.52 },
          { x: 23.62, y: 20.98 },
          { x: 33.83, y: 32.79 },
        ],
        retake: [
          { x: 31.83, y: 41.9 },
          { x: 36.2, y: 30.42 },
          { x: 40.5, y: 41.25 },
          { x: 33.83, y: 33.53 },
        ],
      },
      B: {
        plant: { x: 72.4, y: 32.2 },
        entry: [
          { x: 64.09, y: 45.55 },
          { x: 58.31, y: 44.66 },
          { x: 57.71, y: 36.21 },
        ],
        lanes: [
          { x: 53.41, y: 60.53 },
          { x: 40.21, y: 41.25 },
        ],
        lurk: [{ x: 55.04, y: 17.66 }],
        holds: [
          { x: 68.67, y: 27.5 },
          { x: 76.13, y: 36.9 },
          { x: 77.88, y: 27.85 },
          { x: 72.9, y: 21.58 },
          { x: 81.31, y: 35.31 },
        ],
        post: [
          { x: 67.42, y: 25.94 },
          { x: 77.38, y: 38.46 },
          { x: 78.66, y: 27.22 },
          { x: 66.14, y: 37.18 },
        ],
        retake: [
          { x: 57.25, y: 34.02 },
          { x: 64.09, y: 46.59 },
          { x: 59.05, y: 43.47 },
          { x: 65.35, y: 37.8 },
        ],
      },
    },
  },
  Breeze: {
    map: 'Breeze',
    attackSpawn: [
      { x: 34, y: 89.5 },
      { x: 42, y: 91.5 },
      { x: 50, y: 89.5 },
      { x: 64.35, y: 84.96 },
      { x: 66.85, y: 86.63 },
    ],
    mid: [
      { x: 28.41, y: 54.87 },
      { x: 43.45, y: 51.53 },
      { x: 50, y: 49.5 },
      { x: 57.94, y: 50.97 },
      { x: 66, y: 49.5 },
    ],
    flank: [
      { x: 73.85, y: 52.67 },
      { x: 26.15, y: 47.33 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 14.48, y: 28.13 },
        entry: [
          { x: 29.69, y: 30.78 },
          { x: 31.74, y: 39.01 },
          { x: 23.96, y: 40.95 },
        ],
        lanes: [
          { x: 47.52, y: 32.17 },
          { x: 31.48, y: 57.66 },
        ],
        lurk: [{ x: 10.11, y: 51.68 }],
        holds: [
          { x: 11.51, y: 33.84 },
          { x: 17.69, y: 23.56 },
          { x: 8.6, y: 25.09 },
          { x: 4.48, y: 31.95 },
          { x: 12.73, y: 18.24 },
        ],
        post: [
          { x: 10.48, y: 35.55 },
          { x: 18.72, y: 21.85 },
          { x: 7.75, y: 24.58 },
          { x: 21.45, y: 32.82 },
        ],
        retake: [
          { x: 23.68, y: 42.34 },
          { x: 29.86, y: 28.55 },
          { x: 29.25, y: 38.16 },
          { x: 22.31, y: 33.34 },
        ],
      },
      B: {
        plant: { x: 88.3, y: 45.4 },
        entry: [
          { x: 75.12, y: 53.03 },
          { x: 68.44, y: 47.78 },
          { x: 73.68, y: 41.11 },
        ],
        lanes: [
          { x: 61.28, y: 62.95 },
          { x: 53.2, y: 35.1 },
        ],
        lurk: [{ x: 75.21, y: 24.51 }],
        holds: [
          { x: 87.58, y: 39.44 },
          { x: 89.02, y: 51.36 },
          { x: 95.25, y: 44.57 },
          { x: 93.04, y: 37.88 },
          { x: 93.87, y: 50.97 },
        ],
        post: [
          { x: 87.35, y: 37.46 },
          { x: 89.25, y: 53.34 },
          { x: 96.24, y: 44.45 },
          { x: 80.36, y: 46.35 },
        ],
        retake: [
          { x: 74.44, y: 39.01 },
          { x: 77.44, y: 54.87 },
          { x: 71.42, y: 47.43 },
          { x: 79.36, y: 46.47 },
        ],
      },
    },
  },
  Haven: {
    map: 'Haven',
    attackSpawn: [
      { x: 40.21, y: 83.23 },
      { x: 41.99, y: 91.39 },
      { x: 50, y: 88.43 },
      { x: 58.01, y: 91.39 },
      { x: 66, y: 89.5 },
    ],
    mid: [
      { x: 34, y: 49.5 },
      { x: 42, y: 51.5 },
      { x: 50, y: 49.5 },
      { x: 58, y: 51.5 },
      { x: 66, y: 49.5 },
    ],
    flank: [
      { x: 50.89, y: 73.89 },
      { x: 52.09, y: 26.09 },
    ],
    siteNames: ['A', 'B', 'C'],
    sites: {
      A: {
        plant: { x: 62.6, y: 86.5 },
        entry: [
          { x: 52.36, y: 75.22 },
          { x: 55.19, y: 67.66 },
          { x: 63.65, y: 72.11 },
        ],
        lanes: [
          { x: 39.58, y: 62.71 },
          { x: 66.04, y: 53.57 },
        ],
        lurk: [{ x: 80.71, y: 70.33 }],
        holds: [
          { x: 68.27, y: 84.54 },
          { x: 56.93, y: 88.46 },
          { x: 65.73, y: 91.39 },
          { x: 70.62, y: 89.76 },
          { x: 57.27, y: 91.39 },
        ],
        post: [
          { x: 70.16, y: 83.89 },
          { x: 55.04, y: 89.11 },
          { x: 65.73, y: 91.39 },
          { x: 59.99, y: 78.94 },
        ],
        retake: [
          { x: 65.73, y: 72.11 },
          { x: 50.89, y: 76.85 },
          { x: 57.72, y: 70.33 },
          { x: 59.66, y: 77.99 },
        ],
      },
      B: {
        plant: { x: 60.7, y: 50.5 },
        entry: [
          { x: 46.44, y: 53.12 },
          { x: 40.72, y: 49.57 },
          { x: 47.77, y: 43.92 },
        ],
        lanes: [
          { x: 30.08, y: 63.08 },
          { x: 31.39, y: 35.11 },
        ],
        lurk: [{ x: 53.74, y: 28.15 }],
        holds: [
          { x: 60.98, y: 44.51 },
          { x: 60.42, y: 56.49 },
          { x: 67.69, y: 50.83 },
          { x: 66.91, y: 43.92 },
          { x: 66.02, y: 57.27 },
        ],
        post: [
          { x: 61.13, y: 42.73 },
          { x: 60.33, y: 58.49 },
          { x: 68.69, y: 50.87 },
          { x: 52.71, y: 50.13 },
        ],
        retake: [
          { x: 48.07, y: 41.1 },
          { x: 47.33, y: 59.94 },
          { x: 43.72, y: 49.71 },
          { x: 51.71, y: 50.08 },
        ],
      },
      C: {
        plant: { x: 64.5, y: 16.3 },
        entry: [
          { x: 64.48, y: 31.53 },
          { x: 56.23, y: 34.72 },
          { x: 53.46, y: 26.79 },
        ],
        lanes: [
          { x: 65.5, y: 49.39 },
          { x: 39.78, y: 38.32 },
        ],
        lurk: [{ x: 41.13, y: 14.95 }],
        holds: [
          { x: 58.99, y: 13.93 },
          { x: 68.69, y: 18.69 },
          { x: 67.27, y: 9.87 },
          { x: 59.94, y: 8.01 },
          { x: 68.69, y: 13.06 },
        ],
        post: [
          { x: 57.15, y: 13.14 },
          { x: 68.69, y: 19.44 },
          { x: 67.66, y: 8.95 },
          { x: 61.34, y: 23.65 },
        ],
        retake: [
          { x: 52.01, y: 25.08 },
          { x: 66.71, y: 31.4 },
          { x: 57.78, y: 31.92 },
          { x: 60.94, y: 24.57 },
        ],
      },
    },
  },
  Icebox: {
    map: 'Icebox',
    attackSpawn: [
      { x: 43.47, y: 81.45 },
      { x: 44.21, y: 81.6 },
      { x: 54.01, y: 89.47 },
      { x: 58, y: 91.5 },
      { x: 63.65, y: 89.47 },
    ],
    mid: [
      { x: 35.46, y: 51.19 },
      { x: 42, y: 51.5 },
      { x: 50, y: 49.5 },
      { x: 58.01, y: 53.41 },
      { x: 66, y: 49.5 },
    ],
    flank: [
      { x: 73.93, y: 51.83 },
      { x: 26.11, y: 51.48 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 21.4, y: 38.8 },
        entry: [
          { x: 36.65, y: 37.09 },
          { x: 40.02, y: 46.09 },
          { x: 32.2, y: 51.48 },
        ],
        lanes: [
          { x: 54.44, y: 36.7 },
          { x: 44.23, y: 62.78 },
        ],
        lurk: [{ x: 20.77, y: 61.42 }],
        holds: [
          { x: 19.21, y: 44.39 },
          { x: 23.59, y: 33.21 },
          { x: 14.88, y: 36.25 },
          { x: 11.96, y: 43.7 },
          { x: 17.8, y: 28.8 },
        ],
        post: [
          { x: 18.48, y: 46.25 },
          { x: 24.32, y: 31.35 },
          { x: 13.95, y: 35.88 },
          { x: 28.85, y: 41.72 },
        ],
        retake: [
          { x: 30.56, y: 51.48 },
          { x: 36.42, y: 36.09 },
          { x: 37.23, y: 45 },
          { x: 29.78, y: 42.08 },
        ],
      },
      B: {
        plant: { x: 81.2, y: 27.2 },
        entry: [
          { x: 74.33, y: 40.36 },
          { x: 64.39, y: 39.02 },
          { x: 66.36, y: 30.62 },
        ],
        lanes: [
          { x: 65.24, y: 56.2 },
          { x: 48.72, y: 33.6 },
        ],
        lurk: [{ x: 61.76, y: 14.16 }],
        holds: [
          { x: 77.66, y: 22.36 },
          { x: 84.74, y: 32.04 },
          { x: 86.85, y: 23.07 },
          { x: 79.38, y: 18.25 },
          { x: 90.8, y: 29.53 },
        ],
        post: [
          { x: 76.48, y: 20.74 },
          { x: 85.92, y: 33.66 },
          { x: 87.66, y: 22.48 },
          { x: 74.74, y: 31.92 },
        ],
        retake: [
          { x: 65.98, y: 28.41 },
          { x: 75.42, y: 41.33 },
          { x: 64.39, y: 37.24 },
          { x: 73.89, y: 32.34 },
        ],
      },
    },
  },
  Lotus: {
    map: 'Lotus',
    attackSpawn: [
      { x: 39.2, y: 84.36 },
      { x: 45.55, y: 89.35 },
      { x: 50.05, y: 89.35 },
      { x: 57.97, y: 89.35 },
      { x: 58.85, y: 89.35 },
    ],
    mid: [
      { x: 33.43, y: 49.07 },
      { x: 42, y: 51.5 },
      { x: 50, y: 49.5 },
      { x: 57.97, y: 50.54 },
      { x: 66.57, y: 48.88 },
    ],
    flank: [
      { x: 73.95, y: 48.47 },
      { x: 26.05, y: 51.53 },
    ],
    siteNames: ['A', 'B', 'C'],
    sites: {
      A: {
        plant: { x: 14.9, y: 42.6 },
        entry: [
          { x: 29.84, y: 39.62 },
          { x: 33.43, y: 46.73 },
          { x: 27.36, y: 51.36 },
        ],
        lanes: [
          { x: 47.12, y: 35.78 },
          { x: 43.3, y: 62.56 },
        ],
        lurk: [{ x: 22.39, y: 65.79 }],
        holds: [
          { x: 13.66, y: 48.47 },
          { x: 16.13, y: 35.97 },
          { x: 11.53, y: 41.15 },
          { x: 6.4, y: 48.98 },
          { x: 9.7, y: 33.33 },
        ],
        post: [
          { x: 13.25, y: 50.43 },
          { x: 16.55, y: 34.77 },
          { x: 7.04, y: 44.77 },
          { x: 22.73, y: 44.25 },
        ],
        retake: [
          { x: 25.97, y: 53.11 },
          { x: 29.42, y: 37.44 },
          { x: 31.53, y: 46.11 },
          { x: 23.71, y: 44.46 },
        ],
      },
      B: {
        plant: { x: 46.92, y: 42.62 },
        entry: [
          { x: 57.87, y: 50.54 },
          { x: 53.37, y: 61.09 },
          { x: 46.85, y: 57.93 },
        ],
        lanes: [
          { x: 71.51, y: 64.84 },
          { x: 45.74, y: 75.79 },
        ],
        lurk: [{ x: 29.78, y: 58.66 }],
        holds: [
          { x: 41.94, y: 45.06 },
          { x: 52.42, y: 40.35 },
          { x: 44.16, y: 36.26 },
          { x: 36.8, y: 39.38 },
          { x: 51.52, y: 33.92 },
        ],
        post: [
          { x: 41.94, y: 45.85 },
          { x: 54.25, y: 39.69 },
          { x: 43.79, y: 35.78 },
          { x: 50.03, y: 50.06 },
        ],
        retake: [
          { x: 44.62, y: 57.79 },
          { x: 59.34, y: 50.54 },
          { x: 53.37, y: 58.36 },
          { x: 50.44, y: 50.54 },
        ],
      },
      C: {
        plant: { x: 86.1, y: 31.8 },
        entry: [
          { x: 76.3, y: 43.46 },
          { x: 71.26, y: 40.76 },
          { x: 71.65, y: 32.94 },
        ],
        lanes: [
          { x: 67.64, y: 59.92 },
          { x: 52.98, y: 33.92 },
        ],
        lurk: [{ x: 69.05, y: 15.76 }],
        holds: [
          { x: 83.4, y: 26.44 },
          { x: 88.8, y: 37.16 },
          { x: 92.35, y: 28.65 },
          { x: 88.75, y: 21.51 },
          { x: 92.86, y: 35.78 },
        ],
        post: [
          { x: 82.5, y: 24.66 },
          { x: 89.7, y: 38.94 },
          { x: 92.86, y: 28.15 },
          { x: 79.57, y: 35.39 },
        ],
        retake: [
          { x: 70.87, y: 29.72 },
          { x: 77.13, y: 44.77 },
          { x: 71.26, y: 39.49 },
          { x: 77.32, y: 35.97 },
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
      { x: 34, y: 49.5 },
      { x: 42, y: 51.5 },
      { x: 50, y: 49.5 },
      { x: 58, y: 51.5 },
      { x: 67.36, y: 49.55 },
    ],
    flank: [
      { x: 72.4, y: 46.44 },
      { x: 26.41, y: 53.12 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 13.95, y: 40.5 },
        entry: [
          { x: 28.04, y: 39.91 },
          { x: 33.65, y: 46.91 },
          { x: 26.64, y: 51.69 },
        ],
        lanes: [
          { x: 46.14, y: 34.27 },
          { x: 40.88, y: 62.52 },
        ],
        lurk: [{ x: 17.78, y: 66.3 }],
        holds: [
          { x: 12.89, y: 49.1 },
          { x: 15.11, y: 37.3 },
          { x: 7.12, y: 41.9 },
          { x: 5.64, y: 49.76 },
          { x: 8.61, y: 34.42 },
        ],
        post: [
          { x: 12.52, y: 51.06 },
          { x: 15.48, y: 35.34 },
          { x: 6.14, y: 41.72 },
          { x: 21.86, y: 44.68 },
        ],
        retake: [
          { x: 25.22, y: 53.12 },
          { x: 28.04, y: 37.69 },
          { x: 30.7, y: 46.36 },
          { x: 22.84, y: 44.87 },
        ],
      },
      B: {
        plant: { x: 82.2, y: 37.3 },
        entry: [
          { x: 71.38, y: 48.02 },
          { x: 60.83, y: 44.66 },
          { x: 67.36, y: 36.8 },
        ],
        lanes: [
          { x: 59.43, y: 61.33 },
          { x: 49.16, y: 35.28 },
        ],
        lurk: [{ x: 66.69, y: 19.77 }],
        holds: [
          { x: 80, y: 31.72 },
          { x: 84.4, y: 42.88 },
          { x: 88.72, y: 33.83 },
          { x: 85.78, y: 27.29 },
          { x: 91.65, y: 42.17 },
        ],
        post: [
          { x: 79.26, y: 29.86 },
          { x: 85.16, y: 43.62 },
          { x: 89.61, y: 33.83 },
          { x: 74.76, y: 40.24 },
        ],
        retake: [
          { x: 67.36, y: 34.57 },
          { x: 73.04, y: 49.51 },
          { x: 67.36, y: 43.47 },
          { x: 73.83, y: 40.6 },
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
