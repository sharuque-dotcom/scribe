// Finds personal details in text: emails, phone numbers, card numbers,
// Emirates ID numbers, IBANs, and the person's own words or patterns.
// Used to blur them on screenshots and video, and to keep them out of step text.

export type PiiKind = 'email' | 'phone' | 'card' | 'emiratesId' | 'iban' | 'custom'

export interface AutoBlurSettings {
  on: boolean
  kinds: Record<Exclude<PiiKind, 'custom'>, boolean>
  // Words (matched anywhere, any case) or /patterns/ (regular expressions). Pro.
  custom: string[]
}

export const DEFAULT_AUTO_BLUR: AutoBlurSettings = {
  on: true,
  kinds: { email: true, phone: true, card: true, emiratesId: true, iban: true },
  custom: [],
}

export const PII_LABEL: Record<PiiKind, string> = {
  email: 'Email addresses',
  phone: 'Phone numbers',
  card: 'Card numbers',
  emiratesId: 'Emirates ID numbers',
  iban: 'Bank account numbers (IBAN)',
  custom: 'Your own words and patterns',
}

// How a hidden value reads in step text: "Type an email address into …".
export const PII_PHRASE: Record<PiiKind, string> = {
  email: 'an email address',
  phone: 'a phone number',
  card: 'a card number',
  emiratesId: 'an Emirates ID number',
  iban: 'an IBAN',
  custom: 'a hidden value',
}

export interface PiiMatch {
  start: number
  end: number
  kind: PiiKind
}

const digits = (s: string) => s.replace(/\D/g, '')

// Card numbers pass the Luhn check; ordinary long numbers mostly don't.
export function luhn(num: string): boolean {
  let sum = 0
  let double = false
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

// IBANs pass the ISO 7064 mod-97 check.
export function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false
  const moved = s.slice(4) + s.slice(0, 4)
  let rem = 0
  for (const ch of moved) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of v) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97
  }
  return rem === 1
}

interface Rule {
  kind: PiiKind
  re: RegExp
  ok?: (m: string) => boolean
}

const RULES: Rule[] = [
  { kind: 'email', re: /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi },
  // 784-YYYY-NNNNNNN-C, with or without separators.
  { kind: 'emiratesId', re: /(?<![\d-])784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d(?![\d-])/g },
  { kind: 'iban', re: /(?<![A-Z0-9])[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}(?![A-Z0-9])/g, ok: ibanValid },
  // 13–19 digits, optionally in groups, that pass the card check.
  { kind: 'card', re: /(?<![\d-])\d(?:[\s-]?\d){12,18}(?![\d-])/g, ok: (m) => luhn(digits(m)) },
  // +971 50 123 4567, 050 123 4567, 04 123 4567, (555) 123-4567, +44 20 7946 0958 …
  {
    kind: 'phone',
    re: /(?<![\w+])(?:\+\d{1,3}[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?\d{1,4}(?:[\s.-]?\d{2,4}){1,4}|0\d{1,2}[\s.-]?\d{3}[\s.-]?\d{3,4}|\(\d{3}\)\s?\d{3}[\s.-]\d{4})(?![\w])/g,
    ok: (m) => {
      const n = digits(m).length
      return n >= 8 && n <= 15
    },
  },
]

// Words and /patterns/ from Settings, as safe regular expressions.
export function customRules(custom: string[]): RegExp[] {
  const out: RegExp[] = []
  for (const raw of custom) {
    const t = raw.trim()
    if (!t) continue
    const re = t.match(/^\/(.+)\/([a-z]*)$/)
    try {
      if (re) out.push(new RegExp(re[1], re[2].includes('i') ? 'gi' : 'g'))
      else if (t.length >= 2) out.push(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))
    } catch {
      // A pattern that isn't valid is skipped.
    }
  }
  return out
}

// Every personal detail in the text, not overlapping, in order.
export function findPii(text: string, settings: AutoBlurSettings, custom: RegExp[] = customRules(settings.custom)): PiiMatch[] {
  if (!settings.on || !text) return []
  const found: PiiMatch[] = []
  const taken = (s: number, e: number) => found.some((f) => s < f.end && e > f.start)
  const add = (re: RegExp, kind: PiiKind, ok?: (m: string) => boolean) => {
    re.lastIndex = 0
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (!m[0]) {
        re.lastIndex++
        continue
      }
      const s = m.index
      const e = s + m[0].length
      if ((!ok || ok(m[0])) && !taken(s, e)) found.push({ start: s, end: e, kind })
    }
  }
  for (const re of custom) add(re, 'custom')
  for (const r of RULES) if (settings.kinds[r.kind as Exclude<PiiKind, 'custom'>]) add(r.re, r.kind, r.ok)
  return found.sort((a, b) => a.start - b.start)
}

// The text with personal details replaced, e.g. "Call [phone number]".
export function maskPii(text: string, settings: AutoBlurSettings): string {
  const found = findPii(text, settings)
  if (!found.length) return text
  let out = ''
  let at = 0
  for (const f of found) {
    out += text.slice(at, f.start) + `[${PII_PHRASE[f.kind].replace(/^an? /, '')}]`
    at = f.end
  }
  return out + text.slice(at)
}

// The kind, when the whole value is one personal detail (so step text can say
// "Type an email address" instead of quoting it).
export function wholePii(text: string, settings: AutoBlurSettings): PiiKind | null {
  const t = text.trim()
  const found = findPii(t, settings)
  return found.length === 1 && found[0].start === 0 && found[0].end === t.length ? found[0].kind : null
}

// A value still being typed that is on its way to a personal detail: an email
// once it has an @, a number once it has 6 digits (phone, card, ID, IBAN; years and small amounts stay readable). Used
// to blur the field while someone types, before the full pattern appears.
export function piiInProgress(value: string, settings: AutoBlurSettings): boolean {
  if (!settings.on || !value) return false
  const k = settings.kinds
  if (k.email && value.includes('@')) return true
  if ((k.phone || k.card || k.emiratesId || k.iban) && (value.match(/\d/g)?.length ?? 0) >= 6) return true
  return findPii(value, settings).length > 0
}
