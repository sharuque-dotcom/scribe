// Builds SOP and training documents from captured steps without AI.
// Screenshots are placed with `{{screenshot:N}}` lines, where N is the step number.
import type { Guide, Step } from './types'

export function stepNumbers(guide: Guide): Map<string, number> {
  const map = new Map<string, number>()
  let n = 0
  for (const s of guide.steps) if (s.kind === 'step') map.set(s.id, ++n)
  return map
}

export function sites(guide: Guide): string[] {
  const hosts = new Set<string>()
  for (const s of guide.steps) {
    if (!s.url) continue
    try {
      hosts.add(new URL(s.url).host)
    } catch {
      /* ignore */
    }
  }
  return [...hosts]
}

const today = () => new Date().toISOString().slice(0, 10)

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]
}

function noteMarkdown(s: Step): string {
  const label = s.noteStyle === 'warning' ? 'Warning' : s.noteStyle === 'tip' ? 'Tip' : 'Note'
  const body = [s.title, s.detail].filter(Boolean).join(' ')
  return `> **${label}:** ${body}`
}

function procedure(guide: Guide, withShots: boolean): string {
  const nums = stepNumbers(guide)
  const out: string[] = []
  for (const s of guide.steps) {
    if (s.kind === 'heading') out.push(`### ${s.title}`)
    else if (s.kind === 'note') out.push(noteMarkdown(s))
    else {
      const n = nums.get(s.id)!
      out.push(`**Step ${n}.** ${s.title}` + (s.detail ? `\n\n${s.detail}` : ''))
      if (withShots && s.imageId) out.push(`{{screenshot:${n}}}`)
    }
  }
  return out.join('\n\n')
}

function inputsNeeded(guide: Guide): string[] {
  const fields: string[] = []
  for (const s of guide.steps) {
    if (s.kind !== 'step' || (s.action !== 'type' && s.action !== 'select')) continue
    const label = s.target?.label
    if (label && !fields.includes(label)) fields.push(label)
  }
  return fields
}

export function buildSop(guide: Guide): string {
  const where = sites(guide)
  const whereText = where.length ? joinList(where.map((h) => `\`${h}\``)) : 'the application'
  const steps = guide.steps.filter((s) => s.kind === 'step')
  const last = steps[steps.length - 1]
  const inputs = inputsNeeded(guide)

  return `# ${guide.title}

| Item | Details |
|---|---|
| **Document type** | Standard Operating Procedure |
| **Version** | 1.0 |
| **Effective date** | ${today()} |
| **Owner** | _Add owner_ |
| **System** | ${whereText} |

## 1. Purpose

${guide.description || `This procedure explains how to complete "${guide.title}" the same way every time.`}

## 2. Scope

This procedure covers the workflow in ${whereText}. It applies to everyone who performs this task.

## 3. Prerequisites

- Access to ${whereText} with the right permissions
${inputs.length ? `- The information needed for these fields: ${inputs.map((f) => `**${f}**`).join(', ')}\n` : ''}- About ${Math.max(1, Math.round(steps.length * 0.5))} minutes to complete the ${steps.length} steps

## 4. Procedure

${procedure(guide, true)}

## 5. Expected result

The procedure is complete when the final step${last ? ` ("${last.title}")` : ''} finishes without errors.

## 6. Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | ${today()} | | First version, captured with Scribe |
`
}

export function buildTraining(guide: Guide): string {
  const where = sites(guide)
  const whereText = where.length ? joinList(where.map((h) => `\`${h}\``)) : 'the application'
  const steps = guide.steps.filter((s) => s.kind === 'step')
  const headings = guide.steps.filter((s) => s.kind === 'heading').map((s) => s.title)

  const objectives = [
    `Complete "${guide.title}" on your own, start to finish`,
    `Find each control you need in ${whereText}`,
    ...headings.map((h) => `Understand the "${h}" part of the process`),
  ]

  // Simple "what comes next?" questions from consecutive steps.
  const quiz: string[] = []
  const answers: string[] = []
  for (let i = 0; i + 1 < steps.length && quiz.length < 3; i += Math.max(1, Math.floor(steps.length / 3))) {
    quiz.push(`${quiz.length + 1}. After you **${steps[i].title.replace(/\.$/, '')}**, what is the next step?`)
    answers.push(`${answers.length + 1}. ${steps[i + 1].title}`)
  }

  return `# Training: ${guide.title}

${guide.description || `This module teaches you how to complete "${guide.title}" in ${whereText}.`}

**Time needed:** about ${Math.max(5, steps.length * 2)} minutes · **Steps:** ${steps.length}

## What you'll learn

${objectives.map((o) => `- ${o}`).join('\n')}

## Before you start

- Make sure you can sign in to ${whereText}.
- Keep this guide open next to the application and follow along.

## Walkthrough

${procedure(guide, true)}

## Practice

Do the task again on your own without looking at the screenshots. Tick each step as you go:

${steps.map((s) => `- [ ] ${s.title}`).join('\n')}

## Check your understanding

${quiz.length ? quiz.join('\n') : '1. Describe the steps of this task in your own words.'}

<details><summary>Answer key</summary>

${answers.length ? answers.join('\n') : '1. See the walkthrough above.'}

</details>

## Quick reference

${steps.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}
`
}
