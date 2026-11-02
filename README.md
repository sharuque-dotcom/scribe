# StepCrumb

Click through any website and get a step-by-step guide with annotated screenshots, then turn it into an SOP or a training module.

It's a Chrome/Edge extension with a built-in editor. Everything is stored in your browser. The only thing that leaves your machine is what you send to Claude, and only when you ask it to write.

## What it does

**Capture.** Press *Start capturing* and do the task as usual. Every click, typed value, dropdown choice and Enter press becomes a step with:

- a screenshot of the page at that moment
- an orange highlight around what you clicked
- a written instruction, e.g. `Click the "Save" button` or `Type "Acme" into the "Company" field`
- passwords and other secret fields (card numbers, API keys, tokens) blurred automatically. Their values never appear in step text.

**Zoom.** Screenshots zoom in on what you clicked so field names and values are readable. The first step on each page stays full screen, so readers can see where they are. Later steps on that page zoom in on the clicked element and its label, at up to 3×, with a small full-page thumbnail in the corner marking the zoomed area. Large click areas, navigation and key presses stay full screen. Every step has an **Auto / Full screen / Zoom** switch, with a slider and *Move zoom area*. The **Screenshots** menu sets the rule for the whole guide (auto, always zoom, always full screen) and turns the thumbnail on or off. The original full screenshot is always kept. Claude is sent the full screenshots, so it can see the whole page.

Clicking a field and then typing becomes one step, not two. A small bar on the page lets you pause or finish, and it never shows up in the screenshots.

**Video.** Choose *Screenshots + video* or *Video only* in the popup and the click-through is also recorded as video, with no camera and no microphone. The **Video** tab then gives you:

- auto-zoom in on each click, panning across a page and zooming back out when the page changes
- a smooth, larger cursor and a click ripple (tab recordings have no cursor, so it's drawn from the recorded mouse path)
- captions at the bottom from the step text ("Click the Save button"), with an optional narration line per step
- a free voiceover read from the same text, generated on your computer with the Kokoro model. The first use downloads about 90 MB. If a line runs longer than the action, the video holds that frame until it finishes.
- secret fields blurred in every frame
- a timeline where you drag, resize, add and delete zooms and trim the start and end
- export at 1080p/30 fps with captions and voice built in, plus `.srt`/`.vtt` subtitle files. Chrome on Windows and Mac saves MP4 (H.264 + AAC); browsers without an H.264 encoder save WebM.

**Screenshots, video or both.** The popup asks what to make before you start:

- **Screenshots**: the step-by-step guide.
- **Screenshots + video**: the guide, plus a video of the same run.
- **Video only**: a video with auto-zoom and captions. Each click is still recorded as a step (it becomes a caption and a zoom), but no screenshots are taken, and the editor opens on the Video tab.

For video, Chrome's own share dialog then asks what to record: a tab, a window (for example the whole browser, or a desktop app) or the entire screen. It opens from a small StepCrumb window, which minimizes itself once recording starts. Tab recordings get a smooth drawn cursor; window and screen recordings already show the real one. Zooms and click ripples follow your clicks in the browser either way. Closing the StepCrumb window or pressing Chrome's "Stop sharing" also finishes. On a Mac, Chrome needs **Screen Recording** permission (System Settings → Privacy & Security) the first time.

While recording video there's no control bar on the page (it would end up in the video). Finish from the popup or with `Alt+Shift+R`.

**Edit.** In the editor you can:

- rewrite any step, add detail, reorder, delete (with undo), and insert manual steps, tips or warnings, and section headings
- annotate screenshots with boxes, arrows, text labels, numbered markers, blur (pixelated redaction), spotlight (dims everything else) and a hand-drawn zoom area
- upload a screenshot for a step you added by hand

**Write SOPs and training.** Each guide has two document tabs:

| | Template (offline) | Write with Claude |
|---|---|---|
| **SOP** | Purpose, scope, prerequisites, numbered procedure with screenshots, expected result, revision history | Adds roles and responsibilities, grouped phases, and troubleshooting, all written from your steps and screenshots |
| **Training** | Objectives, walkthrough, practice checklist, simple quiz, quick reference | Adds "why this matters" notes, common mistakes, a practice scenario, and a 5-question multiple-choice quiz with answer key |

*Improve steps with Claude* rewrites the title, description and every step in one go, using the screenshots to name buttons exactly. It can be undone.

**Export.** You can export guides and documents as PDF (through the print dialog), a standalone HTML page, or Markdown with embedded images. Guides can also be saved as a `.stepcrumb.json` backup and imported again.

## Free and paid

| | Free | Paid (license key) |
|---|---|---|
| Guides, screenshots, auto-zoom, annotations, SOP/training templates | Unlimited | Unlimited |
| PDF export | "Made with StepCrumb" footer | No branding |
| Word / HTML / Markdown export | Locked | ✓ |
| Video export | 720p, small watermark, up to 2 minutes | 1080p, no watermark, any length |
| Voiceover | 1 voice (Heart) | All 6 voices |
| Video backgrounds | Gradient | All |

Licenses are [Lemon Squeezy](https://www.lemonsqueezy.com) license keys, entered in the editor's **Settings** (or via the **Free · Upgrade** badge). The key is checked when it's entered and then every 3 days; a paid plan keeps working offline for 14 days. Refunded or disabled keys go back to free at the next check.

To connect your store, edit `LICENSE_CONFIG` at the top of `src/shared/license.ts`:

- `buyUrl`: your pricing page (every "Get a license" link goes there)
- `storeId` and `productIds`: from the Lemon Squeezy dashboard, so keys from other stores are rejected

In Lemon Squeezy, turn on **license keys** for the product and set the **activation limit to 2** (one person, two computers). Settings shows who the license belongs to. There's no self-service "remove" button, so keys can't be casually passed on: to move a key, the customer emails `supportEmail` and you reset its activations in the Lemon Squeezy dashboard. If a key is clearly being shared, disable it there; the app returns to the free plan at its next check.

This is a local check, so a technical user could get around it. That's normal for software that runs entirely on the user's computer.

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
2. Click the extension icon and choose Screenshots, Screenshots + video or Video only, and press **Start**. The shortcut is `Alt+Shift+R`.
3. Do the task. Pause from the page bar if you need to do something you don't want recorded.
4. Press **Finish**. The editor opens with your guide.

To use Claude, open **Settings** (the gear icon) in the editor and paste an Anthropic API key from [console.anthropic.com](https://console.anthropic.com). You can also set the audience ("new support agents") and tone. The key is stored only in this browser. Requests go directly from your browser to `api.anthropic.com` using `claude-opus-5-5`, with Anthropic's automatic fallback turned on in case a request is declined. Screenshots are sent after blurring is applied, and you can turn sending screenshots off.

You can try the editor without capturing anything: open the library and click **Open a sample guide**.

## How it's built

```
src/
  extension/
    content.ts      watches clicks, typing, dropdowns, Enter and mouse movement on each page; shows the capture bar
    background.ts   takes screenshots, writes steps, starts/stops video, tracks recording state
    offscreen.ts    records the tab to WebM (service workers can't use MediaRecorder)
    recorder.ts     small window that shows Chrome's share dialog and records what was picked
    recorder-core.ts  shared MediaRecorder start/pause/stop and saving
  shared/
    describe.ts     turns an interaction into instruction text; detects secret fields; merges click+type
    coords.ts       maps page positions to window/screen video positions
    zoom.ts         decides which part of each screenshot to show (auto zoom rules)
    render.ts       draws a screenshot with zoom, blur, highlight, annotations and the page thumbnail
    templates.ts    offline SOP and training documents
    ai.ts           Claude calls: step rewriting (structured JSON) and document writing (streamed)
    export.ts       HTML / Markdown / PDF / JSON
    docx.ts         Word export for guides and SOP/training documents
    license.ts      Lemon Squeezy license keys: activate, re-check, offline grace
    db.ts           IndexedDB storage (guides, screenshots, videos and voice clips kept separately)
    video/
      timeline.ts   zoom segments, camera path, smooth cursor, caption timing, voice freezes, subtitles
      compose.ts    draws one video frame (background, zoom, blur, cursor, ripple, caption)
      voice.ts      free voiceover (Kokoro, runs in a worker; clips cached per sentence)
      export.ts     renders the finished MP4/WebM with mediabunny
  editor/           React editor: library, steps, annotator, preview, SOP, training and video tabs
  popup/            toolbar popup: start (with or without video), pause, finish, discard, recent guides
```

Screenshots use `chrome.tabs.captureVisibleTab`. All positions (highlights, annotations, crop) are stored relative to the image (0–1), so they work at any screen size or zoom level.

## Develop and test

```bash
npm run dev         # editor in a normal browser tab (capturing needs the extension)
npm test            # unit tests: step wording, secret detection, merging, zoom rules, templates
npm run lint
npm run typecheck
npm run build && CHROMIUM_PATH=/path/to/chrome npm run e2e
```

`npm run e2e` loads the built extension in Chromium and checks two things:

- **`tests/e2e.mjs`** captures a sign-in plus project-creation flow on a local test site. It checks the step text, merging, password redaction and screenshots, then exercises the annotator, the SOP and training templates, and HTML export.
- Both browser tests run each flow twice, on the free plan and after activating a key against a fake Lemon Squeezy server (`tests/license-helper.mjs`), and check what's locked, the PDF footer, Word export, and 720p vs 1080p video.
- **`tests/e2e-video.mjs`** records the same flow with video on and checks the recording, step times, mouse path, auto-zoom, the preview (play, add/delete zoom), the free voice, subtitle files and the exported video's size, length and audio track. Pass `--no-voice` to skip the voice model download.
- **`tests/e2e-screen.mjs`** starts a recording through Chrome's share dialog, picks the entire screen, and checks that it's detected as a screen recording and that clicks land at the right spot in the video. Add `video` as the last argument to test video-only mode. It needs a real display and mouse, so run it under Xvfb with `xdotool` installed: `xvfb-run -a -s "-screen 0 1600x1000x24" node tests/e2e-screen.mjs out screen [video]`.
- **`tests/e2e-ai.mjs`** runs the Claude features against a stand-in API. It checks the exact request (model, fallback, screenshots, structured output) and that step rewriting, undo and streamed documents work. It needs no API key.

## Limitations

- Only the top-level page is captured. Clicks inside iframes, such as embedded payment forms, aren't recorded.
- Chrome allows about two screenshots per second. If you click faster than that, a screenshot can show the page slightly after the click.
- Browser pages (`chrome://`, the Web Store, the PDF viewer) can't be captured.
- Apps drawn entirely on a canvas, like Figma or Google Sheets cells, produce generic step text ("Click here"). Edit it, or use *Improve steps with Claude*.
- A tab recording shows one browser tab; steps in other tabs appear in the guide but not the video. Pick a window or the entire screen to include them.
- Steps (and the zooms that follow them) only come from clicks inside the browser. Clicks in desktop apps show in a window/screen video but don't become steps.
- Click positions in window/screen videos assume the browser window isn't moved during recording. With several monitors, record the one the browser is on.
- The free voice is generated on the user's computer: a few seconds per sentence, and about 90 MB downloaded the first time.
- Narrated videos can run longer than the recording, because the video holds a frame until each line finishes. Click more slowly while recording, or shorten the narration lines.
- There's no cloud sync or share link. Share by exporting PDF, HTML or Markdown, or send the `.stepcrumb.json` file.
