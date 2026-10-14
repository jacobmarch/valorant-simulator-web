// Named points on each map's minimap, in a 0-100 square (x right, y down). Players stand only on
// these points, and the round stage view moves them only between them.
//
// Breeze's image is turned 90° clockwise (src/assets/maps/breeze.png) so its attack spawn sits at
// the bottom, like the other maps. Every point was placed on the image and snapped to the nearest
// floor pixel, so none sits on a wall or in a void. Site letters were read from unlabelled images,
// so check them against the game before relying on them. To move a point, edit it here.
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
      { x: 51, y: 87.5 },
      { x: 59, y: 89.5 },
      { x: 67, y: 87.5 },
      { x: 75, y: 89.5 },
      { x: 81.48, y: 83.18 },
    ],
    mid: [
      { x: 34, y: 49.5 },
      { x: 42.04, y: 50.25 },
      { x: 50, y: 49.5 },
      { x: 57.96, y: 50.25 },
      { x: 66, y: 49.5 },
    ],
    flank: [
      { x: 30.73, y: 41.94 },
      { x: 67.77, y: 63.26 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 88, y: 55 },
        entry: [
          { x: 72.47, y: 58.16 },
          { x: 68.17, y: 53.35 },
          { x: 74.17, y: 47.25 },
        ],
        lanes: [
          { x: 56.36, y: 64.96 },
          { x: 62.96, y: 37.24 },
        ],
        lurk: [{ x: 82.98, y: 32.23 }],
        holds: [
          { x: 88.69, y: 49.05 },
          { x: 87.22, y: 60.95 },
          { x: 94.94, y: 55.91 },
          { x: 95.98, y: 47.98 },
          { x: 93.9, y: 63.84 },
        ],
        post: [
          { x: 89.04, y: 47.07 },
          { x: 86.96, y: 62.93 },
          { x: 95.93, y: 56.04 },
          { x: 82.28, y: 53.95 },
        ],
        retake: [
          { x: 74.17, y: 46.95 },
          { x: 71.77, y: 58.86 },
          { x: 71.15, y: 52.78 },
          { x: 82.28, y: 53.85 },
        ],
      },
      B: {
        plant: { x: 12.91, y: 48.05 },
        entry: [
          { x: 22.52, y: 42.74 },
          { x: 30.73, y: 48.95 },
          { x: 23.72, y: 54.95 },
        ],
        lanes: [
          { x: 40.66, y: 35.52 },
          { x: 39.26, y: 63.48 },
        ],
        lurk: [{ x: 16.89, y: 70.37 }],
        holds: [
          { x: 9.7, y: 53.99 },
          { x: 10.3, y: 42.01 },
          { x: 3.2, y: 47.65 },
          { x: 3.2, y: 55.66 },
          { x: 3.4, y: 41.84 },
        ],
        post: [
          { x: 9.6, y: 55.99 },
          { x: 10.41, y: 41.84 },
          { x: 3.2, y: 47.65 },
          { x: 17.99, y: 48.4 },
        ],
        retake: [
          { x: 22.58, y: 56.64 },
          { x: 22.52, y: 40.64 },
          { x: 30.73, y: 48.85 },
          { x: 18.99, y: 48.45 },
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
    flank: [
      { x: 75.07, y: 41.25 },
      { x: 26.01, y: 42.83 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 27, y: 25 },
        entry: [
          { x: 36.2, y: 28.49 },
          { x: 42.58, y: 41.1 },
          { x: 33.83, y: 38.13 },
        ],
        lanes: [
          { x: 59.45, y: 31.57 },
          { x: 42.8, y: 54.09 },
        ],
        lurk: [{ x: 20.36, y: 47.45 }],
        holds: [
          { x: 23.43, y: 29.83 },
          { x: 30.57, y: 20.17 },
          { x: 21.37, y: 20.84 },
          { x: 16.62, y: 27.27 },
          { x: 26.11, y: 18.69 },
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
        entry: [
          { x: 62.58, y: 41.97 },
          { x: 57.27, y: 38.13 },
          { x: 57.27, y: 31.45 },
        ],
        lanes: [
          { x: 52.37, y: 56.66 },
          { x: 36.2, y: 30.42 },
        ],
        lurk: [{ x: 54.44, y: 14.52 }],
        holds: [
          { x: 69.13, y: 24.73 },
          { x: 74.87, y: 35.27 },
          { x: 78.15, y: 26.65 },
          { x: 74.31, y: 19.62 },
          { x: 80.56, y: 35.16 },
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
      { x: 42.06, y: 87.19 },
      { x: 50, y: 89.5 },
      { x: 58, y: 87.5 },
      { x: 64.9, y: 88.86 },
      { x: 69.64, y: 82.45 },
    ],
    mid: [
      { x: 34, y: 49.5 },
      { x: 42.06, y: 51.25 },
      { x: 50.14, y: 49.86 },
      { x: 58, y: 51.5 },
      { x: 66, y: 49.5 },
    ],
    flank: [
      { x: 73.54, y: 45.68 },
      { x: 26.33, y: 53.95 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 75, y: 15 },
        entry: [
          { x: 71.75, y: 29.88 },
          { x: 61.84, y: 31.2 },
          { x: 62.12, y: 22.28 },
        ],
        lanes: [
          { x: 68.96, y: 47.55 },
          { x: 44.29, y: 29.25 },
        ],
        lurk: [{ x: 52.37, y: 8.91 }],
        holds: [
          { x: 70.12, y: 11.51 },
          { x: 79.88, y: 18.49 },
          { x: 79.07, y: 9.3 },
          { x: 72.56, y: 4.65 },
          { x: 81.89, y: 13.93 },
        ],
        post: [
          { x: 68.49, y: 10.35 },
          { x: 81.51, y: 19.65 },
          { x: 79.65, y: 8.49 },
          { x: 70.35, y: 21.51 },
        ],
        retake: [
          { x: 60.93, y: 20.93 },
          { x: 73.26, y: 30.36 },
          { x: 66.85, y: 27.3 },
          { x: 69.77, y: 22.32 },
        ],
      },
      B: {
        plant: { x: 15.04, y: 27.3 },
        entry: [
          { x: 27.86, y: 26.18 },
          { x: 31.27, y: 36.62 },
          { x: 22.84, y: 39 },
        ],
        lanes: [
          { x: 45.13, y: 28.41 },
          { x: 31.27, y: 53.83 },
        ],
        lurk: [{ x: 8.72, y: 47.55 }],
        holds: [
          { x: 11.51, y: 29.88 },
          { x: 23.4, y: 24.51 },
          { x: 15.04, y: 27.3 },
          { x: 9.47, y: 31.48 },
          { x: 23.68, y: 24.23 },
        ],
        post: [
          { x: 10.35, y: 31.51 },
          { x: 24.79, y: 23.4 },
          { x: 15.04, y: 27.3 },
          { x: 21.51, y: 29.65 },
        ],
        retake: [
          { x: 20.93, y: 39.07 },
          { x: 30.36, y: 25.91 },
          { x: 30.64, y: 36.49 },
          { x: 22.32, y: 30.23 },
        ],
      },
    },
  },
  Haven: {
    map: 'Haven',
    attackSpawn: [
      { x: 48, y: 15.5 },
      { x: 56, y: 17.5 },
      { x: 64, y: 15.5 },
      { x: 68.69, y: 17.51 },
      { x: 72.4, y: 23.15 },
    ],
    mid: [
      { x: 33.98, y: 44.96 },
      { x: 42, y: 46.5 },
      { x: 50, y: 44.5 },
      { x: 58, y: 46.5 },
      { x: 66, y: 44.5 },
    ],
    flank: [
      { x: 26.14, y: 42.39 },
      { x: 74.48, y: 47.63 },
    ],
    siteNames: ['A', 'B', 'C'],
    sites: {
      A: {
        plant: { x: 63, y: 88 },
        entry: [
          { x: 53.21, y: 76.34 },
          { x: 57.72, y: 68.84 },
          { x: 64.69, y: 72.86 },
        ],
        lanes: [
          { x: 40.92, y: 63.34 },
          { x: 67.72, y: 55.23 },
        ],
        lurk: [{ x: 78.49, y: 74.04 }],
        holds: [
          { x: 68.74, y: 86.26 },
          { x: 57.26, y: 89.74 },
          { x: 65.73, y: 91.39 },
          { x: 70.62, y: 89.76 },
          { x: 57.42, y: 91.39 },
        ],
        post: [
          { x: 70.66, y: 85.68 },
          { x: 55.34, y: 90.32 },
          { x: 65.73, y: 91.39 },
          { x: 60.68, y: 80.34 },
        ],
        retake: [
          { x: 65.73, y: 73.29 },
          { x: 51.58, y: 77.87 },
          { x: 58.01, y: 72.11 },
          { x: 60.4, y: 79.39 },
        ],
      },
      B: {
        plant: { x: 61, y: 50 },
        entry: [
          { x: 45.77, y: 49.67 },
          { x: 42.73, y: 41.1 },
          { x: 50.74, y: 38.74 },
        ],
        lanes: [
          { x: 27.74, y: 52.37 },
          { x: 39.47, y: 21.51 },
        ],
        lurk: [{ x: 62.82, y: 26.66 }],
        holds: [
          { x: 63.48, y: 44.54 },
          { x: 58.52, y: 55.46 },
          { x: 67.37, y: 52.9 },
          { x: 70.62, y: 47.18 },
          { x: 63.35, y: 60.24 },
        ],
        post: [
          { x: 64.31, y: 42.72 },
          { x: 57.69, y: 57.28 },
          { x: 68.25, y: 53.12 },
          { x: 53.72, y: 46.69 },
        ],
        retake: [
          { x: 52.48, y: 37.34 },
          { x: 45.85, y: 51.9 },
          { x: 45.7, y: 41.1 },
          { x: 53.26, y: 46.29 },
        ],
      },
      C: {
        plant: { x: 20.77, y: 65.73 },
        entry: [
          { x: 25.34, y: 56.65 },
          { x: 33.83, y: 57.86 },
          { x: 32.79, y: 65.73 },
        ],
        lanes: [
          { x: 33.02, y: 40.5 },
          { x: 50.26, y: 62.56 },
        ],
        lurk: [{ x: 38.87, y: 81.16 }],
        holds: [
          { x: 21.66, y: 65.73 },
          { x: 20.77, y: 65.28 },
          { x: 20.77, y: 65.73 },
          { x: 20.77, y: 65.73 },
          { x: 7.57, y: 57.57 },
        ],
        post: [
          { x: 23, y: 65.73 },
          { x: 13.06, y: 57.57 },
          { x: 20.77, y: 65.73 },
          { x: 24.3, y: 65.07 },
        ],
        retake: [
          { x: 33.53, y: 68.25 },
          { x: 23.32, y: 55.69 },
          { x: 31.4, y: 59.53 },
          { x: 25.09, y: 64.46 },
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
    flank: [
      { x: 70.22, y: 42.08 },
      { x: 29.78, y: 67.92 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 54.6, y: 20.92 },
        entry: [
          { x: 58.84, y: 36.74 },
          { x: 53.56, y: 41.84 },
          { x: 46.97, y: 34.94 },
        ],
        lanes: [
          { x: 64.35, y: 53.76 },
          { x: 33.83, y: 49.55 },
        ],
        lurk: [{ x: 36.2, y: 32.2 }],
        holds: [
          { x: 49.11, y: 20.92 },
          { x: 60.93, y: 22.9 },
          { x: 56.05, y: 15.08 },
          { x: 48.14, y: 13.88 },
          { x: 63.96, y: 16.28 },
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
        entry: [
          { x: 36.5, y: 45.99 },
          { x: 41.89, y: 54.13 },
          { x: 35.28, y: 59.46 },
        ],
        lanes: [
          { x: 53.56, y: 41.25 },
          { x: 50.34, y: 69.12 },
        ],
        lurk: [{ x: 27.61, y: 74.73 }],
        holds: [
          { x: 21.36, y: 57.97 },
          { x: 23.15, y: 45.99 },
          { x: 14.99, y: 54.01 },
          { x: 14.19, y: 59.21 },
          { x: 18.4, y: 44.21 },
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
    flank: [
      { x: 73.99, y: 55.5 },
      { x: 26.01, y: 54.5 },
    ],
    siteNames: ['A', 'B', 'C'],
    sites: {
      A: {
        plant: { x: 15, y: 45 },
        entry: [
          { x: 30.11, y: 43.08 },
          { x: 33.43, y: 49.07 },
          { x: 26.81, y: 54.62 },
        ],
        lanes: [
          { x: 47.69, y: 39.78 },
          { x: 43.3, y: 66.67 },
        ],
        lurk: [{ x: 22.39, y: 66.47 }],
        holds: [
          { x: 13.35, y: 50.77 },
          { x: 16.65, y: 39.23 },
          { x: 8.31, y: 44.77 },
          { x: 6.07, y: 50.77 },
          { x: 10.47, y: 35.38 },
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
        entry: [
          { x: 53.37, y: 53.08 },
          { x: 50.64, y: 59.82 },
          { x: 43.9, y: 54.67 },
        ],
        lanes: [
          { x: 65.84, y: 67.89 },
          { x: 38.09, y: 71.59 },
        ],
        lurk: [{ x: 27.25, y: 50.84 }],
        holds: [
          { x: 42.03, y: 41.15 },
          { x: 53.96, y: 38.91 },
          { x: 47.12, y: 35.78 },
          { x: 39.15, y: 34.12 },
          { x: 55.82, y: 31.96 },
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
        entry: [
          { x: 77.13, y: 44.38 },
          { x: 71.26, y: 42.33 },
          { x: 72.92, y: 34.12 },
        ],
        lanes: [
          { x: 69.58, y: 59.51 },
          { x: 55.09, y: 35.56 },
        ],
        lurk: [{ x: 69.76, y: 17.32 }],
        holds: [
          { x: 84.89, y: 26.87 },
          { x: 91.11, y: 37.13 },
          { x: 92.86, y: 28.35 },
          { x: 89.85, y: 21.53 },
          { x: 92.86, y: 35.19 },
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
    flank: [
      { x: 73.77, y: 51.72 },
      { x: 26.26, y: 59.5 },
    ],
    siteNames: ['A', 'B'],
    sites: {
      A: {
        plant: { x: 13.95, y: 47.03 },
        entry: [
          { x: 29.14, y: 42.35 },
          { x: 33.13, y: 49.84 },
          { x: 25.67, y: 53.12 },
        ],
        lanes: [
          { x: 46.78, y: 39.38 },
          { x: 38.6, y: 66.16 },
        ],
        lurk: [{ x: 15.28, y: 67.21 }],
        holds: [
          { x: 12.25, y: 49.74 },
          { x: 15.75, y: 38.26 },
          { x: 7.31, y: 41.95 },
          { x: 4.97, y: 49.61 },
          { x: 9.64, y: 34.42 },
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
        entry: [
          { x: 72.74, y: 49.09 },
          { x: 67.36, y: 46.74 },
          { x: 67.36, y: 38.58 },
        ],
        lanes: [
          { x: 62.02, y: 63.2 },
          { x: 48.99, y: 39.51 },
        ],
        lurk: [{ x: 64.24, y: 21.75 }],
        holds: [
          { x: 79.06, y: 31.77 },
          { x: 84.94, y: 42.23 },
          { x: 88.1, y: 33.57 },
          { x: 84.18, y: 26.6 },
          { x: 92.02, y: 40.54 },
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
