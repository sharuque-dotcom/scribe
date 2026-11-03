import { describe, expect, it } from 'vitest'
import { PIECE_CHARS, splitForSpeech } from './voice'

describe('splitForSpeech', () => {
  it('keeps short lines whole', () => {
    expect(splitForSpeech('  Click the "Save" button  ')).toEqual(['Click the "Save" button'])
  })
  it('splits long lines into pieces the model handles, keeping every word', () => {
    const long = 'Type "' + 'Patient arrived with mild symptoms, referred by the clinic, follow up next week. '.repeat(8) + '" into the "Notes" field'
    const pieces = splitForSpeech(long)
    expect(pieces.length).toBeGreaterThan(1)
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(PIECE_CHARS + 1)
    expect(pieces.join(' ').replace(/\s+/g, ' ')).toBe(long.replace(/\s+/g, ' ').trim())
  })
  it('splits text with no spaces at the limit', () => {
    const pieces = splitForSpeech('x'.repeat(450))
    expect(pieces.map((p) => p.length)).toEqual([200, 200, 50])
  })
})
