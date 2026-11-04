// Starts Guide me for a guide: the background opens (or finds) the guide's
// website and the page shows a spotlight on each step. Returns an error to show, if any.
import type { Guide } from '../shared/types'

export const canGuideMe = (g: Guide) => g.steps.some((s) => s.url && /^https?:/.test(s.url))

// practice: Save, Submit, Pay and similar buttons are stopped, so nothing is changed.
export async function startGuideMe(guideId: string, opts: { practice?: boolean } = {}): Promise<string | null> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'guide-start', guideId, practice: !!opts.practice })) as { ok: boolean; error?: string }
    return res?.ok ? null : res?.error ?? "Guide me couldn't start."
  } catch {
    return 'Guide me needs the StepCrumb browser extension.'
  }
}

// Check this guide: looks for each step's element on the live pages, without clicking.
export async function checkGuide(guideId: string): Promise<string | null> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'guide-check', guideId })) as { ok: boolean; error?: string }
    return res?.ok ? null : res?.error ?? "The check couldn't run."
  } catch {
    return 'Checking needs the StepCrumb browser extension.'
  }
}
