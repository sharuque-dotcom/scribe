// Claude integration: rewrites step text and writes SOP / training documents.
// Runs in the browser with the user's own API key (stored locally only).
import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageParam, BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { stepNumbers, sites } from './templates'
import type { DocKind, Guide } from './types'
import type { Rendered } from './export'

export const MODEL = 'claude-opus-5-5'
// On a safety-classifier decline, the API re-runs the request on Anthropic's
// recommended fallback model instead of returning a refusal.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
const MAX_IMAGES = 30

export interface AiSettings {
  apiKey: string
  includeScreenshots: boolean
  audience: string
  tone: string
}

const SETTINGS_KEY = 'scribe.ai'

export function loadSettings(): AiSettings {
  const defaults: AiSettings = { apiKey: '', includeScreenshots: true, audience: 'new team members', tone: 'clear and friendly' }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

export function saveSettings(s: AiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

// A plain-text outline of the guide, with screenshots attached after their step.
function guideContent(guide: Guide, rendered: Rendered, withImages: boolean): BetaContentBlockParam[] {
  const nums = stepNumbers(guide)
  const blocks: BetaContentBlockParam[] = []
  const lines: string[] = [
    `Guide title: ${guide.title}`,
    guide.description ? `Description: ${guide.description}` : '',
    `Sites used: ${sites(guide).join(', ') || 'unknown'}`,
    '',
    'Captured steps:',
  ]
  let images = 0
  const flush = () => {
    const text = lines.filter((l) => l !== undefined).join('\n')
    if (text.trim()) blocks.push({ type: 'text', text })
    lines.length = 0
  }
  for (const s of guide.steps) {
    if (s.kind === 'heading') lines.push(`\n## Section: ${s.title}`)
    else if (s.kind === 'note') lines.push(`[${s.noteStyle ?? 'info'} note] ${s.title}${s.detail ? ' — ' + s.detail : ''}`)
    else {
      const n = nums.get(s.id)!
      const meta = [s.action && `action=${s.action}`, s.pageTitle && `page="${s.pageTitle}"`].filter(Boolean).join(', ')
      lines.push(`Step ${n}: ${s.title}${s.detail ? ` (${s.detail})` : ''}${meta ? `  [${meta}]` : ''}`)
      const shot = rendered[s.id]
      if (withImages && shot && images < MAX_IMAGES) {
        flush()
        const [head, data] = shot.split(',', 2)
        const media = head.includes('image/png') ? 'image/png' : 'image/jpeg'
        blocks.push({ type: 'image', source: { type: 'base64', media_type: media, data } })
        images++
      }
    }
  }
  flush()
  return blocks
}

function explainError(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) return new Error('The API key was rejected. Check it in Settings.')
  if (err instanceof Anthropic.PermissionDeniedError) return new Error('This API key does not have access to this model.')
  if (err instanceof Anthropic.RateLimitError) return new Error('Rate limited by the API. Wait a moment and try again.')
  if (err instanceof Anthropic.APIConnectionError) return new Error('Could not reach the Claude API. Check your connection.')
  if (err instanceof Anthropic.APIError) return new Error(`Claude API error (${err.status ?? 'unknown'}): ${err.message}`)
  return err instanceof Error ? err : new Error(String(err))
}

// ---------- polish steps ----------

export interface PolishResult {
  title: string
  description: string
  steps: { number: number; title: string; detail: string }[]
}

const POLISH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'steps'],
  properties: {
    title: { type: 'string', description: 'Short task-focused title, e.g. "Create a new customer record in HubSpot".' },
    description: { type: 'string', description: 'One or two sentences on what this guide achieves and when to use it.' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'title', 'detail'],
        properties: {
          number: { type: 'integer' },
          title: { type: 'string', description: 'Imperative instruction, under 90 characters.' },
          detail: { type: 'string', description: 'Optional extra context (why, what to expect). Empty string if none.' },
        },
      },
    },
  },
} as const

export async function polishSteps(guide: Guide, rendered: Rendered, settings: AiSettings): Promise<PolishResult> {
  const system = `You edit step-by-step software guides that were recorded automatically from someone's clicks.
Rewrite each step as a clear, imperative instruction for ${settings.audience}, in a ${settings.tone} tone.
Use the screenshots to name buttons, fields and menus exactly as they appear on screen.
Keep the same number of steps and the same step numbers. Never invent steps or values.
Keep quoted values that were typed exactly as recorded. Where a step's purpose isn't obvious, add a short detail; otherwise leave detail empty.`
  try {
    const res = await client(settings.apiKey).beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: POLISH_SCHEMA } },
      system,
      messages: [
        { role: 'user', content: [...guideContent(guide, rendered, settings.includeScreenshots), { type: 'text', text: 'Rewrite the title, description and every step.' }] },
      ],
    })
    if (res.stop_reason === 'refusal') throw new Error('Claude declined to rewrite this guide.')
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return JSON.parse(text) as PolishResult
  } catch (err) {
    throw explainError(err)
  }
}

// ---------- documents ----------

const DOC_BRIEF: Record<DocKind, string> = {
  sop: `Write a Standard Operating Procedure (SOP) in Markdown with these sections:
a short header table (Document type, Version 1.0, Effective date, Owner "_Add owner_", System),
1. Purpose, 2. Scope, 3. Roles and responsibilities, 4. Prerequisites, 5. Procedure (numbered steps grouped into logical phases with ### headings),
6. Expected result / verification, 7. Troubleshooting (likely problems and fixes, only ones plausible from the screens), 8. Revision history table.`,
  training: `Write a self-paced training module in Markdown with these sections:
a one-paragraph introduction with estimated time, "What you'll learn" (3-5 objectives), "Before you start",
"Walkthrough" (numbered steps grouped into phases with ### headings, each with a short "why this matters" where useful),
"Common mistakes", "Practice exercise" (a realistic scenario to repeat the task with different sample data, as a checklist),
"Check your understanding" (5 multiple-choice questions, options A-D), an answer key inside <details><summary>Answer key</summary> ... </details>,
and a "Quick reference" card listing the steps in one line each.`,
}

export async function writeDocument(
  kind: DocKind,
  guide: Guide,
  rendered: Rendered,
  settings: AiSettings,
  onText: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const total = stepNumbers(guide).size
  const system = `You turn recorded software walkthroughs into polished internal documentation.
Audience: ${settings.audience}. Tone: ${settings.tone}.
${DOC_BRIEF[kind]}

Screenshots: to place the screenshot for a step, put {{screenshot:N}} alone on its own line right after that step, where N is the captured step number (1-${total}). Include every captured step's screenshot exactly once, in order.
Rules: base everything on the captured steps and screenshots; name UI elements exactly as shown; do not invent features, data, policies or people. Where something must be filled in by the reader's organisation, write _Add ..._ as a placeholder.
Output only the Markdown document, starting with a # title.`

  let text = ''
  try {
    const stream = client(settings.apiKey).beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system,
        messages: [
          {
            role: 'user',
            content: [...guideContent(guide, rendered, settings.includeScreenshots), { type: 'text', text: `Write the ${kind === 'sop' ? 'SOP' : 'training module'} now.` }],
          } satisfies BetaMessageParam,
        ],
      },
      { signal },
    )
    stream.on('text', (delta) => {
      text += delta
      onText(text)
    })
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') throw new Error('Claude declined to write this document.')
    if (final.stop_reason === 'max_tokens') text += '\n\n_(The document was cut off because it reached the length limit.)_'
    return text
  } catch (err) {
    if (signal?.aborted) return text
    throw explainError(err)
  }
}
