import { describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_SETTINGS, type GuideVideo } from '../types'
import { exportVideo, FREE_MAX_MS } from './export'
import { planVideo } from './timeline'

describe('free plan video length', () => {
  it('refuses free exports longer than 2 minutes, before doing any work', async () => {
    const video: GuideVideo = { blobId: 'b', duration: FREE_MAX_MS + 5000, w: 1280, h: 800, cursor: [], redact: [], trimStart: 0, settings: { ...DEFAULT_VIDEO_SETTINGS } }
    const plan = planVideo(video, [])
    await expect(
      exportVideo({ recording: new Blob([]), video, steps: [], plan, clips: {}, onProgress: () => {}, free: true }),
    ).rejects.toThrow('Free exports are up to 2 minutes')
  })
})
