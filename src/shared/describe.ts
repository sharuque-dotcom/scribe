// Turns a captured interaction into a plain-language instruction,
// e.g. `Click the "Save" button` or `Type "Acme" into the "Company" field`.
import type { CapturedEvent, Step, TargetInfo } from './types'

const MAX_LABEL = 60

export function cleanLabel(raw: string | null | undefined): string {
  if (!raw) return ''
  const text = raw.replace(/\s+/g, ' ').trim()
  return text.length > MAX_LABEL ? text.slice(0, MAX_LABEL - 1).trimEnd() + '…' : text
}

const q = (s: string) => `"${s}"`

function fieldNoun(t: TargetInfo): string {
  if (t.tag === 'select' || t.role === 'combobox' || t.role === 'listbox') return 'dropdown'
  if (t.tag === 'textarea') return 'box'
  return 'field'
}

export function describeClick(t: TargetInfo): string {
  const label = cleanLabel(t.label)
  const role = t.role ?? ''
  const type = (t.inputType ?? '').toLowerCase()

  if (t.tag === 'input' && (type === 'checkbox' || role === 'checkbox' || role === 'switch')) {
    // `checked` is read before the click flips it.
    const verb = t.checked ? 'Uncheck' : 'Check'
    return label ? `${verb} ${q(label)}` : `${verb} the box`
  }
  if (role === 'checkbox' || role === 'switch') {
    return label ? `Toggle ${q(label)}` : 'Toggle the switch'
  }
  if ((t.tag === 'input' && type === 'radio') || role === 'radio' || role === 'option') {
    return label ? `Select ${q(label)}` : 'Select the option'
  }
  if (t.tag === 'input' && ['submit', 'button', 'reset'].includes(type)) {
    return label ? `Click the ${q(label)} button` : 'Click the button'
  }
  if (t.tag === 'input' || t.tag === 'textarea' || t.tag === 'select' || role === 'textbox' || role === 'combobox') {
    return label ? `Click the ${q(label)} ${fieldNoun(t)}` : `Click the ${fieldNoun(t)}`
  }
  if (t.tag === 'button' || role === 'button') {
    return label ? `Click the ${q(label)} button` : 'Click the button'
  }
  if (t.tag === 'a' || role === 'link') {
    return label ? `Click the ${q(label)} link` : 'Click the link'
  }
  if (role === 'tab') return label ? `Open the ${q(label)} tab` : 'Open the tab'
  if (role === 'menuitem' || role === 'menuitemradio' || role === 'menuitemcheckbox') {
    return label ? `Choose ${q(label)} from the menu` : 'Choose the menu item'
  }
  return label ? `Click ${q(label)}` : 'Click here'
}

export function describeEvent(e: CapturedEvent): string {
  const label = cleanLabel(e.target.label)
  switch (e.action) {
    case 'click':
      return describeClick(e.target)
    case 'type': {
      const where = label ? ` into the ${q(label)} ${fieldNoun(e.target)}` : ''
      if (e.sensitive) {
        const isPassword = (e.target.inputType ?? '').toLowerCase() === 'password'
        return isPassword
          ? `Enter your password${label ? ` in the ${q(label)} field` : ''}`
          : `Enter the required value${where.replace(' into', ' in')}`
      }
      const value = cleanLabel(e.value)
      return value ? `Type ${q(value)}${where}` : `Clear the ${q(label || 'text')} ${fieldNoun(e.target)}`
    }
    case 'select': {
      const value = cleanLabel(e.value)
      return label ? `Select ${q(value)} from the ${q(label)} dropdown` : `Select ${q(value)}`
    }
    case 'key':
      return `Press ${e.key ?? 'Enter'}`
    case 'navigate':
      return `Go to ${displayUrl(e.url)}`
    default:
      return label || 'Do this step'
  }
}

export function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    return (u.host + path).replace(/\/$/, '')
  } catch {
    return url
  }
}

// When someone clicks a field and then types into it, keep one step
// ("Type X into Y") instead of two. Returns true if `incoming` should
// replace `previous`.
export function shouldMerge(previous: Step | undefined, incoming: CapturedEvent, now: number): boolean {
  if (!previous || previous.kind !== 'step') return false
  if (incoming.action !== 'type' && incoming.action !== 'select') return false
  if (!incoming.elementKey || previous.elementKey !== incoming.elementKey) return false
  if (previous.action !== 'click' && previous.action !== incoming.action) return false
  return now - previous.createdAt < 5 * 60_000
}

// Values that look like secrets are hidden even when the field isn't a password field.
export function looksSensitive(attrs: { type?: string; name?: string; id?: string; autocomplete?: string }): boolean {
  if ((attrs.type ?? '').toLowerCase() === 'password') return true
  const ac = (attrs.autocomplete ?? '').toLowerCase()
  if (/cc-|current-password|new-password|one-time-code/.test(ac)) return true
  const hay = `${attrs.name ?? ''} ${attrs.id ?? ''}`.toLowerCase()
  return /(pass(word|wd)?|secret|token|api[-_]?key|ssn|social|cvv|cvc|card[-_]?num|iban|pin\b)/.test(hay)
}
