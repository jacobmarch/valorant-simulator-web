import { describe, expect, test } from 'bun:test'
import { normalizedTeamName, resolveTeamId } from '../scripts/vlr-teams'
import { seedTeams } from '../src/seed'

function search(results: { id: string; name: string; tag?: string }[]) {
  return { segments: { results: { teams: results } } }
}

describe('VLR team identities', () => {
  test('uses the confirmed NOVA ESPORTS ID without an ambiguous search', async () => {
    const team = seedTeams.find((team) => team.id === 'nova')!
    const id = await resolveTeamId(team, async () => {
      throw new Error('NOVA ESPORTS must not depend on duplicate search results')
    })
    expect(id).toBe('12064')
  })
  test('uses the confirmed ALL GAMERS ID without an ambiguous search', async () => {
    const team = seedTeams.find((team) => team.id === 'ag')!
    const id = await resolveTeamId(team, async () => {
      throw new Error('ALL GAMERS must not depend on duplicate search results')
    })
    expect(id).toBe('1119')
  })
  test('searches Eternal Fire for the former ULF slot and excludes inactive ULF', async () => {
    const team = seedTeams.find((team) => team.id === 'ulf')!
    expect(team.name).toBe('Eternal Fire')
    expect(team.short).toBe('EF')
    const queries: string[] = []
    const id = await resolveTeamId(team, async (_, params) => {
      queries.push(params.q)
      return search([
        { id: '112', name: 'ULF Esports', tag: '(inactive)' },
        { id: '113', name: 'Eternal Fire' },
      ])
    })
    expect(id).toBe('113')
    expect(queries).toEqual(['Eternal Fire'])
  })
  test('falls back from the sponsored KRÜ Visa name to KRÜ Esports', async () => {
    const queries: string[] = []
    const id = await resolveTeamId({ id: 'kru', name: 'KRÜ Visa' }, async (path, params) => {
      expect(path).toBe('/v2/search')
      queries.push(params.q)
      return search(params.q === 'KRÜ Esports' ? [{ id: '101', name: 'KRU Esports' }] : [])
    })
    expect(id).toBe('101')
    expect(queries).toEqual(['KRÜ Visa', 'KRÜ Esports'])
  })
  test('normalizes accents, punctuation, whitespace, and decomposed Unicode', async () => {
    expect(normalizedTeamName(' KRÜ  Esports ')).toBe(normalizedTeamName('KRU Esports'))
    expect(normalizedTeamName('Leviata\u0301n')).toBe(normalizedTeamName('Leviatán'))
    expect(
      await resolveTeamId({ id: 'lev', name: 'Leviatán' }, async () =>
        search([{ id: '102', name: 'LEVIATAN' }]),
      ),
    ).toBe('102')
    expect(
      await resolveTeamId({ id: 'gen', name: 'Gen.G' }, async () =>
        search([{ id: '103', name: 'Gen G' }]),
      ),
    ).toBe('103')
  })
  test('uses explicit DRX sponsor aliases and returns source IDs', async () => {
    const queries: string[] = []
    const id = await resolveTeamId({ id: 'drx', name: 'Kiwoom DRX' }, async (_, params) => {
      queries.push(params.q)
      return search(params.q === 'DRX' ? [{ id: '104', name: 'DRX' }] : [])
    })
    expect(id).toBe('104')
    expect(queries).toEqual(['Kiwoom DRX', 'DRX'])
  })
  test('ignores inactive teams and distinct academy or Game Changers names', async () => {
    const id = await resolveTeamId({ id: 'kru', name: 'KRÜ Visa' }, async () =>
      search([
        { id: '105', name: 'KRÜ Esports', tag: '(inactive)' },
        { id: '106', name: 'KRÜ Esports GC' },
        { id: '107', name: 'KRÜ Academy' },
        { id: '108', name: 'KRÜ Esports' },
      ]),
    )
    expect(id).toBe('108')
  })
  test('requires a mapping for ambiguous identities rather than picking the first result', async () => {
    await expect(
      resolveTeamId({ id: 'kru', name: 'KRÜ Visa' }, async () =>
        search([
          { id: '109', name: 'KRÜ Esports' },
          { id: '110', name: 'KRÜ' },
        ]),
      ),
    ).rejects.toThrow('Ambiguous VLR identity')
  })
  test('reports candidates for unknown names and fails on malformed search data', async () => {
    await expect(
      resolveTeamId({ id: 'unknown', name: 'Unknown' }, async () =>
        search([{ id: '111', name: 'Other Team' }]),
      ),
    ).rejects.toThrow('Other Team (ID 111)')
    await expect(resolveTeamId({ id: 'kru', name: 'KRÜ Visa' }, async () => ({}))).rejects.toThrow(
      'Search response schema changed',
    )
  })
})
