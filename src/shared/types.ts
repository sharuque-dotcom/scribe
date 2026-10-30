// Core data model shared by the extension and the editor.
// All coordinates are normalized (0..1) against the full screenshot,
// so they survive any display size or device pixel ratio.

export interface NPoint {
  x: number
  y: number
}

export interface NRect {
  x: number
  y: number
  w: number
  h: number
}

export type AnnotationType = 'box' | 'arrow' | 'text' | 'blur' | 'marker' | 'spotlight'

export interface Annotation {
  id: string
  type: AnnotationType
  // Start and end corner (or arrow tail and head). For text and marker, only x1/y1 is used.
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  text?: string
}

export type StepAction = 'click' | 'type' | 'select' | 'key' | 'navigate' | 'manual'

export interface TargetInfo {
  tag: string
  role?: string
  inputType?: string
  label: string
  checked?: boolean
}

export type StepKind = 'step' | 'note' | 'heading'
export type NoteStyle = 'info' | 'tip' | 'warning'

export interface Step {
  id: string
  kind: StepKind
  title: string
  detail?: string
  noteStyle?: NoteStyle
  action?: StepAction
  target?: TargetInfo
  url?: string
  pageTitle?: string
  imageId?: string
  click?: NPoint
  targetRect?: NRect
  showAutoHighlight?: boolean
  annotations: Annotation[]
  // A zoom area the user picked. Overrides automatic zoom.
  crop?: NRect
  // 'full' keeps this step's screenshot full screen. Unset follows the guide setting.
  zoom?: 'full'
  // Where the clicked field's label is, so zoomed images include it.
  labelRect?: NRect
  // Key that identifies the page element, used to merge "click field" + "type into field".
  elementKey?: string
  // Milliseconds into the video when this step happened (video recordings only).
  time?: number
  // What the voiceover and video caption say, if different from the step text.
  narration?: string
  createdAt: number
}

export type DocKind = 'sop' | 'training'

export interface GuideDoc {
  kind: DocKind
  markdown: string
  source: 'ai' | 'template'
  updatedAt: number
}

export interface Guide {
  id: string
  title: string
  description: string
  createdAt: number
  updatedAt: number
  status: 'recording' | 'ready'
  steps: Step[]
  docs: Partial<Record<DocKind, GuideDoc>>
  // How screenshots are framed. Unset means 'auto'.
  zoomMode?: 'auto' | 'full' | 'always'
  // Show a small full-page thumbnail on zoomed screenshots. Unset means on.
  zoomInset?: boolean
  // A screen recording made alongside the steps, if video was on.
  video?: GuideVideo
}

// ---------- video ----------

// Mouse position over time. t is ms into the video; x/y are 0..1 of the tab.
export interface CursorSample {
  t: number
  x: number
  y: number
}

// Where secret fields were on screen at a moment, so they can be blurred.
export interface RedactSample {
  t: number
  rects: NRect[]
}

// A stretch of video that zooms in. Times are ms into the recording.
export interface ZoomSegment {
  id: string
  start: number
  end: number
  scale: number
}

export type VideoBackground = 'gradient' | 'dark' | 'light' | 'none'

export interface VideoSettings {
  captions: boolean
  voice: boolean
  voiceName: string
  zoomScale: number
  background: VideoBackground
}

export interface GuideVideo {
  blobId: string
  duration: number
  w: number
  h: number
  cursor: CursorSample[]
  redact: RedactSample[]
  // Unset means zooms are worked out automatically from the clicks.
  zooms?: ZoomSegment[]
  trimStart: number
  // Unset means the end of the recording.
  trimEnd?: number
  settings: VideoSettings
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  captions: true,
  voice: true,
  voiceName: 'af_heart',
  zoomScale: 1.8,
  background: 'gradient',
}

export interface StoredVideo {
  id: string
  blob: Blob
  mime: string
}

export interface StoredImage {
  id: string
  dataUrl: string
  w: number
  h: number
}

// Payload the content script sends for each captured interaction.
export interface CapturedEvent {
  action: StepAction
  target: TargetInfo
  value?: string
  sensitive?: boolean
  key?: string
  click?: NPoint
  targetRect?: NRect
  labelRect?: NRect
  redactRects: NRect[]
  elementKey?: string
  url: string
  pageTitle: string
  // When it happened (Date.now()), used to place the step in the video.
  t?: number
}

export interface RecorderState {
  recording: boolean
  paused: boolean
  // Recording the tab as video too. The page shows no control bar then,
  // so it stays out of the video.
  video?: boolean
  rec?: VideoRecording
  guideId?: string
  count: number
}

// Bookkeeping for a video being recorded right now.
export interface VideoRecording {
  id: string
  startedAt: number
  // Total time spent paused, so step times line up with the video.
  pausedMs: number
  pausedAt?: number
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
