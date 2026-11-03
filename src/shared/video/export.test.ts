import { describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_SETTINGS, type GuideVideo } from '../types'
import { FREE_LIMITS, videoLimits } from '../plans'
import { exportVideo } from './export'
import { planVideo } from './timeline'

describe('free plan video length', () => {
  it('refuses free exports longer than 5 minutes, before doing any work', async () => {
    const video: GuideVideo = { blobId: 'b', duration: FREE_LIMITS.videoMaxMs + 5000, w: 1280, h: 800, cursor: [], redact: [], trimStart: 0, settings: { ...DEFAULT_VIDEO_SETTINGS } }
    const plan = planVideo(video, [])
    await expect(
      exportVideo({ recording: new Blob([]), video, steps: [], plan, clips: {}, onProgress: () => {}, limits: videoLimits(false) }),
    ).rejects.toThrow('Free exports are up to 5 minutes')
  })
})
