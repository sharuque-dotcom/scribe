// Starts Guide me for a guide: the background opens (or finds) the guide's
// website and the page shows a spotlight on each step. Returns an error to show, if any.
import type { Guide } from '../shared/types'

export const canGuideMe = (g: Guide) => g.steps.some((s) => s.url && /^https?:/.test(s.url))

export async function startGuideMe(guideId: string): Promise<string | null> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'guide-start', guideId })) as { ok: boolean; error?: string }
    return res?.ok ? null : res?.error ?? "Guide me couldn't start."
  } catch {
    return 'Guide me needs the StepCrumb browser extension.'
  }
}
