// Confirmed source identities for organizations with duplicate VLR search names.
// VLR_TEAM_MAPPING overrides these defaults in the importer.
const confirmedTeamIds: Record<string, string> = {
  ag: '1119', // ALL GAMERS, confirmed by the user from VLR's duplicate results.
}

// Explicit identity aliases for game display names that include sponsors or differ on VLR.
const teamAliases: Record<string, string[]> = {
  kru: ['KRÜ Esports', 'KRU Esports', 'KRÜ', 'KRU'],
  drx: ['DRX'],
  tyloo: ['TYLOO'],
  gen: ['Gen.G Esports'],
  jdg: ['JDG Esports', 'JD Gaming'],
  navi: ['NAVI', 'Natus Vincere'],
}

export function normalizedTeamName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

type SearchResult = { id: string; name: string; tag?: string }
export async function resolveTeamId(
  team: { id: string; name: string },
  request: (path: string, params: Record<string, string>) => Promise<any>,
) {
  if (confirmedTeamIds[team.id]) return confirmedTeamIds[team.id]
  const names = [team.name, ...(teamAliases[team.id] ?? [])]
  const accepted = new Set(names.map(normalizedTeamName))
  const queries = [...new Set([...names, team.name.normalize('NFKD').replace(/\p{M}/gu, '')])]
  const seen = new Map<string, SearchResult>()
  for (const query of queries) {
    const data = await request('/v2/search', { q: query })
    const results = data.segments?.results?.teams
    if (!Array.isArray(results)) throw new Error('Search response schema changed.')
    const matches = new Map<string, SearchResult>()
    for (const result of results as SearchResult[]) {
      if (
        typeof result.name !== 'string' ||
        !/^\d+$/.test(String(result.id)) ||
        Number(result.id) <= 0 ||
        /inactive/i.test(result.tag ?? '')
      )
        continue
      seen.set(String(result.id), result)
      if (accepted.has(normalizedTeamName(result.name))) matches.set(String(result.id), result)
    }
    if (matches.size === 1) return [...matches.keys()][0]
    if (matches.size > 1) {
      const candidates = [...matches].map(([id, result]) => `${result.name} (ID ${id})`).join(', ')
      throw new Error(
        `Ambiguous VLR identity for ${team.name}: ${candidates}. Set ${team.id} in VLR_TEAM_MAPPING.`,
      )
    }
  }
  const candidates =
    [...seen].map(([id, result]) => `${result.name} (ID ${id})`).join(', ') || 'none'
  throw new Error(
    `Cannot resolve ${team.name}; tried ${queries.join(', ')}. Active candidates: ${candidates}. Set its VLR ID in VLR_TEAM_MAPPING (${team.id}).`,
  )
}
