// Auto-blur settings, kept on this computer. Built-in kinds are free; the
// person's own words and patterns apply only with Pro.
import { isPro, loadLicense } from './license'
import { DEFAULT_AUTO_BLUR, type AutoBlurSettings } from './pii'

const KEY = 'autoBlur'

// What was saved (for the Settings screen), with defaults filled in.
export async function loadAutoBlurSaved(): Promise<AutoBlurSettings> {
  try {
    const saved = (await chrome.storage.local.get(KEY))[KEY] as Partial<AutoBlurSettings> | undefined
    return { ...DEFAULT_AUTO_BLUR, ...saved, kinds: { ...DEFAULT_AUTO_BLUR.kinds, ...saved?.kinds }, custom: saved?.custom ?? [] }
  } catch {
    return DEFAULT_AUTO_BLUR
  }
}

// What actually applies now (own words dropped without Pro).
export async function loadAutoBlur(): Promise<AutoBlurSettings> {
  const s = await loadAutoBlurSaved()
  if (!s.custom.length) return s
  return isPro(await loadLicense()) ? s : { ...s, custom: [] }
}

export async function saveAutoBlur(s: AutoBlurSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: s })
}

export function onAutoBlurChange(fn: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[KEY] || changes['stepcrumb.license'])) fn()
  })
}
