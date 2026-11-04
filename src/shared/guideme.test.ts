import { describe, expect, it } from 'vitest'
import { checkedOf, expectedOf, healthSummary, isFinalAction, pageKey } from './guideme'
import { confidentMatch, rank, repairedLocator } from './locate'
import type { Guide, Locator } from './types'

describe('what a step expects', () => {
  it('reads typed and chosen values from the step text', () => {
    expect(expectedOf({ action: 'type', title: 'Type "Website relaunch" into the "Project name" field' })).toBe('Website relaunch')
    expect(expectedOf({ action: 'select', title: 'Select "Customer" from the "Stage" dropdown' })).toBe('Customer')
  })
  it('has no expectation for secret or personal values', () => {
    expect(expectedOf({ action: 'type', title: 'Enter your password in the "Password" field' })).toBeUndefined()
    expect(expectedOf({ action: 'type', title: 'Type an email address into the "Email" field' })).toBeUndefined()
  })
  it('knows whether a checkbox was ticked or cleared', () => {
    const target = { tag: 'input', inputType: 'checkbox', label: 'Remember me' }
    expect(checkedOf({ action: 'click', title: 'Check "Remember me"', target })).toBe(true)
    expect(checkedOf({ action: 'click', title: 'Uncheck "Remember me"', target })).toBe(false)
    expect(checkedOf({ action: 'click', title: 'Click the "Save" button', target: { tag: 'button', label: 'Save' } })).toBeUndefined()
  })
})

describe('final actions (stopped in practice mode)', () => {
  it('stops buttons that commit something', () => {
    for (const l of ['Save', 'Save contact', 'Submit', 'Pay now', 'Delete', 'Place order', 'Create project', 'Send']) expect(isFinalAction(l)).toBe(true)
  })
  it('lets navigation and opening things through', () => {
    for (const l of ['New project', 'Contacts', 'Next', 'Open', 'Edit', 'Search', 'Saved views']) expect(isFinalAction(l)).toBe(false)
  })
})

describe('pages', () => {
  it('matches pages by origin and path', () => {
    expect(pageKey('https://app.example.com/contacts/?tab=1#x')).toBe('https://app.example.com/contacts')
    expect(pageKey('https://app.example.com/')).toBe('https://app.example.com/')
    expect(pageKey('chrome://extensions')).toBeNull()
  })
})

describe('self-repair', () => {
  const saved: Locator = { tag: 'button', id: 'new', label: 'New project', text: 'New project', context: 'Projects', pageX: 0.8, pageY: 0.1 }
  it('notices a renamed or re-identified element and keeps the recorded position', () => {
    const found: Locator = { tag: 'button', id: 'add-project', label: 'New project', text: 'New project', context: 'Projects', pageX: 0.5, pageY: 0.2 }
    const fixed = repairedLocator(saved, found)
    expect(fixed?.id).toBe('add-project')
    expect(fixed?.pageX).toBe(0.8)
  })
  it('leaves an unchanged element alone', () => {
    expect(repairedLocator(saved, { ...saved, pageX: 0.3 })).toBeNull()
  })
  it('only repairs from a clear match', () => {
    const cands: Locator[] = [
      { tag: 'button', id: 'add-project', label: 'New project', text: 'New project', context: 'Projects', pageX: 0.8, pageY: 0.1 },
      { tag: 'button', label: 'Settings', text: 'Settings', pageX: 0.1, pageY: 0.1 },
    ]
    const r = rank(saved, cands)
    expect(r.index).toBe(0)
    expect(confidentMatch(r)).toBe(true)
    const twins: Locator[] = [
      { tag: 'button', label: 'New project', text: 'New project', pageX: 0.2, pageY: 0.5 },
      { tag: 'button', label: 'New project', text: 'New project', pageX: 0.25, pageY: 0.5 },
    ]
    expect(confidentMatch(rank({ ...saved, id: undefined, context: undefined }, twins))).toBe(false)
  })
})

describe('health score', () => {
  it('counts found and repaired steps as OK', () => {
    const step = (id: string, action: 'click' | 'navigate' = 'click') => ({ id, kind: 'step' as const, title: id, action, annotations: [], createdAt: 0 })
    const g = {
      steps: [step('go', 'navigate'), step('a'), step('b'), step('c'), step('d')],
      health: { at: 1, source: 'play', results: { a: 'found', b: 'repaired', c: 'missed', d: 'skipped' } },
    } as unknown as Guide
    expect(healthSummary(g)).toMatchObject({ total: 3, ok: 2, repaired: 1, missed: 1, unchecked: 1 })
  })
})
