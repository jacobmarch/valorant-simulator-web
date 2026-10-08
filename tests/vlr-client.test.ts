import { describe, expect, test } from 'bun:test'
import { createVlrClient, requestInterval, retryAfterMs } from '../scripts/vlr-client'

const success = () => Response.json({ status: 'success', data: { status: 200, segments: [] } })
function harness(responses: (() => Response)[]) {
  let time = Date.parse('2026-10-02T12:00:00Z')
  const calls: number[] = []
  const waits: number[] = []
  const request = createVlrClient({
    base: 'http://localhost:3001',
    intervalMs: 4000,
    now: () => time,
    sleep: async (ms) => {
      waits.push(ms)
      time += ms
    },
    fetch: (async () => {
      calls.push(time)
      return responses.shift()!()
    }) as typeof fetch,
  })
  return { request, calls, waits }
}

describe('VLR request pacing', () => {
  test('spaces all endpoints below the shared 20/minute limit', async () => {
    const { request, calls } = harness(Array.from({ length: 30 }, () => success))
    for (let index = 0; index < 30; index++)
      await request(index % 2 ? '/v2/player' : '/v2/team', { id: String(index + 1) })
    for (let index = 1; index < calls.length; index++)
      expect(calls[index] - calls[index - 1]).toBeGreaterThanOrEqual(4000)
    for (const start of calls)
      expect(
        calls.filter((time) => time >= start && time <= start + 60_000).length,
      ).toBeLessThanOrEqual(20)
  })
  test('honors Retry-After seconds and keeps subsequent requests paced', async () => {
    const { request, calls } = harness([
      () => new Response('', { status: 429, headers: { 'Retry-After': '45' } }),
      success,
      success,
    ])
    await request('/v2/player', { id: '9' })
    await request('/v2/team', { id: '2' })
    expect(calls[1] - calls[0]).toBe(46_000)
    expect(calls[2] - calls[1]).toBe(4000)
  })
  test('waits for HTTP-date retry headers and a full minute when no header exists', async () => {
    const dated = harness([
      () =>
        new Response('', {
          status: 429,
          headers: { 'Retry-After': 'Fri, 02 Oct 2026 12:01:30 GMT' },
        }),
      success,
    ])
    await dated.request('/v2/player', { id: '9' })
    expect(dated.calls[1] - dated.calls[0]).toBe(91_000)
    const fallback = harness([() => new Response('', { status: 429 }), success])
    await fallback.request('/v2/player', { id: '9' })
    expect(fallback.calls[1] - fallback.calls[0]).toBe(61_000)
  })
  test('bounds retries and does not retry permanent HTTP errors', async () => {
    const limited = harness(
      Array.from({ length: 6 }, () => () => new Response('', { status: 429 })),
    )
    await expect(limited.request('/v2/player', { id: '9' })).rejects.toThrow('HTTP 429')
    expect(limited.calls.length).toBe(6)
    const missing = harness([() => new Response('', { status: 404 })])
    await expect(missing.request('/v2/player', { id: '9' })).rejects.toThrow('HTTP 404')
    expect(missing.calls.length).toBe(1)
  })
  test('validates configurable spacing and handles malformed retry headers', () => {
    expect(requestInterval()).toBe(4000)
    expect(requestInterval('6000')).toBe(6000)
    for (const value of ['0', '-1', '', 'NaN', '2.5'])
      expect(() => requestInterval(value)).toThrow()
    expect(retryAfterMs('garbage', 0)).toBeNull()
    expect(retryAfterMs('0', 0)).toBe(0)
  })
})
