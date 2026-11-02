import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateLicense, isPro, LICENSE_CONFIG, loadLicense, needsRecheck, OFFLINE_GRACE_MS, planName, RECHECK_MS, revalidateLicense, saveLicense, type License } from './license'
import { can, FEATURES, videoLimits } from './plans'

const ORG = '11111111-2222-4333-8444-555555555555'
const KEY = 'STEPCRUMB-ABCD-1234'
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
// A fake Polar: answers each path with the given [status, body].
const polar = (routes: Record<string, [number, object]>) =>
  vi.fn(async (url: string) => {
    const path = url.split('/').pop()!
    const [status, body] = routes[path] ?? [500, {}]
    return json(body, status)
  })
const asFetch = (f: unknown) => f as typeof fetch
const validKey = { status: 'granted', key: KEY, expires_at: null, customer: { email: 'a@b.co' } }

const lic = (over: Partial<License> = {}): License => ({ provider: 'polar', key: KEY, activationId: 'act-1', status: 'granted', checkedAt: 1_000_000, ...over })

beforeEach(() => {
  LICENSE_CONFIG.organizationId = ORG
})
afterEach(async () => {
  LICENSE_CONFIG.organizationId = ''
  await saveLicense(null)
})

describe('plan state', () => {
  it('is Pro while granted and checked within the 7-day offline grace', () => {
    expect(isPro(null)).toBe(false)
    expect(isPro(lic(), 1_000_000 + OFFLINE_GRACE_MS - 1)).toBe(true)
    expect(isPro(lic(), 1_000_000 + OFFLINE_GRACE_MS + 1)).toBe(false)
    expect(isPro(lic({ status: 'revoked' }), 1_000_000)).toBe(false)
  })
  it('ends at the key’s expiry date', () => {
    expect(isPro(lic({ expiresAt: new Date(2_000_000).toISOString() }), 1_999_999)).toBe(true)
    expect(isPro(lic({ expiresAt: new Date(2_000_000).toISOString() }), 2_000_001)).toBe(false)
  })
  it('re-checks once a day', () => {
    expect(needsRecheck(lic(), 1_000_000 + RECHECK_MS - 1)).toBe(false)
    expect(needsRecheck(lic(), 1_000_000 + RECHECK_MS)).toBe(true)
  })
  it('names the plan', () => {
    expect(planName(null)).toBe('Free')
    expect(planName(lic(), 1_000_000)).toBe('Pro')
  })
})

describe('activateLicense', () => {
  it('activates this computer, validates with the activation, and saves the key', async () => {
    const f = polar({ activate: [200, { id: 'act-9', license_key: validKey }], validate: [200, validKey] })
    const l = await activateLicense(`  ${KEY}  `, asFetch(f), 42)
    expect(l).toMatchObject({ provider: 'polar', key: KEY, activationId: 'act-9', status: 'granted', email: 'a@b.co', checkedAt: 42 })
    expect(await loadLicense()).toMatchObject({ activationId: 'act-9' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.polar.sh/v1/customer-portal/license-keys/activate')
    expect(JSON.parse(String(init.body))).toMatchObject({ key: KEY, organization_id: ORG })
    const [url2, init2] = f.mock.calls[1] as unknown as [string, RequestInit]
    expect(url2).toBe('https://api.polar.sh/v1/customer-portal/license-keys/validate')
    expect(JSON.parse(String(init2.body))).toEqual({ key: KEY, organization_id: ORG, activation_id: 'act-9' })
  })
  it('only sends the key, organization and activation (no other data)', async () => {
    const f = polar({ activate: [200, { id: 'a' }], validate: [200, validKey] })
    await activateLicense(KEY, asFetch(f))
    for (const [, init] of f.mock.calls as unknown as [string, RequestInit][]) {
      expect(Object.keys(JSON.parse(String(init.body))).sort()).toEqual(expect.arrayContaining(['key', 'organization_id']))
      expect(Object.keys(JSON.parse(String(init.body))).every((k) => ['key', 'organization_id', 'label', 'activation_id'].includes(k))).toBe(true)
    }
  })
  it('checks the STEPCRUMB prefix before calling Polar', async () => {
    const f = polar({})
    await expect(activateLicense('ABC-123', asFetch(f))).rejects.toThrow('start with STEPCRUMB')
    expect(f).not.toHaveBeenCalled()
  })
  it('explains the computer limit', async () => {
    const f = polar({ activate: [403, { error: 'NotPermitted', detail: 'License key activation limit already reached' }] })
    await expect(activateLicense(KEY, asFetch(f))).rejects.toThrow('already in use on 2 computers')
  })
  it('says when a key is unknown', async () => {
    const f = polar({ activate: [404, { error: 'ResourceNotFound', detail: 'License key not found' }] })
    await expect(activateLicense(KEY, asFetch(f))).rejects.toThrow('wasn’t found')
  })
  it('works for keys without activations', async () => {
    const f = polar({ activate: [403, { error: 'NotPermitted', detail: 'This license key does not support activations.' }], validate: [200, validKey] })
    const l = await activateLicense(KEY, asFetch(f))
    expect(l.activationId).toBeUndefined()
    expect(isPro(l)).toBe(true)
  })
  it('refuses a revoked key', async () => {
    const f = polar({ activate: [403, { error: 'NotPermitted', detail: 'License key is revoked' }], validate: [404, { error: 'ResourceNotFound' }] })
    await expect(activateLicense(KEY, asFetch(f))).rejects.toThrow('no longer active')
  })
  it('explains network failures', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(activateLicense(KEY, asFetch(f))).rejects.toThrow('Could not reach the license server')
  })
  it('needs the organization ID to be set', async () => {
    LICENSE_CONFIG.organizationId = ''
    await expect(activateLicense(KEY, asFetch(polar({})))).rejects.toThrow('isn’t set up')
  })
})

describe('revalidateLicense', () => {
  it('refreshes the check time when still valid', async () => {
    const f = polar({ validate: [200, validKey] })
    const l = await revalidateLicense(lic(), asFetch(f), 5_000_000)
    expect(l.checkedAt).toBe(5_000_000)
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).activation_id).toBe('act-1')
  })
  it('drops to Free when the subscription was cancelled or lapsed', async () => {
    const f = polar({ validate: [404, { error: 'ResourceNotFound', detail: 'License key not found' }] })
    const l = await revalidateLicense(lic(), asFetch(f), 5_000_000)
    expect(l.status).toBe('revoked')
    expect(isPro(l, 5_000_000)).toBe(false)
    expect((await loadLicense())?.status).toBe('revoked')
  })
  it('keeps Pro when offline or the server has trouble', async () => {
    const before = lic()
    const offline = vi.fn(async () => {
      throw new TypeError('offline')
    })
    expect(await revalidateLicense(before, asFetch(offline))).toEqual(before)
    expect(await revalidateLicense(before, asFetch(polar({ validate: [503, {}] })))).toEqual(before)
  })
})

describe('plans', () => {
  it('free gets the basics, Pro gets everything', () => {
    for (const f of Object.keys(FEATURES) as (keyof typeof FEATURES)[]) {
      expect(can(f, true)).toBe(true)
      expect(can(f, false)).toBe(FEATURES[f].tier === 'free')
    }
  })
  it('sets video limits by plan', () => {
    expect(videoLimits(false)).toEqual({ width: 1280, maxMs: 120000, watermark: true })
    expect(videoLimits(true)).toEqual({ width: 1920, maxMs: undefined, watermark: false })
  })
})
