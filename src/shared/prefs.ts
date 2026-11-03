// Look preferences kept on this computer: the click-highlight colour.
// Presets are free; any other colour (e.g. a brand colour) needs Pro.
import { isPro, loadLicense } from './license'
import { HIGHLIGHT, HIGHLIGHT_PRESETS, setHighlightColor } from './render'

const KEY = 'highlightColor'
const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local

async function readRaw(): Promise<string | undefined> {
  try {
    if (hasChromeStorage()) return (await chrome.storage.local.get(KEY))[KEY] as string | undefined
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

// The colour to use now. A custom colour falls back to the default if Pro has ended.
export async function loadHighlight(): Promise<string> {
  const c = (await readRaw()) ?? HIGHLIGHT
  if (HIGHLIGHT_PRESETS.includes(c.toLowerCase())) return c
  return isPro(await loadLicense()) ? c : HIGHLIGHT
}

// Reads the saved colour and applies it to everything drawn after this.
export async function applyHighlight(): Promise<string> {
  const c = await loadHighlight()
  setHighlightColor(c)
  return c
}

export async function saveHighlight(c: string): Promise<void> {
  try {
    if (hasChromeStorage()) await chrome.storage.local.set({ [KEY]: c })
    else localStorage.setItem(KEY, c)
  } catch {
    // Not saved; it still applies until the page reloads.
  }
  setHighlightColor(c)
}
