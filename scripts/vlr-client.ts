export const DEFAULT_REQUEST_INTERVAL_MS = 4000
const MAX_ATTEMPTS = 6

export function requestInterval(value?: string) {
  if (value === undefined) return DEFAULT_REQUEST_INTERVAL_MS
  const interval = Number(value)
  if (!Number.isSafeInteger(interval) || interval <= 0)
    throw new Error('VLR_REQUEST_INTERVAL_MS must be a positive integer in milliseconds.')
  return interval
}

export function retryAfterMs(value: string | null, now: number): number | null {
  if (value === null || !value.trim()) return null
  if (/^\d+(\.\d+)?$/.test(value.trim())) return Number(value) * 1000
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - now) : null
}

class RequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

/** Sequential caller: every attempt, including retries, shares the same pacing clock. */
export function createVlrClient(options: {
  base: string
  intervalMs: number
  fetch: typeof fetch
  sleep: (ms: number) => Promise<unknown>
  now?: () => number
  warn?: (message: string) => void
  onSuccess?: (url: string, payload: any) => void
}) {
  const now = options.now ?? Date.now
  let nextRequestAt = 0
  return async (path: string, params: Record<string, string>) => {
    const url = new URL(path, options.base)
    url.search = new URLSearchParams(params).toString()
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const wait = nextRequestAt - now()
      if (wait > 0) await options.sleep(wait)
      nextRequestAt = now() + options.intervalMs
      try {
        const response = await options.fetch(url, { signal: AbortSignal.timeout(30_000) })
        if (response.status === 429) {
          // The upstream limiter rounds seconds down, so add one second of margin.
          const cooldown =
            (retryAfterMs(response.headers.get('Retry-After'), now()) ?? 60_000 * 2 ** attempt) +
            1000
          nextRequestAt = Math.max(nextRequestAt, now() + cooldown)
          if (attempt < MAX_ATTEMPTS - 1)
            options.warn?.(
              `Rate limited by ${url}; waiting ${Math.ceil((nextRequestAt - now()) / 1000)}s before retry ${attempt + 2}/${MAX_ATTEMPTS}.`,
            )
        }
        if (!response.ok)
          throw new RequestError(
            `HTTP ${response.status} from ${url}`,
            response.status === 429 || response.status === 408 || response.status >= 500,
          )
        const payload = await response.json()
        if (
          payload.status !== 'success' ||
          !payload.data ||
          (payload.data.status && payload.data.status !== 200)
        )
          throw new RequestError(`Invalid API response from ${url}`, false)
        options.onSuccess?.(url.toString(), payload)
        return payload.data
      } catch (error) {
        if (attempt === MAX_ATTEMPTS - 1 || (error instanceof RequestError && !error.retryable))
          throw error
        nextRequestAt = Math.max(nextRequestAt, now() + 1000 * 2 ** attempt)
      }
    }
    throw new Error('Unreachable')
  }
}
