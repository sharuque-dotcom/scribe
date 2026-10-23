// Checks the Claude features against a stand-in API (no key or network needed):
// request shape, step rewriting, and streamed document writing.
// Usage: npm run build && CHROMIUM_PATH=/path/to/chrome node tests/e2e-ai.mjs [outDir]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'tests/output'))
mkdirSync(out, { recursive: true })
const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  viewport: { width: 1400, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
})
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
const extId = new URL(sw.url()).host
const check = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg)
  console.log('ok -', msg)
}

const TRAINING = `# Training: Add a new contact in Acme CRM

Learn to add a contact in about 5 minutes.

## What you'll learn
- Create a contact record

## Walkthrough
### Open the form
1. Go to the Contacts page.
{{screenshot:1}}
2. Click **+ New contact**.
{{screenshot:2}}
### Fill in the details
3. Enter the full name.
{{screenshot:3}}
4. Enter the email address.
{{screenshot:4}}
5. Choose **Customer** as the lifecycle stage.
{{screenshot:5}}
6. Click **Save contact**.
{{screenshot:6}}

## Check your understanding
1. Where do you set the lifecycle stage?
   A. Settings  B. The contact form  C. Reports  D. Deals

<details><summary>Answer key</summary>

1. B

</details>
`

const requests = []
await ctx.route('https://api.anthropic.com/**', async (route) => {
  const req = route.request()
  const body = JSON.parse(req.postData())
  requests.push({ url: req.url(), headers: await req.allHeaders(), body })
  const cors = { 'access-control-allow-origin': '*' }
  if (!body.stream) {
    const steps = [1, 2, 3, 4, 5, 6].map((n) => ({ number: n, title: `Polished step ${n}`, detail: n === 2 ? 'Opens the new-contact form.' : '' }))
    const json = { title: 'Add a contact in Acme CRM', description: 'Create a contact and set its stage.', steps }
    return route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(json) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }),
    })
  }
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
  const chunks = TRAINING.match(/[\s\S]{1,80}/g)
  const sse =
    ev('message_start', { message: { id: 'msg_2', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    chunks.map((t) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: t } })).join('') +
    ev('content_block_stop', { index: 0 }) +
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 300 } }) +
    ev('message_stop', {})
  return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse })
})

try {
  const page = await ctx.newPage()
  await page.goto(`chrome-extension://${extId}/editor.html#/`)
  await page.evaluate(() => localStorage.setItem('scribe.ai', JSON.stringify({ apiKey: 'sk-ant-test', includeScreenshots: true, audience: 'new sales reps', tone: 'friendly' })))
  await page.getByRole('button', { name: 'Open a sample guide' }).click()
  await page.waitForSelector('textarea[aria-label^="Step"]')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(out, 'ai-0-sample.png') })

  await page.getByRole('button', { name: /Improve steps with Claude/ }).click()
  await page.getByText('Claude rewrote 6 steps').waitFor()
  const titles = await page.$$eval('textarea[aria-label$=" text"]', (els) => els.map((e) => e.value))
  check(titles.filter((t) => t.startsWith('Polished step')).length === 6, 'all 6 steps rewritten; tip and heading untouched')
  check((await page.getByLabel('Guide title').inputValue()) === 'Add a contact in Acme CRM', 'title rewritten')
  const polish = requests[0]
  check(polish.body.model === 'claude-opus-5-5', 'uses claude-opus-5-5')
  check(polish.body.fallbacks === 'default' && polish.headers['anthropic-beta']?.includes('server-side-fallback-2026-07-01'), 'refusal fallback enabled')
  check(polish.body.output_config?.format?.type === 'json_schema' && polish.body.output_config.effort === 'medium', 'structured JSON output')
  check(polish.body.thinking?.type === 'adaptive', 'adaptive thinking')
  const images = polish.body.messages[0].content.filter((b) => b.type === 'image')
  check(images.length === 6 && images[0].source.media_type === 'image/jpeg', 'sends the 6 screenshots')
  check(polish.body.system.includes('new sales reps'), 'audience setting is used')
  check(polish.headers['x-api-key'] === 'sk-ant-test' || polish.headers.authorization === 'Bearer sk-ant-test', 'sends the saved key')

  // Undo restores the original text.
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(300)
  const restored = await page.$$eval('textarea[aria-label$=" text"]', (els) => els.map((e) => e.value))
  check(restored.some((t) => t.startsWith('Click the "+ New contact"')), 'undo restores the recorded steps')

  await page.goto(page.url() + '/training')
  await page.getByRole('button', { name: /Write with Claude/ }).click()
  await page.getByText('Written by Claude').waitFor()
  const frame = page.frameLocator('iframe[title="Document preview"]')
  await page.waitForTimeout(1200)
  check((await frame.locator('figure.shot img').count()) === 6, 'document shows all 6 screenshots in place')
  check((await frame.locator('details summary').textContent()) === 'Answer key', 'quiz answer key is collapsible')
  const doc = requests[1]
  check(doc.body.stream === true && doc.body.max_tokens === 64000, 'document is streamed')
  check(doc.body.system.includes('{{screenshot:N}}') && doc.body.system.includes('multiple-choice'), 'training brief and screenshot placeholders in prompt')
  await page.screenshot({ path: join(out, 'ai-1-training.png') })
  console.log('\nAll AI checks passed.')
} finally {
  await ctx.close()
}
