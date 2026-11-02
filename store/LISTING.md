# Chrome Web Store listing: StepCrumb 1.0.0

Everything below is ready to paste into the [developer dashboard](https://chrome.google.com/webstore/devconsole).
Upload `stepcrumb-1.0.0.zip` (made by `npm run build`, then zipping the contents of `dist/`).

---

## 1. Store listing tab

**Name**
```
StepCrumb
```

**Summary** (shown under the name; 127 of 132 characters; the same text is in the manifest)
```
Click through any task once. Get a step-by-step guide, SOP, training and a narrated video. Private: all saved on your computer.
```

**Category:** Productivity (Workflow & Planning)
**Language:** English

**Description**
```
Show it once. Explain it forever.

Click through any task in your browser and StepCrumb turns it into a step-by-step guide with screenshots, a standard operating procedure (SOP), a training module and a narrated video. No account, no uploads: everything is saved on your computer.

HOW IT WORKS
1. Click the StepCrumb icon and choose Screenshots, Screenshots + video, or Video only.
2. Do the task as you normally would.
3. Press Finish. Your guide is ready to edit and share.

STEP-BY-STEP GUIDES
• Every click, typed value, dropdown choice and Enter press becomes a step with a written instruction, like: Click the "Save" button.
• Screenshots zoom in on what you clicked, with a highlight and a small full-page thumbnail, so field names and values are readable.
• Passwords, card numbers and other secret fields are blurred automatically, before anything is saved. Their values never appear in the text.
• Edit, reorder, add tips and warnings, and annotate with boxes, arrows, labels, numbers, blur and spotlight.

SOPs AND TRAINING
• Turn any guide into an SOP (purpose, scope, prerequisites, procedure, expected result, revision history).
• Or a training module (objectives, walkthrough, practice checklist, quiz, quick reference).

NARRATED VIDEO
• Record a tab, a window or your whole screen alongside the steps.
• Auto-zoom follows your clicks, with a smooth cursor and click ripples.
• Captions from your steps, burned in, plus .srt and .vtt subtitle files.
• A free, natural voiceover generated on your computer. No per-minute fees.

EXPORT
• PDF on the free plan. With Pro: Word (.docx), HTML and Markdown, PDFs without branding, 1080p video without a watermark, any length, all voices and backgrounds.

PRIVATE BY DESIGN
• No account or sign-up.
• Guides, screenshots, recordings and voiceovers are stored in your browser, on your computer. They are never sent to us or anyone else.
• StepCrumb only goes online to check a Pro license key (with our payment provider, Polar) and once to download the free voice model.

FREE AND PRO
StepCrumb is free to use, with unlimited guides. Pro is a one-time Lifetime license (limited to the first 1,000 buyers) or a monthly or yearly subscription. Each license works on 2 computers. See stepcrumb.com.

Works in Chrome and Microsoft Edge on Windows, Mac, Linux and ChromeOS. Shortcut: Alt+Shift+R.

Questions? hello@stepcrumb.com
```

**Graphics** (all in `store/assets/`)
| Field | File |
|---|---|
| Store icon (128×128) | `public/icons/icon128.png` (already in the zip) |
| Screenshot 1 | `screenshot-1-guide.png` |
| Screenshot 2 | `screenshot-2-blur.png` |
| Screenshot 3 | `screenshot-3-sop.png` |
| Screenshot 4 | `screenshot-4-video.png` |
| Screenshot 5 | `screenshot-5-private.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560), optional | `marquee-1400x560.png` |

**Links**
- Official website: `https://stepcrumb.com` (verify the domain in Google Search Console to show it as verified)
- Support: `mailto:hello@stepcrumb.com` or `https://stepcrumb.com`

---

## 2. Privacy practices tab

**Single purpose**
```
StepCrumb records the steps a user takes in their browser (screenshots, and optionally a video) and turns them into step-by-step guides, SOPs, training material and narrated videos that the user edits and exports. Everything is stored locally on the user's computer.
```

**Permission justifications** (one box per permission)

`tabs`
```
To know which tab the user is documenting (its title and address appear in the guide), to take a screenshot of the visible tab for each step, and to open the editor in a new tab when a capture finishes.
```

`storage`
```
To save the recording state, the user's settings (capture mode, recording source) and their license status locally.
```

`unlimitedStorage`
```
Guides contain many screenshots and video recordings, which are stored locally in the browser (IndexedDB). Without this, longer guides and videos would hit the storage quota and be lost.
```

`scripting`
```
To add StepCrumb's step recorder to tabs that were already open before capturing started, so clicks and typing on those pages are recorded as steps.
```

`tabCapture`
```
To record the current tab as a video when the user chooses "Screenshots + video" or "Video only". Recording only happens after the user starts it and stops when they press Finish.
```

`desktopCapture`
```
To let the user record a window or their entire screen instead of a single tab. Chrome's own share dialog asks the user what to share every time.
```

`offscreen`
```
Service workers cannot record video, so the tab recording runs in an offscreen document while the user captures.
```

`alarms`
```
To re-check the user's Pro license key once a day, so a cancelled subscription returns to the free plan.
```

Host permission `<all_urls>`
```
StepCrumb documents tasks on whatever website the user is working in, so its step recorder must run on any site the user chooses to capture: it notes which element was clicked and what was typed (secret fields excluded) to write the step text. Nothing is read or sent anywhere while the user is not capturing.
```

Host permission `https://api.polar.sh/*`
```
To check a Pro license key with our payment provider, Polar. Only the key, our store ID and an activation ID are sent.
```

**Remote code**
```
No, I am not using remote code.
```
(The voice model downloaded on first use is data, model weights, not code. Its runtime is bundled in the extension.)

**Data usage:** tick **none** of the data types. StepCrumb does not collect or transmit user data: guides, screenshots and recordings stay in the browser, and the license check sends only the license key.
Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
```
https://stepcrumb.com/privacy.html
```

---

## 3. Distribution tab
- **Visibility:** Public
- **Regions:** All regions
- **Pricing:** Free (Pro is sold on stepcrumb.com through Polar; the extension itself is free)

## 4. Test instructions (optional, for the reviewer)
```
No account is needed. Open any website, click the StepCrumb icon, choose "Screenshots", press Start capturing, click around, then press Finish: the editor opens with the guide. All features except Pro exports work without a key.
```
To let the reviewer try Pro, add a Lifetime key here (make one with a single-use 100% discount code in Polar) and remove it from Polar after approval.

---

## Before you submit
- [ ] Video and voiceover checked by hand (the last QA item)
- [ ] Your own key activated once; 2-computer limit checked
- [ ] Polar checkout link Success URL set to `https://stepcrumb.com/thanks.html`
- [ ] After approval: send the store link so the website's "Add to Chrome" buttons point to it

## Rebuilding the images
```
npm run build
CHROMIUM_PATH=/path/to/chrome node store/capture.mjs /tmp/stepcrumb-raw   # real extension, demo app in store/demo/
CHROMIUM_PATH=/path/to/chrome node store/compose.mjs /tmp/stepcrumb-raw store/assets
```
