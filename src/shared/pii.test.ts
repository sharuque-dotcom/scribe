import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTO_BLUR, findPii, ibanValid, luhn, maskPii, piiInProgress, wholePii, type AutoBlurSettings } from './pii'

const kinds = (text: string, s: AutoBlurSettings = DEFAULT_AUTO_BLUR) => findPii(text, s).map((m) => [m.kind, text.slice(m.start, m.end)])

describe('findPii', () => {
  it('finds emails', () => {
    expect(kinds('Contact sam.lee+crm@acme.co.ae today')).toEqual([['email', 'sam.lee+crm@acme.co.ae']])
  })
  it('finds UAE and international phone numbers', () => {
    expect(kinds('Mobile +971 50 123 4567, office 04 123 4567')).toEqual([
      ['phone', '+971 50 123 4567'],
      ['phone', '04 123 4567'],
    ])
    expect(kinds('Call 050-123-4567 or (555) 123-4567')).toEqual([
      ['phone', '050-123-4567'],
      ['phone', '(555) 123-4567'],
    ])
  })
  it('finds Emirates ID numbers, with or without dashes', () => {
    expect(kinds('EID 784-1990-1234567-1')).toEqual([['emiratesId', '784-1990-1234567-1']])
    expect(kinds('EID 784199012345671')).toEqual([['emiratesId', '784199012345671']])
  })
  it('finds card numbers that pass the card check only', () => {
    expect(kinds('Card 4111 1111 1111 1111 on file')).toEqual([['card', '4111 1111 1111 1111']])
    expect(kinds('Order 4111111111111112')).toEqual([])
  })
  it('finds valid IBANs only', () => {
    expect(kinds('IBAN AE07 0331 2345 6789 0123 456')).toEqual([['iban', 'AE07 0331 2345 6789 0123 456']])
    expect(kinds('Ref AE00 0331 2345 6789 0123 456')).toEqual([])
  })
  it('leaves ordinary numbers, dates, times and amounts alone', () => {
    expect(kinds('Invoice 2026-11-03 at 10:45, total AED 1,209.50, qty 12, ref 12345')).toEqual([])
  })
  it('respects which kinds are switched on', () => {
    const s = { ...DEFAULT_AUTO_BLUR, kinds: { ...DEFAULT_AUTO_BLUR.kinds, email: false } }
    expect(kinds('sam@acme.io +971 50 123 4567', s)).toEqual([['phone', '+971 50 123 4567']])
    expect(kinds('sam@acme.io', { ...DEFAULT_AUTO_BLUR, on: false })).toEqual([])
  })
  it('matches your own words (any case) and /patterns/', () => {
    const s = { ...DEFAULT_AUTO_BLUR, custom: ['Al Mansoori', '/MRN-\\d{6}/', '/[/'] }
    expect(kinds('Patient AL MANSOORI, MRN-123456', s)).toEqual([
      ['custom', 'AL MANSOORI'],
      ['custom', 'MRN-123456'],
    ])
  })
})

describe('masking step text', () => {
  it('replaces details inside text', () => {
    expect(maskPii('Reply to sam@acme.io about card 4111 1111 1111 1111', DEFAULT_AUTO_BLUR)).toBe('Reply to [email address] about card [card number]')
  })
  it('knows when the whole value is one detail', () => {
    expect(wholePii(' sam@acme.io ', DEFAULT_AUTO_BLUR)).toBe('email')
    expect(wholePii('Email sam@acme.io', DEFAULT_AUTO_BLUR)).toBe(null)
  })
})

describe('checks', () => {
  it('luhn', () => {
    expect(luhn('4111111111111111')).toBe(true)
    expect(luhn('4111111111111112')).toBe(false)
  })
  it('iban', () => {
    expect(ibanValid('GB82 WEST 1234 5698 7654 32')).toBe(true)
    expect(ibanValid('GB00 WEST 1234 5698 7654 32')).toBe(false)
  })
})

describe('typing in progress', () => {
  it('flags a half-typed email or number before it is complete', () => {
    expect(piiInProgress('vid@exa', DEFAULT_AUTO_BLUR)).toBe(true)
    expect(piiInProgress('+971 50 1', DEFAULT_AUTO_BLUR)).toBe(true)
    expect(piiInProgress('2026', DEFAULT_AUTO_BLUR)).toBe(false)
    expect(piiInProgress('Jordan', DEFAULT_AUTO_BLUR)).toBe(false)
    expect(piiInProgress('vid@exa', { ...DEFAULT_AUTO_BLUR, kinds: { ...DEFAULT_AUTO_BLUR.kinds, email: false } })).toBe(false)
  })
})
