// Free vs Pro, in one place. To move a feature between plans, change its tier here.
// Everything else asks `can(feature)` (via usePlan) instead of checking the plan itself.

export type Tier = 'free' | 'pro'

const DEFINITIONS = {
  // Documents
  pdfNoBranding: { tier: 'pro' as Tier, label: 'PDF without the StepCrumb footer' },
  exportWord: { tier: 'pro' as Tier, label: 'Word export' },
  exportHtml: { tier: 'pro' as Tier, label: 'HTML export' },
  exportMarkdown: { tier: 'pro' as Tier, label: 'Markdown export' },
  // Video
  video1080: { tier: 'pro' as Tier, label: '1080p video' },
  videoNoWatermark: { tier: 'pro' as Tier, label: 'Video without the StepCrumb mark' },
  videoAnyLength: { tier: 'pro' as Tier, label: 'Videos longer than 5 minutes' },
  customHighlight: { tier: 'pro' as Tier, label: 'Your own highlight colour (e.g. your brand colour)' },
  autoBlurWords: { tier: 'pro' as Tier, label: 'Auto-blur your own words and patterns (names, record numbers)' },
  allVoices: { tier: 'pro' as Tier, label: 'All voices' },
  allBackgrounds: { tier: 'pro' as Tier, label: 'All video backgrounds' },
} satisfies Record<string, { tier: Tier; label: string }>

export type Feature = keyof typeof DEFINITIONS
export const FEATURES: Record<Feature, { tier: Tier; label: string }> = DEFINITIONS

// What the free plan gets where a Pro feature is missing.
export const FREE_LIMITS = {
  videoWidth: 1280, // 720p (Pro: 1920, 1080p)
  videoMaxMs: 5 * 60 * 1000,
  voice: 'af_heart',
  background: 'gradient',
  // Backgrounds the free plan can use ('none' = full screen, no frame).
  backgrounds: ['gradient', 'none'] as string[],
} as const

export const PRO_VIDEO_WIDTH = 1920

export const can = (feature: Feature, pro: boolean): boolean => FEATURES[feature].tier === 'free' || pro

// Video export settings for the current plan.
export function videoLimits(pro: boolean) {
  return {
    width: can('video1080', pro) ? PRO_VIDEO_WIDTH : FREE_LIMITS.videoWidth,
    maxMs: can('videoAnyLength', pro) ? undefined : FREE_LIMITS.videoMaxMs,
    watermark: !can('videoNoWatermark', pro),
  }
}

// Which feature each export format needs (formats not listed are free).
const EXPORT_FEATURE: Record<string, Feature> = { docx: 'exportWord', html: 'exportHtml', md: 'exportMarkdown' }
export const exportFeature = (format: string): Feature | undefined => EXPORT_FEATURE[format]
