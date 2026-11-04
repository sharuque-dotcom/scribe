# StepCrumb

Click through any website and get a step-by-step guide with annotated screenshots, then turn it into an SOP or a training module.

It's a Chrome/Edge extension with a built-in editor. Everything is stored in your browser, and nothing you capture leaves your machine. StepCrumb goes online only to check a license key and, once, to download the free voice model.

## What it does

**Capture.** Press *Start capturing* and do the task as usual. Every click, typed value, dropdown choice and Enter press becomes a step with:

- a screenshot of the page at that moment
- an orange highlight around what you clicked
- a written instruction, e.g. `Click the "Save" button` or `Type "Acme" into the "Company" field`
- passwords and other secret fields (card numbers, API keys, tokens) blurred automatically, in the saved screenshot itself, so the readable value is never stored. Their values never appear in step text.
- **auto-blur** for personal details shown anywhere on the page: email addresses, phone numbers (UAE and international), card numbers (Luhn-checked), Emirates ID numbers and IBANs (checksum-checked), read from the page's text and field values. Each one gets a blur box on the screenshot that can be removed in the editor (the original screenshot keeps the readable value), only the detail itself is covered, and typed details stay out of step text ("Type an email address into…"), captions and voice. In videos they're blurred when shown and exported, with a *Blur personal details* switch in the Video tab. Settings > Auto-blur turns each kind on or off; Pro adds your own words and `/patterns/` (names, record numbers like `/MRN-\d{6}/`). Text inside images, charts or other sites' embedded frames, and other apps in screen recordings, can't be read, so blur those by hand.

**Zoom.** Screenshots zoom in on what you clicked so field names and values are readable. The first step on each page stays full screen, so readers can see where they are. Later steps on that page zoom in on the clicked element and its label, at up to 3×, with a small full-page thumbnail in the corner marking the zoomed area. Large click areas, navigation and key presses stay full screen. Every step has an **Auto / Full screen / Zoom** switch, with a slider and *Move zoom area*. The **Screenshots** menu sets the rule for the whole guide (auto, always zoom, always full screen) and turns the thumbnail on or off. The original full screenshot is always kept (with secret fields already blurred).

Clicking a field and then typing becomes one step, not two. A small bar on the page lets you pause or finish, and it never shows up in the screenshots.

**Video.** Choose *Screenshots + video* or *Video only* in the popup and the click-through is also recorded as video, with no camera and no microphone. The **Video** tab then gives you:

- auto-zoom in on each click, panning across a page and zooming back out when the page changes
- a smooth, larger cursor and a click ripple (tab recordings have no cursor, so it's drawn from the recorded mouse path)
- captions at the bottom from the step text ("Click the Save button"), with an optional narration line per step
- a free voiceover read from the same text, generated on your computer with the Kokoro model. The first use downloads about 90 MB. If a line runs longer than the action, the video holds that frame until it finishes.
- secret fields blurred in every frame. The saved recording is re-encoded with them blurred when you finish, so the readable values are never stored (saving takes a little longer when a secret field was on screen)
- a timeline where you drag, resize, add and delete zooms and trim the start and end
- export at 1080p/30 fps with captions and voice built in, plus `.srt`/`.vtt` subtitle files. Chrome on Windows and Mac saves MP4 (H.264 + AAC); browsers without an H.264 encoder save WebM.

**Screenshots, video or both.** The popup asks what to make before you start:

- **Screenshots**: the step-by-step guide.
- **Screenshots + video**: the guide, plus a video of the same run.
- **Video only**: a video with auto-zoom and captions. Each click is still recorded as a step (it becomes a caption and a zoom), but no screenshots are taken, and the editor opens on the Video tab.

For video, Chrome's own share dialog then opens over your page and asks what to record: a tab, a window (for example the whole browser, or a desktop app) or the entire screen. The recording runs in StepCrumb's hidden offscreen page, so no StepCrumb window, tab or panel stays open: the page keeps its full width and nothing of StepCrumb's ends up in the video.

- Switching tabs or windows doesn't stop it.
- Pressing Chrome's "Stop sharing" (or closing the shared window) keeps the video so far. With *Screenshots + video*, screenshots carry on and the popup says why the video stopped (the icon shows `!`); with *Video only*, the capture finishes.
- Each piece of video is saved as it's recorded, so if the recording page goes away the video is put back together from those pieces.
- On a Mac, Chrome needs **Screen Recording** permission (System Settings → Privacy & Security) to record a window or the screen. macOS asks once. If the capture comes out blank, or Chrome reports "Timeout starting video source", the popup explains how to fix it (turn Chrome on there, then quit and reopen Chrome).

Recordings made through the share dialog already show the real pointer, so StepCrumb doesn't draw a second one (switch *Smooth cursor* on in the Video tab to add it). The `Alt+Shift+R` shortcut records the current tab directly, without the dialog.

While recording video there's no control bar on the page (it would end up in the video). Finish from the popup or with `Alt+Shift+R`.

**Guide me.** Plays a guide on the real website, step by step (like WalkMe, from one recording). Press **Guide me** at the top of a guide, or on its card in the library. StepCrumb uses a tab already on the guide's website (or opens the first page), dims the page and puts a spotlight on the element for each step, with the step text in a small card (Back, Skip, Exit). It moves on by itself when the learner does the step: a click, typing into a field (when they leave it or press Enter), choosing in a dropdown, pressing Enter. Notes show with a Next button. It carries on across page changes and reloads, and follows a step that opens a new tab.

- Finding the element: while capturing, each step saves clues: its label and text, role, stable ids and names (generated ids are ignored), test ids, placeholder, link path, the section it's in (dialog, form, nearest heading) and where it was on the page. On the live page, every element of the same kind is scored against those clues (searching inside shadow DOM too, as Salesforce uses); below a minimum score it doesn't guess.
- If it can't find the element, the card shows that step's screenshot, zoomed in with the element outlined (blurs applied), plus *I've done this* and *Skip*. If the step belongs to another page, it offers *Go to the page*.
- If the guide was recorded on another site than the one open (say the test system vs live), it says so and offers *Go to …* or *Stay here* (then pages match by path).
- Sharing: *Export > StepCrumb file* gives a file the learner opens with *Import* in their library. Learners need StepCrumb installed (free). Guides captured before Guide me existed have no clues; re-capture them for the spotlight to work (the screenshot fallback still does).
- Free on every plan. Web pages in Chrome and Edge only; content embedded from another site isn't covered yet.

**Edit.** In the editor you can:

- rewrite any step, add detail, reorder, delete (with undo), and insert manual steps, tips or warnings, and section headings
- annotate screenshots with boxes, arrows, text labels, numbered markers, blur (pixelated redaction), spotlight (dims everything else) and a hand-drawn zoom area
- upload a screenshot for a step you added by hand

**Write SOPs and training.** Each guide has two document tabs, built offline from your steps:

- **SOP**: purpose, scope, prerequisites, numbered procedure with screenshots, expected result, revision history.
- **Training**: objectives, walkthrough, practice checklist, simple quiz, quick reference.

**Claude writing (off in this release).** The code for writing SOPs and training with Claude, and for *Improve steps with Claude*, is still here but hidden. Build with `VITE_AI=1` to turn it on (see the section near the end).

**Export.** You can export guides and documents as PDF (through the print dialog), a standalone HTML page, or Markdown with embedded images. Guides can also be saved as a `.stepcrumb.json` backup and imported again.

## Free and Pro

| | Free | Pro |
|---|---|---|
| Guides, screenshots, auto-zoom, annotations, SOP/training templates | Unlimited | Unlimited |
| PDF export | "Made with StepCrumb" footer | No branding |
| Word / HTML / Markdown export | Locked | ✓ |
| Video export | 720p, small watermark, up to 5 minutes | 1080p, no watermark, any length |
| Voiceover | 1 voice (Heart) | All 6 voices |
| Video backgrounds | Gradient | All |

All of this is decided in one file, `src/shared/plans.ts`: each Pro feature is listed with its tier, and the code asks `can('exportWord')` and so on. To move a feature between Free and Pro, change its tier there.

**Buying.** Pro is sold through [Polar](https://polar.sh): Lifetime ($49, first 1,000 buyers), Monthly ($8) and Yearly ($69), all on one checkout link. Every purchase includes a license key starting with `STEPCRUMB`. *Upgrade to Pro* buttons (popup, license screen, and wherever a Pro feature is locked) open the checkout in a new tab. *Enter license key* opens the license screen (`editor.html#/license`, also in Settings).

**Checking keys.** On entry, StepCrumb registers the computer with Polar's public license API (`/v1/customer-portal/license-keys/activate`), then confirms the key (`/validate`). It re-checks on browser start and once a day. A cancelled or lapsed subscription (Polar no longer accepts the key) drops back to Free and says so; guides and videos are never touched. Without internet, Pro keeps working for 7 days after the last successful check. The license screen shows the plan, who it's licensed to, and a **Manage subscription** link to the Polar customer portal.

**Setup before release** (`LICENSE_CONFIG` at the top of `src/shared/license.ts`):

- `organizationId` (filled in) and `orgSlug` (`stepcrumb`, used for the portal link): from Polar → Settings.
- In Polar, one **License key** benefit (prefix `STEPCRUMB`, **activation limit 2**, never expires) is attached to Lifetime, Monthly and Yearly. Customers remove old computers themselves in the Polar portal; a removed computer drops to Free at its next check.

**Network.** The license check is the only request StepCrumb makes, apart from the one-time voice model download from Hugging Face (public model files only). The license check sends only the key, the organization ID and the computer's activation. Nothing captured ever leaves the device.

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

You can try the editor without capturing anything: open the library and click **Open a sample guide**.

## How it's built

```
src/
  extension/
    content.ts      watches clicks, typing, dropdowns, Enter and mouse movement on each page; shows the capture bar
    background.ts   takes screenshots, writes steps, starts/stops video, tracks recording state
    locator.ts      Guide me: saves an element's clues when capturing; finds it again on the live page
    player.ts       Guide me: the spotlight and step card on the page
    offscreen.ts    hidden recording page: shows Chrome's share dialog and records the pick, or records the current tab (service workers can't use MediaRecorder)
    recorder-core.ts  shared MediaRecorder start/pause/stop and saving
  shared/
    describe.ts     turns an interaction into instruction text; detects secret fields; merges click+type
    locate.ts       Guide me: scores how well an element on the live page matches a step's saved clues
    pii.ts          auto-blur: finds emails, phones, cards, Emirates IDs, IBANs and your own words in text
    coords.ts       maps page positions to window/screen video positions
    zoom.ts         decides which part of each screenshot to show (auto zoom rules)
    render.ts       draws a screenshot with zoom, blur, highlight, annotations and the page thumbnail
    templates.ts    offline SOP and training documents
    ai.ts           Claude calls: step rewriting (structured JSON) and document writing (streamed)
    export.ts       HTML / Markdown / PDF / JSON
    docx.ts         Word export for guides and SOP/training documents
    license.ts      Polar license keys: activate, daily re-check, 7-day offline grace
    plans.ts        Free vs Pro: every Pro feature and the free limits, in one table
    db.ts           IndexedDB storage (guides, screenshots, videos and voice clips kept separately)
    video/
      timeline.ts   zoom segments, camera path, smooth cursor, caption timing, voice freezes, subtitles
      compose.ts    draws one video frame (background, zoom, blur, cursor, ripple, caption)
      voice.ts      free voiceover (Kokoro, runs in a worker; clips cached per sentence)
      export.ts     renders the finished MP4/WebM with mediabunny
  editor/           React editor: library, steps, annotator, preview, SOP, training and video tabs
  popup/            toolbar popup: start (with or without video), pause, finish, discard, notices, recent guides
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
- Both browser tests run each flow twice, on the free plan and after activating a key against a fake Polar API (`tests/license-helper.mjs`), and check what's locked, the PDF footer, Word export, and 720p vs 1080p video. `e2e.mjs` also cancels the subscription (the fake starts refusing the key), re-checks, and confirms the app drops to Free with guides intact; checks the popup's Upgrade and license links; and logs every host the extension contacts to confirm only the license check goes online.
- **`tests/e2e-voice-long.mjs`** (`npm run e2e:voice`, downloads the real voice model) records a 19-step guide with typing that ends in Enter at the same instant, a very long typed note and fast clicks at the end, generates the voiceover, deletes two lines' voice, then exports. It checks that export makes the missing lines first and that narration plays at every caption.
- **`tests/e2e-timing.mjs`** first clicks and types at normal human speed and checks every step shows the page just before its action (no trailing, no repeated images), then types a card number and clicks a button that opens another page at full speed. It checks the screenshots show the right page, the card number is pixelated, and the control bar never appears.
- **`tests/e2e-video.mjs`** records the same flow with video on and checks the recording, step times, mouse path, auto-zoom, the preview (play, add/delete zoom), the free voice, subtitle files and the exported video's size, length and audio track. Pass `--no-voice` to skip the voice model download.
- **`tests/e2e-guideme.mjs`** records a guide on the test site, then plays it back: the spotlight must land on the right element at every step, the guide must move on with clicks and typing, carry on across a page change and a reload, offer *Go to the page* for a step on another page, offer *Stay here* on a different site, show the screenshot when a button was renamed, and clean up on exit.
- **`tests/e2e-pii.mjs`** captures a patient page (screenshots + video) and checks that every email, phone number, Emirates ID and card number gets a blur box (only the detail, not the line), that a typed email stays out of the step text, that own words don't apply on the free plan, and that the video records where the details were.
- **`tests/e2e-screen.mjs`** starts a recording through Chrome's share dialog (answered by Chromium's test switch), picks the entire screen (or a tab), and checks that no StepCrumb window, tab or panel opens, that switching tabs keeps recording, that it's detected as a screen recording, and that clicks land at the right spot in the video. `stopshare` checks that "Stop sharing" keeps the video and carries on with screenshots. Add `video` as the last argument to test video-only mode. (The test switch can't auto-pick a window here, so Window recording is checked by hand.) It needs a real display and mouse, so run it under Xvfb with `xdotool` installed: `xvfb-run -a -s "-screen 0 1600x1000x24" node tests/e2e-screen.mjs out [screen|tab|stopshare] [video]`.
- **`tests/e2e-ai.mjs`** (`npm run e2e:ai`, which builds with Claude switched on) runs the Claude features against a stand-in API. It checks the exact request (model, fallback, screenshots, structured output) and that step rewriting, undo and streamed documents work. It needs no API key.

## Claude writing (off in this release)

Hidden behind one switch, `AI_ENABLED` in `src/shared/features.ts`, which is on only when the editor is built with `VITE_AI=1`. With it off, the Claude buttons and Settings fields are gone and the Anthropic code isn't in the built extension.

With it on: open **Settings** (the gear icon) and paste an Anthropic API key from [console.anthropic.com](https://console.anthropic.com). You can also set the audience ("new support agents") and tone. The key is stored only in this browser. Requests go directly from the browser to `api.anthropic.com` using `claude-opus-5-5`, with Anthropic's automatic fallback turned on. Screenshots are sent after blurring, and sending them can be turned off. *Write with Claude* adds roles, phases and troubleshooting to SOPs, and "why this matters" notes, common mistakes, a practice scenario and a 5-question quiz to training. *Improve steps with Claude* rewrites the title, description and every step in one go (it can be undone). Turning it on means the website's privacy wording must mention it again.

## Limitations

- Only the top-level page is captured. Clicks inside iframes, such as embedded payment forms, aren't recorded.
- Chrome allows about two screenshots per second. To work within that, each page keeps a change counter, and every step and screenshot is labelled with it. StepCrumb takes a spare screenshot whenever the page goes quiet, and gives each step the screenshot that shows the page exactly as it was when you acted. If you click faster than Chrome can capture, the step uses the newest screenshot from before the click, never one showing the click's result.
- Browser pages (`chrome://`, the Web Store, the PDF viewer) can't be captured.
- Apps drawn entirely on a canvas, like Figma or Google Sheets cells, produce generic step text ("Click here"). Edit it by hand.
- A tab recording shows one browser tab; steps in other tabs appear in the guide but not the video. Pick a window or the entire screen to include them.
- Steps (and the zooms that follow them) only come from clicks inside the browser. Clicks in desktop apps show in a window/screen video but don't become steps.
- Click positions in window/screen videos assume the browser window isn't moved during recording. With several monitors, record the one the browser is on.
- The free voice is generated on the user's computer: a few seconds per sentence, and about 90 MB downloaded the first time.
- Narrated videos can run longer than the recording, because the video holds a frame until each line finishes. Click more slowly while recording, or shorten the narration lines.
- There's no cloud sync or share link. Share by exporting PDF, HTML or Markdown, or send the `.stepcrumb.json` file.
