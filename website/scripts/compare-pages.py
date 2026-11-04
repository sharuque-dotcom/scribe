# Generates the StepCrumb vs X comparison pages (static HTML, readable without
# JavaScript) from the facts below. Run: python3 scripts/compare-pages.py
# Competitor facts come from their public pricing pages on CHECKED; update both together.
import html, json, pathlib

CHECKED = '4 November 2026'
ROOT = pathlib.Path(__file__).resolve().parent.parent
ONLINE = 'No. StepCrumb saves screenshots and videos in your browser on your computer. It goes online only to check a Pro license key and, unless you switch it off, to send anonymous counts such as "1 guide made", never what you capture.'

PAGES = [
  {
    'slug': 'tango', 'name': 'Tango', 'url': 'https://www.tango.ai/pricing',
    'title': 'StepCrumb vs Tango: the private Tango alternative (2026)',
    'h1': ('StepCrumb vs Tango: the ', 'private', ' Tango alternative'),
    'desc': 'StepCrumb vs Tango compared: automatic blurring, PDF export, narrated video and live walkthroughs on the free plan, with no account and nothing uploaded. See where each one fits.',
    'lead': 'Both turn a click-through into a step-by-step guide. StepCrumb includes what Tango keeps for paid plans, such as PDF export, blurring of personal data and walkthroughs on the live website, and your screenshots never leave your computer.',
    'rows': [
      ('Step-by-step guide from a click-through', 'Free, unlimited', 'Free: 5 workflows in the team library'),
      ('Automatic blurring of personal data', '<b>Free</b>: emails, phone numbers, card numbers, Emirates ID, IBAN', 'Enterprise; manual blur on Pro'),
      ('PDF export', '<b>Free</b> (small StepCrumb footer)', 'Pro and Enterprise'),
      ('Word, HTML and Markdown export', 'Pro', 'HTML and Markdown on Pro'),
      ('Narrated video with auto-zoom and captions', '<b>Free</b> up to 5 minutes; voice made on your computer', 'Video embeds on Pro'),
      ('SOP and training page from the same capture', 'Free', 'Not listed on its pricing page'),
      ('Guided walkthrough on the live website', '<b>Free</b> (Guide me)', 'Guidance on Pro; pinned walkthroughs on Enterprise'),
      ('Where your screenshots are stored', '<b>On your computer</b>', "Tango's cloud"),
      ('Account needed', 'No', 'Yes'),
      ('Shared team library', 'Not yet (share files)', 'Yes, free for up to 10 users'),
      ('SSO', 'No', 'Enterprise'),
      ('Price', 'Free; Pro $8/month, $69/year or $49 once (lifetime)', 'Free; Pro $22/user/month yearly for 1–2 users, $15/user/month yearly for 3+'),
    ],
    'better': 'Choose Tango if your team wants a shared online workspace where everyone can find and edit workflows, live guidance pushed to a whole team, or single sign-on. Choose StepCrumb if you want privacy, no accounts and more on the free plan.',
    'faq': [
      ('Is StepCrumb a good Tango alternative?', 'Yes, if you make step-by-step guides on your own or in a small team and care about privacy. StepCrumb gives you unlimited guides, PDF export, automatic blurring, narrated video and walkthroughs on the live website on its free plan, needs no account and keeps everything on your computer. If you need a shared team workspace or SSO, Tango fits better.'),
      ('Does StepCrumb upload my screenshots?', ONLINE),
      ('Does Tango blur personal data automatically?', "According to Tango's pricing page, automatic blurring of personal data is part of its Enterprise plan, and manual blurring is on Pro. StepCrumb blurs emails, phone numbers, card numbers, Emirates ID numbers and IBANs automatically on every plan."),
      ('How much does StepCrumb cost compared with Tango?', 'StepCrumb is free, with Pro at $8 a month, $69 a year or $49 once for lifetime access. Tango Pro is $22 per user per month billed yearly for one or two users, or $15 per user per month billed yearly for three or more.'),
      ('How many guides can I make for free?', "As many as you like with StepCrumb. Tango's free plan holds 5 workflows in the team library."),
    ],
  },
  {
    'slug': 'guidde', 'name': 'Guidde', 'url': 'https://www.guidde.com/pricing',
    'title': 'StepCrumb vs Guidde: the private Guidde alternative (2026)',
    'h1': ('StepCrumb vs Guidde: the ', 'private', ' Guidde alternative'),
    'desc': 'StepCrumb vs Guidde compared: narrated how-to videos and written guides from one click-through, with automatic blurring and PDF export free, no account and nothing uploaded.',
    'lead': 'Both turn a click-through into a narrated how-to video. StepCrumb also gives you a written guide, an SOP and a training page from the same capture, includes PDF export and automatic blurring for free, and keeps your recordings on your computer.',
    'rows': [
      ('Narrated how-to video from a click-through', '<b>Free</b> up to 5 minutes; voice made on your computer', 'Free: your own voice; AI voice on Business'),
      ('How many on the free plan', 'Unlimited', 'Up to 25 guides'),
      ('Written step-by-step guide, SOP and training page', 'Free, from the same capture', 'Guides; documents export on Pro'),
      ('Automatic blurring of personal data', '<b>Free</b>: emails, phone numbers, card numbers, Emirates ID, IBAN', 'Blur on Pro; automatic PII redaction on Enterprise'),
      ('PDF export', '<b>Free</b> (small StepCrumb footer)', 'Pro (videos, PPTs and PDFs)'),
      ('Word export', 'Pro', 'Not listed'),
      ('Guided walkthrough on the live website', '<b>Free</b> (Guide me)', 'Not listed on its pricing page'),
      ('Where your recordings are stored', '<b>On your computer</b>', 'Online, in your Guidde account'),
      ('Account needed', 'No', 'Yes'),
      ('Sharing links and team library', 'Not yet (share files)', 'Yes'),
      ('SSO', 'No', 'Enterprise'),
      ('Price', 'Free; Pro $8/month, $69/year or $49 once (lifetime)', 'Free; Pro $19/creator/month, Business $39/creator/month (yearly)'),
    ],
    'better': 'Choose Guidde if you want a library of polished how-to videos that your team shares by link, with premium AI voices. Choose StepCrumb if you want privacy, no accounts, and a written guide, SOP and training page alongside every video, free.',
    'faq': [
      ('Is StepCrumb a good Guidde alternative?', 'Yes, if you want how-to videos and written guides without uploading anything. StepCrumb makes a narrated video with auto-zoom plus a guide, an SOP and a training page from one click-through, with automatic blurring and PDF export on the free plan. If you need a shared video library with sharing links, Guidde fits better.'),
      ('Does StepCrumb upload my recordings?', ONLINE),
      ('Does StepCrumb have AI voiceover?', 'Yes. StepCrumb reads your steps out loud with a natural voice that runs on your computer, on every plan. Nothing is sent to a voice service.'),
      ('How much does StepCrumb cost compared with Guidde?', "StepCrumb is free, with Pro at $8 a month, $69 a year or $49 once for lifetime access. Guidde's pricing page lists Pro at $19 and Business at $39 per creator per month, billed yearly."),
      ('Can StepCrumb export a PDF for free?', 'Yes. Every guide, SOP and training page exports to PDF on the free plan, with a small StepCrumb footer. Pro removes the footer and adds Word, HTML and Markdown.'),
    ],
  },
  {
    'slug': 'loom', 'name': 'Loom', 'url': 'https://www.loom.com/pricing',
    'title': 'StepCrumb vs Loom: a step-by-step guide, not just a video (2026)',
    'h1': ('StepCrumb vs Loom: a ', 'step-by-step guide', ', not just a video'),
    'desc': 'StepCrumb vs Loom for how-to content: one click-through gives you a written guide, an SOP, a training page and a narrated video with auto-zoom, free and private.',
    'lead': "Loom is great for quick video messages. When you're explaining how to do something, people also want steps they can follow and search. StepCrumb turns one click-through into a written guide, an SOP, a training page and a narrated video that zooms where you clicked.",
    'rows': [
      ('Written step-by-step guide with screenshots', '<b>Free</b>', 'Not offered (AI summaries and chapters on Business + AI)'),
      ('SOP and training page', 'Free, from the same capture', 'Not offered'),
      ('Video', '<b>Free</b> narrated video up to 5 minutes, zooms where you click', 'Free: 25 videos, 5-minute recordings'),
      ('Voice', 'Generated from your steps, or none', 'Your own voice, recorded live'),
      ('Camera bubble with your face', 'No', 'Yes'),
      ('Automatic blurring of personal data', '<b>Free</b>: emails, phone numbers, card numbers, Emirates ID, IBAN', 'Blur on Business'),
      ('Download your video', '<b>Free</b>', 'Business'),
      ('Guided walkthrough on the live website', '<b>Free</b> (Guide me)', 'Not offered'),
      ('Where your recordings are stored', '<b>On your computer</b>', "Loom's cloud, shared by link"),
      ('Account needed', 'No', 'Yes'),
      ('Comments, reactions, viewer insights', 'No', 'Yes'),
      ('Price', 'Free; Pro $8/month, $69/year or $49 once (lifetime)', 'Free Starter; Business $18/user/month, Business + AI $24/user/month'),
    ],
    'better': 'Choose Loom for quick async video messages with your face, comments and a link people can open right away. Choose StepCrumb when you are documenting a process: you get steps people can follow and search, an SOP and a training page, plus a video, without uploading anything.',
    'faq': [
      ('Is StepCrumb a Loom alternative?', 'For how-to content, yes. Loom records a video of your screen; StepCrumb records your clicks and turns them into a written guide, an SOP, a training page and a narrated video with auto-zoom. For video messages with your face and comments, Loom is the better fit.'),
      ('Does StepCrumb upload my recordings?', ONLINE),
      ('Can I make a video with StepCrumb?', 'Yes. Every capture can become a narrated video that zooms where you clicked, with captions and a voice made on your computer. Videos up to 5 minutes are free; Pro removes the limit and adds 1080p.'),
      ('How much does StepCrumb cost compared with Loom?', "StepCrumb is free, with Pro at $8 a month, $69 a year or $49 once for lifetime access. Loom's pricing page lists Business at $18 and Business + AI at $24 per user per month."),
      ('Why a written guide instead of a video?', "People can skim steps, search them, copy them into a wiki and follow them at their own pace. With StepCrumb you don't have to choose: the same capture gives you both."),
    ],
  },
]

ALL = [('scribe', 'Scribe')] + [(p['slug'], p['name']) for p in PAGES]

def more(current):
  links = ''.join(f'<a href="/compare/stepcrumb-vs-{s}" class="rounded-full border border-line bg-white px-5 py-2.5 text-[15px] font-semibold hover:border-ink">StepCrumb vs {n}</a>' for s, n in ALL if s != current)
  return f'''      <section class="mb-20 text-center">
        <h2 class="display mb-6 text-[28px] sm:text-[36px]">More comparisons</h2>
        <div class="flex flex-wrap justify-center gap-3">{links}</div>
      </section>
'''

def page(p):
  e = html.escape
  canon = f"https://www.stepcrumb.com/compare/stepcrumb-vs-{p['slug']}"
  ld = [
    {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in p['faq']]},
    {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
      {'@type': 'ListItem', 'position': 1, 'name': 'StepCrumb', 'item': 'https://www.stepcrumb.com/'},
      {'@type': 'ListItem', 'position': 2, 'name': f"StepCrumb vs {p['name']}", 'item': canon}]},
  ]
  rows = '\n'.join(f'              <tr><td class="px-5 py-4 font-medium">{e(f)}</td><td class="px-5 py-4">{s}</td><td class="px-5 py-4">{e(c)}</td></tr>' for f, s, c in p['rows'])
  faq = '\n'.join(f'        <details class="border-b border-line py-5"><summary class="cursor-pointer text-[18px] font-semibold">{e(q)}</summary><p class="mt-3 text-[16px] leading-relaxed text-soft">{e(a)}</p></details>' for q, a in p['faq'])
  a, hl, b = p['h1']
  return f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>{e(p['title'])}</title>
    <meta name="description" content="{e(p['desc'])}" />
    <link rel="canonical" href="{canon}" />
    <meta property="og:title" content="{e(p['title'].replace(' (2026)', ''))}" />
    <meta property="og:description" content="{e(p['desc'])}" />
    <meta property="og:url" content="{canon}" />
    <meta property="og:type" content="article" />
    <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
  </head>
  <body class="bg-paper font-sans text-ink antialiased">
    <header class="border-b border-line bg-paper/85 backdrop-blur-md">
      <nav class="mx-auto flex max-w-[1100px] items-center gap-6 px-5 py-4 sm:px-8">
        <a href="/" class="flex items-center gap-2" aria-label="StepCrumb home">
          <svg viewBox="0 0 64 64" class="h-8 w-8" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#151412" /><circle cx="18" cy="44" r="6" fill="#F97316" /><circle cx="32" cy="32" r="7.5" fill="#FAF8F4" /><circle cx="46" cy="18" r="9" fill="#818CF8" /></svg>
          <span class="text-[19px] font-semibold tracking-tight">StepCrumb</span>
        </a>
        <a href="/#install" class="ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:opacity-90">Add to Chrome, it's free</a>
      </nav>
    </header>

    <main class="mx-auto max-w-[1100px] px-5 sm:px-8">
      <section class="py-16 text-center sm:py-24">
        <p class="eyebrow mb-4">Compare · {e(p['name'])} alternative</p>
        <h1 class="display mx-auto max-w-4xl text-[44px] sm:text-[72px]">{e(a)}<span class="bg-gradient-to-r from-brand via-violet-500 to-ember bg-clip-text text-transparent">{e(hl)}</span>{e(b)}</h1>
        <p class="mx-auto mt-6 max-w-2xl text-[18px] leading-relaxed text-soft sm:text-[20px]">{e(p['lead'])}</p>
        <div class="mt-9 flex flex-wrap justify-center gap-3">
          <a href="/#install" class="btn-dark px-7 py-3.5 text-[16px]">Try StepCrumb free</a>
          <a href="#table" class="btn-ghost px-7 py-3.5 text-[16px]">See the comparison</a>
        </div>
        <p class="mt-4 text-[13px] text-soft">Checked against {e(p['name'])}'s public pricing page on {CHECKED}.</p>
      </section>

      <section id="table" class="pb-20">
        <h2 class="display mb-6 text-[32px] sm:text-[44px]">Side by side</h2>
        <div class="overflow-x-auto rounded-3xl border border-line bg-white shadow-card">
          <table class="w-full min-w-[640px] text-left text-[15px]">
            <thead class="bg-paper text-[13px] uppercase tracking-[0.08em] text-soft">
              <tr><th class="px-5 py-4 font-semibold">Feature</th><th class="px-5 py-4 font-semibold">StepCrumb</th><th class="px-5 py-4 font-semibold">{e(p['name'])}</th></tr>
            </thead>
            <tbody class="divide-y divide-line">
{rows}
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-[13px] text-soft">{e(p['name'])} details from <a class="underline underline-offset-2 hover:text-ink" href="{p['url']}" rel="nofollow noopener">{e(p['url'].split('//')[1].replace('www.', ''))}</a>, checked {CHECKED}. Plans change; check there for the latest.</p>
      </section>

      <section class="grid gap-6 pb-20 md:grid-cols-3">
        <div class="rounded-3xl border border-line bg-white p-7 shadow-card">
          <span class="mb-4 block h-4 w-4 rounded-full bg-ember"></span>
          <h3 class="text-[20px] font-semibold">Privacy you don't pay extra for</h3>
          <p class="mt-2 text-[16px] leading-relaxed text-soft">Personal details are blurred while you capture, on every plan. Nothing is uploaded, so there's no copy on anyone's servers.</p>
        </div>
        <div class="rounded-3xl border border-line bg-white p-7 shadow-card">
          <span class="mb-4 block h-4 w-4 rounded-full bg-[#818CF8]"></span>
          <h3 class="text-[20px] font-semibold">One capture, four results</h3>
          <p class="mt-2 text-[16px] leading-relaxed text-soft">The same click-through gives you a guide, an SOP, a training page and a narrated video that zooms where you clicked.</p>
        </div>
        <div class="rounded-3xl border border-line bg-white p-7 shadow-card">
          <span class="mb-4 block h-4 w-4 rounded-full bg-ember"></span>
          <h3 class="text-[20px] font-semibold">Guides that guide</h3>
          <p class="mt-2 text-[16px] leading-relaxed text-soft">Guide me plays a guide on the real website, spotlighting each button, so new people learn by doing.</p>
        </div>
      </section>

      <section class="mb-20 rounded-3xl border border-line bg-white p-8 shadow-card sm:p-10">
        <h2 class="display text-[28px] sm:text-[36px]">When {e(p['name'])} is the better choice</h2>
        <p class="mt-3 max-w-3xl text-[17px] leading-relaxed text-soft">{e(p['better'])}</p>
      </section>

      <section class="mx-auto max-w-[820px] pb-20">
        <h2 class="display mb-6 text-[32px] sm:text-[44px]">Questions</h2>
{faq}
      </section>

{more(p['slug'])}
      <section class="mb-16 rounded-[40px] bg-ink px-6 py-20 text-center text-paper sm:px-12">
        <h2 class="display mx-auto max-w-3xl text-[40px] sm:text-[60px]">Leave a trail anyone can follow.</h2>
        <p class="mx-auto mt-4 max-w-xl text-[18px] text-paper/80">Free, no account, nothing uploaded.</p>
        <a href="/#install" class="btn mt-8 bg-paper px-7 py-3.5 text-[16px] text-ink hover:-translate-y-0.5">Add StepCrumb to Chrome</a>
      </section>
    </main>

    <footer class="mx-auto flex max-w-[1100px] flex-wrap items-center gap-6 px-5 py-10 text-[14px] text-soft sm:px-8">
      <span>© 2026 StepCrumb · Leave a trail anyone can follow.</span>
      <nav class="ml-auto flex flex-wrap gap-6"><a href="/" class="hover:text-ink">Home</a><a href="/privacy.html" class="hover:text-ink">Privacy</a><a href="/terms.html" class="hover:text-ink">Terms</a></nav>
    </footer>
    <p class="px-5 pb-8 text-center text-[12px] text-soft">{e(p['name'])} is a trademark of its owner. StepCrumb is not affiliated with {e(p['name'])}.</p>
    <script type="module" src="/src/compare.ts"></script>
  </body>
</html>
'''

for p in PAGES:
  (ROOT / 'compare' / f"stepcrumb-vs-{p['slug']}.html").write_text(page(p))

# The hand-written Scribe page: add the links to the others and keep its privacy answer current.
scribe = ROOT / 'compare' / 'stepcrumb-vs-scribe.html'
s = scribe.read_text()
old = 'No. StepCrumb saves screenshots and videos in your browser on your computer. It only goes online to check a Pro licence key.'
s = s.replace(old, ONLINE)
marker = '      <section class="mb-16 rounded-[40px] bg-ink'
if 'More comparisons' not in s:
  s = s.replace(marker, more('scribe') + '\n' + marker, 1)
scribe.write_text(s)
print('ok', [p['slug'] for p in PAGES])
