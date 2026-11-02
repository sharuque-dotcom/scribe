import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateLicense, deactivateLicense, isPro, LICENSE_CONFIG, loadLicense, needsRecheck, OFFLINE_GRACE_MS, planName, RECHECK_MS, revalidateLicense, type License } from './license'

const meta = { store_id: 7, product_id: 70, product_name: 'StepCrumb', variant_name: 'Founding 1,000', customer_email: 'a@b.co' }
const ok = (body: object, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

const lic = (over: Partial<License> = {}): License => ({ key: 'K', instanceId: 'I', status: 'active', checkedAt: 1_000_000, ...over })

afterEach(() => {
  LICENSE_CONFIG.storeId = null
  LICENSE_CONFIG.productIds = []
})

describe('plan state', () => {
  it('is paid while active and checked within the offline grace period', () => {
    expect(isPro(null)).toBe(false)
    expect(isPro(lic(), 1_000_000 + OFFLINE_GRACE_MS - 1)).toBe(true)
    expect(isPro(lic(), 1_000_000 + OFFLINE_GRACE_MS + 1)).toBe(false)
    expect(isPro(lic({ status: 'expired' }), 1_000_000)).toBe(false)
  })
  it('re-checks every few days', () => {
    expect(needsRecheck(lic(), 1_000_000 + RECHECK_MS - 1)).toBe(false)
    expect(needsRecheck(lic(), 1_000_000 + RECHECK_MS + 1)).toBe(true)
  })
  it('names the plan', () => {
    expect(planName(null)).toBe('Free')
    expect(planName(lic({ productName: 'StepCrumb', variantName: 'Founding 1,000' }))).toBe('Founding 1,000')
    expect(planName(lic({ productName: 'StepCrumb Pro', variantName: 'Default' }))).toBe('StepCrumb Pro')
  })
})

describe('activateLicense', () => {
  it('activates and saves the key', async () => {
    const f = ok({ activated: true, error: null, license_key: { status: 'active', key: 'K' }, instance: { id: 'inst-1' }, meta })
    const l = await activateLicense('  K  ', f as unknown as typeof fetch, 42)
    expect(l).toMatchObject({ key: 'K', instanceId: 'inst-1', status: 'active', variantName: 'Founding 1,000', checkedAt: 42 })
    expect(await loadLicense()).toMatchObject({ instanceId: 'inst-1' })
    const [url, init] = (f.mock.calls[0] as unknown) as [string, RequestInit]
    expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate')
    expect(String(init.body)).toContain('license_key=K')
  })
  it('passes on Lemon Squeezy error messages', async () => {
    const f = ok({ activated: false, error: 'This license key has reached the activation limit.', meta }, 400)
    await expect(activateLicense('K', f as unknown as typeof fetch)).rejects.toThrow('activation limit')
  })
  it('rejects keys from another store', async () => {
    LICENSE_CONFIG.storeId = 99
    const f = ok({ activated: true, license_key: { status: 'active', key: 'K' }, instance: { id: 'x' }, meta })
    await expect(activateLicense('K', f as unknown as typeof fetch)).rejects.toThrow('different product')
  })
  it('explains network failures', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(activateLicense('K', f as unknown as typeof fetch)).rejects.toThrow('Could not reach the license server')
  })
})

describe('revalidateLicense', () => {
  it('refreshes the check time when still valid', async () => {
    const f = ok({ valid: true, license_key: { status: 'active', key: 'K' }, instance: { id: 'I' }, meta })
    expect((await revalidateLicense(lic(), f as unknown as typeof fetch, 5_000_000)).checkedAt).toBe(5_000_000)
  })
  it('ends the paid plan when the key was refunded or disabled', async () => {
    const f = ok({ valid: false, error: 'license_key is disabled', license_key: { status: 'disabled', key: 'K' }, meta })
    const l = await revalidateLicense(lic(), f as unknown as typeof fetch, 5_000_000)
    expect(l.status).toBe('disabled')
    expect(isPro(l, 5_000_000)).toBe(false)
  })
  it('keeps the plan when offline', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline')
    })
    const before = lic()
    expect(await revalidateLicense(before, f as unknown as typeof fetch)).toEqual(before)
  })
})

describe('deactivateLicense', () => {
  it('removes the key even if the server call fails', async () => {
    await activateLicense('K', ok({ activated: true, license_key: { status: 'active', key: 'K' }, instance: { id: 'z' }, meta }) as unknown as typeof fetch)
    await deactivateLicense(lic(), vi.fn(async () => { throw new Error('x') }) as unknown as typeof fetch)
    expect(await loadLicense()).toBeNull()
  })
})
