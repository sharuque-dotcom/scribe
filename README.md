# Scribe

Click through any website and get a step-by-step guide with annotated screenshots, then turn it into an SOP or a training module.

It's a Chrome/Edge extension with a built-in editor. Everything is stored in your browser. The only thing that leaves your machine is what you send to Claude, and only when you ask it to write.

## What it does

**Capture.** Press *Start capturing* and do the task as usual. Every click, typed value, dropdown choice and Enter press becomes a step with:

- a screenshot of the page at that moment
- an orange highlight around what you clicked
- a written instruction, e.g. `Click the "Save" button` or `Type "Acme" into the "Company" field`
- passwords and other secret fields (card numbers, API keys, tokens) blurred automatically. Their values never appear in step text.

Clicking a field and then typing becomes one step, not two. A small bar on the page lets you pause or finish, and it never shows up in the screenshots.

**Edit.** In the editor you can:

- rewrite any step, add detail, reorder, delete (with undo), and insert manual steps, tips or warnings, and section headings
- annotate screenshots with boxes, arrows, text labels, numbered markers, blur (pixelated redaction), spotlight (dims everything else) and crop
- upload a screenshot for a step you added by hand

**Write SOPs and training.** Each guide has two document tabs:

| | Template (offline) | Write with Claude |
|---|---|---|
| **SOP** | Purpose, scope, prerequisites, numbered procedure with screenshots, expected result, revision history | Adds roles and responsibilities, grouped phases, and troubleshooting, all written from your steps and screenshots |
| **Training** | Objectives, walkthrough, practice checklist, simple quiz, quick reference | Adds "why this matters" notes, common mistakes, a practice scenario, and a 5-question multiple-choice quiz with answer key |

*Improve steps with Claude* rewrites the title, description and every step in one go, using the screenshots to name buttons exactly. It can be undone.

**Export.** You can export guides and documents as PDF (through the print dialog), a standalone HTML page, or Markdown with embedded images. Guides can also be saved as a `.scribe.json` backup and imported again.

## Install

```bash
npm install
npm run build
```

Then in Chrome or Edge:

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin the extension so its icon is in the toolbar.

## Use

1. Open the website you want to document.
2. Click the extension icon and press **Start capturing**. The shortcut is `Alt+Shift+R`.
3. Do the task. Pause from the page bar if you need to do something you don't want recorded.
4. Press **Finish**. The editor opens with your guide.

To use Claude, open **Settings** (the gear icon) in the editor and paste an Anthropic API key from [console.anthropic.com](https://console.anthropic.com). You can also set the audience ("new support agents") and tone. The key is stored only in this browser. Requests go directly from your browser to `api.anthropic.com` using `claude-opus-5-5`, with Anthropic's automatic fallback turned on in case a request is declined. Screenshots are sent after blurring is applied, and you can turn sending screenshots off.

You can try the editor without capturing anything: open the library and click **Open a sample guide**.

## How it's built

```
src/
  extension/
    content.ts      watches clicks, typing, dropdowns and Enter on each page; shows the capture bar
    background.ts   takes screenshots, writes steps, tracks recording state
  shared/
    describe.ts     turns an interaction into instruction text; detects secret fields; merges click+type
    render.ts       draws a screenshot with crop, blur, highlight and annotations
    templates.ts    offline SOP and training documents
    ai.ts           Claude calls: step rewriting (structured JSON) and document writing (streamed)
    export.ts       HTML / Markdown / PDF / JSON
    db.ts           IndexedDB storage (guides and screenshots kept separately)
  editor/           React editor: library, steps, annotator, preview, SOP and training tabs
  popup/            toolbar popup: start, pause, finish, discard, recent guides
```

Screenshots use `chrome.tabs.captureVisibleTab`. All positions (highlights, annotations, crop) are stored relative to the image (0–1), so they work at any screen size or zoom level.

## Develop and test

```bash
npm run dev         # editor in a normal browser tab (capturing needs the extension)
npm test            # unit tests: step wording, secret detection, merging, templates
npm run lint
npm run typecheck
npm run build && CHROMIUM_PATH=/path/to/chrome npm run e2e
```

`npm run e2e` loads the built extension in Chromium and checks two things:

- **`tests/e2e.mjs`** captures a sign-in plus project-creation flow on a local test site. It checks the step text, merging, password redaction and screenshots, then exercises the annotator, the SOP and training templates, and HTML export.
- **`tests/e2e-ai.mjs`** runs the Claude features against a stand-in API. It checks the exact request (model, fallback, screenshots, structured output) and that step rewriting, undo and streamed documents work. It needs no API key.

## Limitations

- Only the top-level page is captured. Clicks inside iframes, such as embedded payment forms, aren't recorded.
- Chrome allows about two screenshots per second. If you click faster than that, a screenshot can show the page slightly after the click.
- Browser pages (`chrome://`, the Web Store, the PDF viewer) can't be captured.
- Apps drawn entirely on a canvas, like Figma or Google Sheets cells, produce generic step text ("Click here"). Edit it, or use *Improve steps with Claude*.
- There's no cloud sync or share link. Share by exporting PDF, HTML or Markdown, or send the `.scribe.json` file.
- The desktop-app capture and team workspace features of the commercial Scribe product aren't included.
