import { afterEach, describe, expect, it, vi } from 'vitest'
import { count, COUNT_URL } from './telemetry'

const store: Record<string, unknown> = {}
vi.stubGlobal('chrome', { storage: { local: { get: async (k: string) => ({ [k]: store[k] }), set: async (o: Record<string, unknown>) => Object.assign(store, o) } } })
const flush = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('chrome', { storage: { local: { get: async (k: string) => ({ [k]: store[k] }), set: async (o: Record<string, unknown>) => Object.assign(store, o) } } })
  delete store.anonymousCounts
})

describe('anonymous counts', () => {
  it('sends only the event name', async () => {
    const f = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', f)
    count('export_pdf')
    await flush()
    expect(f).toHaveBeenCalledOnce()
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(COUNT_URL)
    expect(JSON.parse(init.body as string)).toEqual({ e: 'export_pdf' })
  })
  it('sends nothing when switched off', async () => {
    store.anonymousCounts = false
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    count('guide_created')
    await flush()
    expect(f).not.toHaveBeenCalled()
  })
  it('never throws when offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(() => count('guide_created')).not.toThrow()
    await flush()
  })
})
