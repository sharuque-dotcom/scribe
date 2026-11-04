// Anonymous counts, e.g. "a guide was made" or "a PDF was exported". Only the
// event name is sent: never what was captured, no page addresses, no IDs. People
// can switch it off in Settings. Fire and forget: errors are ignored, nothing is
// queued or retried.

export type CountEvent =
  | 'guide_created'
  | 'export_pdf'
  | 'export_docx'
  | 'export_html'
  | 'export_md'
  | 'export_json'
  | 'export_video'
  | 'export_captions'
  | 'export_sop'
  | 'export_training'

export const COUNT_URL = 'https://www.stepcrumb.com/api/count'
const KEY = 'anonymousCounts'

export async function countsOn(): Promise<boolean> {
  try {
    return (await chrome.storage.local.get(KEY))[KEY] !== false
  } catch {
    return false
  }
}

export async function setCountsOn(on: boolean): Promise<void> {
  await chrome.storage.local.set({ [KEY]: on })
}

export function count(e: CountEvent): void {
  void (async () => {
    try {
      if (!(await countsOn())) return
      await fetch(COUNT_URL, { method: 'POST', body: JSON.stringify({ e }), headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'omit' })
    } catch {
      // Offline or blocked: skip it.
    }
  })()
}
