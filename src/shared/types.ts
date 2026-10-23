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
}

export interface RecorderState {
  recording: boolean
  paused: boolean
  guideId?: string
  count: number
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
