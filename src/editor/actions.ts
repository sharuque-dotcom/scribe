// Things any editor page can start: a capture, a blank guide, the plans window, Settings.
import { putGuide } from '../shared/db'
import type { CaptureMode, Guide, RecorderState } from '../shared/types'
import { uid } from '../shared/types'
import { isExtension } from './ui'

// Starts capturing on the website they were last on (the background brings it
// to the front). For video, Chrome's share dialog asks what to record.
// Returns a message to show if it couldn't start.
export async function startCapture(mode: CaptureMode): Promise<string | null> {
  if (!isExtension) return 'Capturing needs the StepCrumb browser extension.'
  await chrome.storage.local.set({ recordMode: mode })
  const st = (await chrome.runtime.sendMessage({ type: 'start', mode, fromLibrary: true })) as RecorderState
  return !st?.recording && st?.notice ? st.notice : null
}

export async function newBlankGuide(): Promise<void> {
  const now = Date.now()
  const g: Guide = { id: uid(), title: 'Untitled guide', description: '', createdAt: now, updatedAt: now, status: 'ready', steps: [], docs: {} }
  await putGuide(g)
  location.hash = `#/guide/${g.id}`
}

// The app shell listens for these and opens the window.
export const openPlans = () => window.dispatchEvent(new Event('stepcrumb:plans'))
export const openSettings = () => window.dispatchEvent(new Event('stepcrumb:settings'))
export const focusSearch = () => window.dispatchEvent(new Event('stepcrumb:search'))
