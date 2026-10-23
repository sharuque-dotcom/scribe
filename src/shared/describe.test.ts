import { describe, expect, it } from 'vitest'
import { cleanLabel, describeClick, describeEvent, displayUrl, looksSensitive, shouldMerge } from './describe'
import type { CapturedEvent, Step } from './types'

const ev = (over: Partial<CapturedEvent>): CapturedEvent => ({
  action: 'click',
  target: { tag: 'button', label: 'Save' },
  redactRects: [],
  url: 'https://app.example.com/contacts/new',
  pageTitle: 'New contact',
  ...over,
})

describe('describeClick', () => {
  it('names buttons, links, fields and tabs', () => {
    expect(describeClick({ tag: 'button', label: 'Save' })).toBe('Click the "Save" button')
    expect(describeClick({ tag: 'a', label: 'Pricing' })).toBe('Click the "Pricing" link')
    expect(describeClick({ tag: 'input', inputType: 'text', label: 'Email' })).toBe('Click the "Email" field')
    expect(describeClick({ tag: 'select', label: 'Country' })).toBe('Click the "Country" dropdown')
    expect(describeClick({ tag: 'div', role: 'tab', label: 'Billing' })).toBe('Open the "Billing" tab')
    expect(describeClick({ tag: 'div', role: 'menuitem', label: 'Export' })).toBe('Choose "Export" from the menu')
    expect(describeClick({ tag: 'span', label: 'Jordan Lee' })).toBe('Click "Jordan Lee"')
    expect(describeClick({ tag: 'div', label: '' })).toBe('Click here')
  })

  it('uses the state before the click for checkboxes', () => {
    expect(describeClick({ tag: 'input', inputType: 'checkbox', label: 'Remember me', checked: false })).toBe('Check "Remember me"')
    expect(describeClick({ tag: 'input', inputType: 'checkbox', label: 'Remember me', checked: true })).toBe('Uncheck "Remember me"')
  })

  it('treats submit inputs as buttons', () => {
    expect(describeClick({ tag: 'input', inputType: 'submit', label: 'Sign in' })).toBe('Click the "Sign in" button')
  })
})

describe('describeEvent', () => {
  it('describes typing, selecting, keys and navigation', () => {
    expect(describeEvent(ev({ action: 'type', target: { tag: 'input', label: 'Company' }, value: 'Acme' }))).toBe('Type "Acme" into the "Company" field')
    expect(describeEvent(ev({ action: 'select', target: { tag: 'select', label: 'Stage' }, value: 'Customer' }))).toBe('Select "Customer" from the "Stage" dropdown')
    expect(describeEvent(ev({ action: 'key', key: 'Enter' }))).toBe('Press Enter')
    expect(describeEvent(ev({ action: 'navigate' }))).toBe('Go to app.example.com/contacts/new')
  })

  it('never includes sensitive values', () => {
    const pw = describeEvent(ev({ action: 'type', target: { tag: 'input', inputType: 'password', label: 'Password' }, value: 'hunter2', sensitive: true }))
    expect(pw).toBe('Enter your password in the "Password" field')
    expect(pw).not.toContain('hunter2')
    const token = describeEvent(ev({ action: 'type', target: { tag: 'input', inputType: 'text', label: 'API key' }, value: 'sk-123', sensitive: true }))
    expect(token).toBe('Enter the required value in the "API key" field')
  })
})

describe('helpers', () => {
  it('cleans and shortens labels', () => {
    expect(cleanLabel('  Save\n  changes ')).toBe('Save changes')
    expect(cleanLabel('x'.repeat(100))).toHaveLength(60)
  })

  it('shortens URLs', () => {
    expect(displayUrl('https://example.com/')).toBe('example.com')
    expect(displayUrl('https://example.com/a/b/?q=1')).toBe('example.com/a/b')
  })

  it('flags secret fields', () => {
    expect(looksSensitive({ type: 'password' })).toBe(true)
    expect(looksSensitive({ type: 'text', autocomplete: 'cc-number' })).toBe(true)
    expect(looksSensitive({ type: 'text', name: 'api_key' })).toBe(true)
    expect(looksSensitive({ type: 'text', name: 'email' })).toBe(false)
    expect(looksSensitive({ type: 'text', name: 'company' })).toBe(false)
  })
})

describe('shouldMerge', () => {
  const click: Step = { id: '1', kind: 'step', title: 'Click the "Email" field', action: 'click', elementKey: 'INPUT|email|', annotations: [], createdAt: 1000 }
  it('merges typing into the click on the same field', () => {
    expect(shouldMerge(click, ev({ action: 'type', elementKey: 'INPUT|email|' }), 2000)).toBe(true)
  })
  it('keeps separate steps for different fields, clicks, or long gaps', () => {
    expect(shouldMerge(click, ev({ action: 'type', elementKey: 'INPUT|name|' }), 2000)).toBe(false)
    expect(shouldMerge(click, ev({ action: 'click', elementKey: 'INPUT|email|' }), 2000)).toBe(false)
    expect(shouldMerge(click, ev({ action: 'type', elementKey: 'INPUT|email|' }), 1000 + 10 * 60_000)).toBe(false)
    expect(shouldMerge(undefined, ev({ action: 'type', elementKey: 'x' }), 0)).toBe(false)
  })
})
