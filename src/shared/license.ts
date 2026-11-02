// StepCrumb Pro, sold through Polar (polar.sh). Every purchase (Lifetime, Monthly,
// Yearly) grants a Polar license key starting with STEPCRUMB. The key is checked
// when entered, on browser start and once a day. Pro keeps working offline for
// 7 days. A cancelled or lapsed subscription drops back to Free; guides, videos
// and everything else stored locally are never touched.

export const LICENSE_CONFIG = {
  // Polar → Settings → Organization ID.
  organizationId: '74c0856f-0a68-4222-a3a4-800dffb0afac',
  // Polar organization slug, used for the customer portal link.
  orgSlug: 'stepcrumb',
  // One checkout for all three plans.
  checkoutUrl: 'https://buy.polar.sh/polar_cl_ImqGIEAjftim5l45evDJ9hyB5WhthHn6747Pn1IkbMt',
  keyPrefix: 'STEPCRUMB',
  // Matches the License key benefit in Polar (customers remove computers in the portal).
  activations: 2,
  supportEmail: 'hello@stepcrumb.com',
  api: 'https://api.polar.sh/v1/customer-portal/license-keys',
}

export const portalUrl = () => `https://polar.sh/${LICENSE_CONFIG.orgSlug}/portal`

const HOUR = 60 * 60 * 1000
export const RECHECK_MS = 24 * HOUR
export const OFFLINE_GRACE_MS = 7 * 24 * HOUR

export interface License {
  provider: 'polar'
  key: string
  // This computer's activation (keys are limited to a number of computers).
  activationId?: string
  // 'granted' while Polar accepts the key; 'revoked' once it doesn't
  // (cancelled or lapsed subscription, refund, disabled key).
  status: 'granted' | 'revoked'
  email?: string
  expiresAt?: string | null
  // Last time Polar confirmed the key.
  checkedAt: number
}

export function isPro(lic: License | null, now = Date.now()): boolean {
  if (!lic || lic.provider !== 'polar' || lic.status !== 'granted') return false
  if (lic.expiresAt && now >= Date.parse(lic.expiresAt)) return false
  return now - lic.checkedAt < OFFLINE_GRACE_MS
}
export const needsRecheck = (lic: License | null, now = Date.now()) => !!lic && lic.status === 'granted' && now - lic.checkedAt >= RECHECK_MS
export const planName = (lic: License | null, now = Date.now()) => (isPro(lic, now) ? 'Pro' : 'Free')

// ---------- storage (chrome.storage in the extension, localStorage otherwise) ----------

const KEY = 'stepcrumb.license'
const memory = new Map<string, string>()
const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local

export async function loadLicense(): Promise<License | null> {
  try {
    let lic: License | null
    if (hasChromeStorage()) lic = ((await chrome.storage.local.get(KEY))[KEY] as License) ?? null
    else {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : memory.get(KEY)
      lic = raw ? (JSON.parse(raw) as License) : null
    }
    // Keys from the earlier payment provider are no longer valid.
    return lic?.provider === 'polar' ? lic : null
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

const organizationId = async () => LICENSE_CONFIG.organizationId

// ---------- Polar calls ----------

interface PolarKey {
  status?: string
  expires_at?: string | null
  customer?: { email?: string | null } | null
}
interface PolarActivation {
  id: string
  license_key?: PolarKey
}
interface PolarError {
  error?: string
  detail?: string | { msg?: string }[]
}

type Fetch = typeof fetch

class NetworkError extends Error {}

async function call<T>(path: 'activate' | 'validate', body: Record<string, string>, f: Fetch): Promise<{ status: number; data: T & PolarError }> {
  // PRIVACY: this is the only request StepCrumb makes, apart from the one-time
  // download of the free voice model. It sends just the license key, our Polar
  // organization ID and this computer's activation ID/label. Guides, steps,
  // screenshots, recordings and anything else captured never leave the device.
  let res: Response
  try {
    res = await f(`${LICENSE_CONFIG.api}/${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new NetworkError('Could not reach the license server. Check your connection and try again.')
  }
  let data: T & PolarError
  try {
    data = (res.status === 204 ? {} : await res.json()) as T & PolarError
  } catch {
    data = {} as T & PolarError
  }
  return { status: res.status, data }
}

const detailText = (e: PolarError) => (typeof e.detail === 'string' ? e.detail : e.detail?.map((d) => d.msg).join(' ') ?? '')

const computerName = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'browser'
  return `StepCrumb on ${os}`
}

const notFound = 'That license key wasn’t found. Copy it again from your purchase email (it starts with STEPCRUMB).'

// Checks a key and turns it on for this computer. Throws a readable message on failure.
export async function activateLicense(input: string, f: Fetch = fetch, now = Date.now()): Promise<License> {
  const key = input.trim()
  if (!key) throw new Error('Enter your license key.')
  if (!key.toUpperCase().startsWith(LICENSE_CONFIG.keyPrefix)) {
    throw new Error(`StepCrumb license keys start with ${LICENSE_CONFIG.keyPrefix}. Copy the whole key from your purchase email.`)
  }
  const org = await organizationId()
  if (!org) throw new Error('License checking isn’t set up in this version yet. Please contact support.')

  // 1. Register this computer. Keys work on a limited number of computers.
  let activationId: string | undefined
  const act = await call<PolarActivation>('activate', { key, organization_id: org, label: computerName() }, f)
  if (act.status === 200 && act.data.id) activationId = act.data.id
  else if (act.status === 404) throw new Error(notFound)
  else if (act.status === 403) {
    const detail = detailText(act.data)
    if (/limit/i.test(detail)) {
      throw new Error(
        `This key is already used on ${LICENSE_CONFIG.activations} computers. Remove one in your Polar portal (${portalUrl()}), then try again. Need help? ${LICENSE_CONFIG.supportEmail}`,
      )
    }
    // Otherwise the key may simply not use activations; the check below decides.
  } else if (act.status >= 500 || act.status === 429) throw new Error('The license server is busy. Please try again in a minute.')

  // 2. Confirm the key (and this computer's activation).
  const body: Record<string, string> = { key, organization_id: org }
  if (activationId) body.activation_id = activationId
  const res = await call<PolarKey>('validate', body, f)
  if (res.status === 404) throw new Error('This license key is no longer active (cancelled, expired or refunded). Check your subscription in the Polar portal.')
  if (res.status !== 200) throw new Error(detailText(res.data) || `License server error (${res.status}).`)

  const lic: License = {
    provider: 'polar',
    key,
    activationId,
    status: 'granted',
    email: res.data.customer?.email ?? undefined,
    expiresAt: res.data.expires_at ?? null,
    checkedAt: now,
  }
  await saveLicense(lic)
  return lic
}

// Re-checks a stored key. Offline or server trouble keeps the current state (the
// 7-day grace period covers it); a definite "not valid" from Polar ends Pro.
export async function revalidateLicense(lic: License, f: Fetch = fetch, now = Date.now()): Promise<License> {
  const org = await organizationId()
  if (!org) return lic
  const body: Record<string, string> = { key: lic.key, organization_id: org }
  if (lic.activationId) body.activation_id = lic.activationId
  let res: { status: number; data: PolarKey & PolarError }
  try {
    res = await call<PolarKey>('validate', body, f)
  } catch {
    return lic
  }
  let next: License
  if (res.status === 200) {
    next = { ...lic, status: 'granted', email: res.data.customer?.email ?? lic.email, expiresAt: res.data.expires_at ?? null, checkedAt: now }
  } else if (res.status === 404) {
    next = { ...lic, status: 'revoked' }
  } else {
    return lic
  }
  await saveLicense(next)
  return next
}

// Re-checks the saved key if it's due (or always, when forced).
export async function recheckLicense(force = false, f: Fetch = fetch): Promise<License | null> {
  const lic = await loadLicense()
  if (!lic || (!force && !needsRecheck(lic))) return lic
  return revalidateLicense(lic, f)
}
