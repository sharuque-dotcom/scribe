// Paid plan check using Lemon Squeezy license keys. This is the only network
// call StepCrumb makes besides the optional Claude features and the one-time
// voice model download. Keys are checked when entered, then every few days;
// a paid plan keeps working offline for two weeks.

export const LICENSE_CONFIG = {
  // Where "Upgrade" buttons go.
  buyUrl: 'https://stepcrumb.com/#pricing',
  // Fill these in from the Lemon Squeezy dashboard so keys from other stores
  // or products are rejected. Left empty, any valid Lemon Squeezy key works.
  storeId: null as number | null,
  productIds: [] as number[],
  api: 'https://api.lemonsqueezy.com/v1/licenses',
}

const DAY = 24 * 60 * 60 * 1000
export const RECHECK_MS = 3 * DAY
export const OFFLINE_GRACE_MS = 14 * DAY

export interface License {
  key: string
  instanceId: string
  // Lemon Squeezy status: 'active', 'expired', 'disabled', 'inactive'.
  status: string
  productName?: string
  variantName?: string
  email?: string
  // Last time Lemon Squeezy confirmed the key.
  checkedAt: number
}

export const isPro = (lic: License | null, now = Date.now()) => !!lic && lic.status === 'active' && now - lic.checkedAt < OFFLINE_GRACE_MS
export const needsRecheck = (lic: License | null, now = Date.now()) => !!lic && now - lic.checkedAt > RECHECK_MS
export const planName = (lic: License | null) => (lic ? lic.variantName && lic.variantName !== 'Default' ? lic.variantName : lic.productName || 'Pro' : 'Free')

// ---------- storage (chrome.storage in the extension, localStorage otherwise) ----------

const KEY = 'stepcrumb.license'
const memory = new Map<string, string>()
const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local

export async function loadLicense(): Promise<License | null> {
  try {
    if (hasChromeStorage()) return ((await chrome.storage.local.get(KEY))[KEY] as License) ?? null
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : memory.get(KEY)
    return raw ? (JSON.parse(raw) as License) : null
  } catch {
    return null
  }
}

export async function saveLicense(lic: License | null): Promise<void> {
  if (hasChromeStorage()) {
    if (lic) await chrome.storage.local.set({ [KEY]: lic })
    else await chrome.storage.local.remove(KEY)
    return
  }
  const raw = lic ? JSON.stringify(lic) : null
  try {
    if (typeof localStorage !== 'undefined') {
      if (raw) localStorage.setItem(KEY, raw)
      else localStorage.removeItem(KEY)
      return
    }
  } catch {
    /* fall through to memory */
  }
  if (raw) memory.set(KEY, raw)
  else memory.delete(KEY)
}

export function onLicenseChange(fn: () => void): () => void {
  if (hasChromeStorage()) {
    const l = (changes: Record<string, unknown>, area: string) => area === 'local' && KEY in changes && fn()
    chrome.storage.onChanged.addListener(l)
    return () => chrome.storage.onChanged.removeListener(l)
  }
  const l = (e: StorageEvent) => e.key === KEY && fn()
  if (typeof window !== 'undefined') window.addEventListener('storage', l)
  return () => typeof window !== 'undefined' && window.removeEventListener('storage', l)
}

// ---------- Lemon Squeezy calls ----------

interface LsResponse {
  activated?: boolean
  valid?: boolean
  deactivated?: boolean
  error?: string | null
  license_key?: { status: string; key: string }
  instance?: { id: string } | null
  meta?: { store_id: number; product_id: number; product_name?: string; variant_name?: string; customer_email?: string }
}

type Fetch = typeof fetch

async function call(path: string, params: Record<string, string>, f: Fetch): Promise<LsResponse> {
  const res = await f(`${LICENSE_CONFIG.api}/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  // Lemon Squeezy answers errors with a JSON body too (e.g. 400/404).
  try {
    return (await res.json()) as LsResponse
  } catch {
    throw new Error(`License server error (${res.status}).`)
  }
}

function wrongProduct(meta: LsResponse['meta']): boolean {
  if (!meta) return false
  if (LICENSE_CONFIG.storeId !== null && meta.store_id !== LICENSE_CONFIG.storeId) return true
  if (LICENSE_CONFIG.productIds.length && !LICENSE_CONFIG.productIds.includes(meta.product_id)) return true
  return false
}

const instanceName = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'browser'
  return `StepCrumb on ${os}`
}

// Activates a key on this browser. Throws with a readable message on failure.
export async function activateLicense(key: string, f: Fetch = fetch, now = Date.now()): Promise<License> {
  const clean = key.trim()
  if (!clean) throw new Error('Enter your license key.')
  let r: LsResponse
  try {
    r = await call('activate', { license_key: clean, instance_name: instanceName() }, f)
  } catch (err) {
    throw new Error((err as Error).message.startsWith('License') ? (err as Error).message : 'Could not reach the license server. Check your connection.')
  }
  if (wrongProduct(r.meta)) throw new Error('This license key is for a different product.')
  if (!r.activated || !r.instance) throw new Error(r.error || 'This license key could not be activated.')
  const lic: License = {
    key: clean,
    instanceId: r.instance.id,
    status: r.license_key?.status ?? 'active',
    productName: r.meta?.product_name,
    variantName: r.meta?.variant_name,
    email: r.meta?.customer_email,
    checkedAt: now,
  }
  await saveLicense(lic)
  return lic
}

// Re-checks a stored key. Offline or server trouble keeps the current state
// (the offline grace period covers it); a definite "no" ends the paid plan.
export async function revalidateLicense(lic: License, f: Fetch = fetch, now = Date.now()): Promise<License> {
  let r: LsResponse
  try {
    r = await call('validate', { license_key: lic.key, instance_id: lic.instanceId }, f)
  } catch {
    return lic
  }
  const next: License =
    r.valid && !wrongProduct(r.meta)
      ? { ...lic, status: r.license_key?.status ?? 'active', checkedAt: now }
      : { ...lic, status: r.license_key?.status && r.license_key.status !== 'active' ? r.license_key.status : 'invalid' }
  await saveLicense(next)
  return next
}

// Frees this browser's activation so the key can be used elsewhere.
export async function deactivateLicense(lic: License, f: Fetch = fetch): Promise<void> {
  try {
    await call('deactivate', { license_key: lic.key, instance_id: lic.instanceId }, f)
  } catch {
    /* removing it locally is what matters */
  }
  await saveLicense(null)
}
