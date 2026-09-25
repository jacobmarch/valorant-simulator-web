import { mapPool } from './map-data'
export type Region = 'Americas' | 'EMEA' | 'Pacific' | 'China'
export type Role = 'Duelist' | 'Initiator' | 'Controller' | 'Sentinel' | 'Flex'

export type SeedTeam = {
  id: string
  name: string
  short: string
  region: Region
  color: string
  players: string[]
}

// Static 2026 snapshot. Team membership follows the official 2026 VCT league handbook.
export const seedTeams: SeedTeam[] = (
  [
    ['envy', 'ENVY', 'ENVY', 'Americas', '#f0c04a', ['yay', 'Victor', 'crashies', 'mada', 'valyn']],
    [
      'eg',
      'Evil Geniuses',
      'EG',
      'Americas',
      '#8b5cf6',
      ['Derrek', 'supamen', 'Apoth', 'C0M', 'BcJ'],
    ],
    [
      'loud',
      'LOUD',
      'LOUD',
      'Americas',
      '#b7ff43',
      ['saadhak', 'cauanzin', 'tuyz', 'pANcada', 'qck'],
    ],
    ['c9', 'Cloud9', 'C9', 'Americas', '#6ca8ff', ['OXY', 'vanity', 'Xeppaa', 'moose', 'runneR']],
    ['kru', 'KRÜ Visa', 'KRU', 'Americas', '#ee3d59', ['keznit', 'Klaus', 'Melser', 'Shyy', 'mta']],
    [
      'furia',
      'FURIA',
      'FUR',
      'Americas',
      '#e8c547',
      ['mwzera', 'xand', 'havoc', 'liazzi', 'Khalil'],
    ],
    [
      '100t',
      '100 Thieves',
      '100T',
      'Americas',
      '#e8e1d5',
      ['Asuna', 'bang', 'Cryocells', 'eeiu', 'Boostio'],
    ],
    ['lev', 'Leviatán', 'LEV', 'Americas', '#0d80ff', ['aspas', 'kiNgg', 'tex', 'C0M', 'mazino']],
    ['nrg', 'NRG', 'NRG', 'Americas', '#f15a29', ['Ethan', 's0m', 'FNS', 'Victor', 'Buddha']],
    ['mibr', 'MIBR', 'MIBR', 'Americas', '#0b5cff', ['artzin', 'frz', 'richzin', 'kon4n', 'mazin']],
    [
      'sen',
      'Sentinels',
      'SEN',
      'Americas',
      '#e5234f',
      ['johnqt', 'zekken', 'TenZ', 'zellsis', 'Sacy'],
    ],
    [
      'g2',
      'G2 Esports',
      'G2',
      'Americas',
      '#f1f1f1',
      ['valyn', 'trent', 'leaf', 'JonahP', 'jawgemo'],
    ],
    ['navi', 'NAVI', 'NAVI', 'EMEA', '#f5d90a', ['ardiis', 'Shao', 'cNed', 'ANGE1', 'Zyppan']],
    ['kc', 'Karmine Corp', 'KC', 'EMEA', '#1ca8ff', ['Shin', 'marteen', 'TakaS', 'xms', 'ZE1SH']],
    [
      'fut',
      'FUT Esports',
      'FUT',
      'EMEA',
      '#e7a82d',
      ['qRaxs', 'AtaKaptan', 'MrFalin', 'qw1', 'yetujey'],
    ],
    [
      'm8',
      'Gentle Mates',
      'M8',
      'EMEA',
      '#dcdcdc',
      ['nataNk', 'logaN', 'keloqz', 'beyAz', 'roYal'],
    ],
    [
      'pcf',
      'PCIFIC Esports',
      'PCF',
      'EMEA',
      '#45e0d0',
      ['trexx', 'purp0', 'Cloud', 'Sayf', 'Fit1nho'],
    ],
    [
      'bbl',
      'BBL Esports',
      'BBL',
      'EMEA',
      '#ef3131',
      ['AslaN', 'qutionerx', 'Turko', 'Elite', 'Muj'],
    ],
    ['ulf', 'ULF Esports', 'ULF', 'EMEA', '#ec6d35', ['Wo0t', 'qw1', 'Muj', 'Elite', 'Ruxic']],
    [
      'vit',
      'Team Vitality',
      'VIT',
      'EMEA',
      '#f4a800',
      ['runneR', 'ceNder', 'Keloqz', 'nataNk', 'Sayf'],
    ],
    [
      'th',
      'Team Heretics',
      'TH',
      'EMEA',
      '#f1f1f1',
      ['Boo', 'MiniBoo', 'benjyfish', 'RieNs', 'Wo0t'],
    ],
    ['gx', 'GIANTX', 'GX', 'EMEA', '#27a6ec', ['Fit1nho', 'hoodyhooba', 'Cloud', 'purp0', 'tixx']],
    [
      'fnc',
      'FNATIC',
      'FNC',
      'EMEA',
      '#ff6b00',
      ['Boaster', 'crashies', 'Chronicle', 'Alfajer', 'kaajak'],
    ],
    ['tl', 'Team Liquid', 'TL', 'EMEA', '#111111', ['nAts', 'Jamppi', 'Enzo', 'Keiko', 'paTiTek']],
    [
      'dfm',
      'DetonatioN FocusMe',
      'DFM',
      'Pacific',
      '#e21d38',
      ['Anthem', 'takej', 'medusa', 'SSeeS', 'Suggest'],
    ],
    [
      'drx',
      'Kiwoom DRX',
      'KRX',
      'Pacific',
      '#2b5cff',
      ['stax', 'Mako', 'Buzz', 'Foxy9', 'Flashback'],
    ],
    ['fs', 'FULL SENSE', 'FS', 'Pacific', '#f9bf22', ['PTC', 'sScary', 'JitboyS', 'Kntz', 'LBY']],
    [
      'gen',
      'Gen.G',
      'GEN',
      'Pacific',
      '#f6c445',
      ['t3xture', 'Meteor', 'Lakia', 'Munchkin', 'Karon'],
    ],
    [
      'ge',
      'GLOBAL ESPORTS',
      'GE',
      'Pacific',
      '#ed3434',
      ['SkRossi', 'Lightningfast', 'Russ', 'benkai', 'tixx'],
    ],
    [
      'ns',
      'NONGSHIM REDFORCE',
      'NS',
      'Pacific',
      '#e83e47',
      ['Sylvan', 'Ivy', 'Francis', 'Xir', 'Dambi'],
    ],
    [
      'prx',
      'Paper Rex',
      'PRX',
      'Pacific',
      '#f1c453',
      ['something', 'Jinggg', 'd4v41', 'mindfreak', 'f0rsaken'],
    ],
    [
      'rrq',
      'Rex Regum Qeon',
      'RRQ',
      'Pacific',
      '#25215d',
      ['xffero', 'Estrella', 'Jemkin', 'Monyet', 'Lmemore'],
    ],
    ['t1', 'T1', 'T1', 'Pacific', '#e82127', ['carpe', 'iZu', 'xccurate', 'SayaPlayer', 'Rossy']],
    ['ts', 'Team Secret', 'TS', 'Pacific', '#ffffff', ['invy', 'Jremy', '2ge', 'NDG', 'Dubstep']],
    [
      'zeta',
      'ZETA DIVISION',
      'ZETA',
      'Pacific',
      '#d4d4d4',
      ['Laz', 'Dep', 'SugarZ3ro', 'TENNN', 'hiroronn'],
    ],
    [
      'varrel',
      'VARREL',
      'VL',
      'Pacific',
      '#ee5a2b',
      ['Aace', 'Astell', 'Seoldam', 'Minty', 'Mimi'],
    ],
    ['trace', 'Trace Esports', 'TE', 'China', '#2ad9bb', ['Kai', 'Nicc', 'yoyo', 'FengF', 'biank']],
    [
      'wolves',
      'WOLVES ESPORTS',
      'WOL',
      'China',
      '#fbfbfb',
      ['saiyu', 'Lysoar', 'Yuicaw', 'Juseu', 'Spring'],
    ],
    [
      'fpx',
      'FunPlus Phoenix',
      'FPX',
      'China',
      '#ff5b35',
      ['BerLIN', 'AAAAY', 'Autumn', 'zz', 'Life'],
    ],
    [
      'tyloo',
      'TYLOO GAMING',
      'TYL',
      'China',
      '#e63232',
      ['slowly', 'hfmi0dz', 'eKo', 'Ninebody', 'Yuicaw'],
    ],
    [
      'ag',
      'ALL GAMERS',
      'AG',
      'China',
      '#d32936',
      ['TvirusLuke', 'Stew', 'vo0kashu', 'Nicc', 'biank'],
    ],
    [
      'nova',
      'NOVA ESPORTS',
      'NOVA',
      'China',
      '#41a5ff',
      ['Knight', 'TZH', 'bion', 'Nightz', 'Sak'],
    ],
    ['jdg', 'JD GAMING', 'JDG', 'China', '#f5b400', ['MrCANI', 'Karra', 'YHchen', 'F1nk', 'Stew']],
    [
      'tec',
      'TITAN ESPORTS CLUB',
      'TEC',
      'China',
      '#1b8cff',
      ['NoMan', '123', 'Br0v1', 'Kai', 'Yuicaw'],
    ],
    [
      'xlg',
      'Xi Lai Gaming',
      'XLG',
      'China',
      '#ffb300',
      ['whzy', 'Chichoo', 'Verno', 'Abo', 'nihao'],
    ],
    [
      'edg',
      'EDWARD Gaming',
      'EDG',
      'China',
      '#111111',
      ['nobody', 'CHICHOO', 'Smoggy', 'ZmjjKK', 'S1Mon'],
    ],
    [
      'blg',
      'Bilibili Gaming',
      'BLG',
      'China',
      '#00a9e0',
      ['yosemite', 'Biank', 'whzy', 'Rushia', 'S3x'],
    ],
    [
      'drg',
      'DRAGON RANGER GAMING',
      'DRG',
      'China',
      '#e53e3e',
      ['vo0kashu', 'TvirusLuke', 'Nicc', 'Lysoar', 'Spring'],
    ],
  ] as any[]
).map(([id, name, short, region, color, players]) => ({ id, name, short, region, color, players }))

// Seeded 2025 Champions qualifiers used for the opening 2026 Kickoff byes.
// Later seasons derive this list from the prior Stage 2 playoff results.
export const previousChampionsByRegion: Record<Region, string[]> = {
  Americas: ['g2', 'sen', 'lev', 'envy'],
  EMEA: ['fnc', 'th', 'navi', 'vit'],
  Pacific: ['prx', 'gen', 't1', 'drx'],
  China: ['edg', 'xlg', 'blg', 'wolves'],
}

export const maps = mapPool.map((map) => map.name)
export const roles: Role[] = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex']
export const skills = [
  'Mechanics',
  'Tactics',
  'Utility',
  'Consistency',
  'Clutch',
  'Teamplay',
] as const

export const tier2Targets = ['M80', 'RIDDLE', 'CGZ', 'BOOM Esports', 'Ninjas in Pyjamas', 'FOKUS']
