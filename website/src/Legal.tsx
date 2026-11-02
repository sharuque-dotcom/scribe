import { CONFIG } from './config'
import { Footer } from './sections/Bottom'
import { Logo } from './sections/Top'

// Plain-language starting points. Have them reviewed before launch.
const UPDATED = 'November 2026'

function Privacy() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="lead">StepCrumb is built to work on your computer. We don't collect what you capture.</p>
      <h2>What stays on your computer</h2>
      <p>Screenshots, screen recordings, guides, documents, voiceovers and settings are stored in your browser's storage on your computer. They are not sent to us or anyone else.</p>
      <h2>When StepCrumb goes online</h2>
      <ul>
        <li><b>License check.</b> If you enter a license key, StepCrumb sends the key and an activation ID to our payment provider, Lemon Squeezy, to confirm it, then again every few days.</li>
        <li><b>Voice model.</b> The first time you generate a voiceover, StepCrumb downloads the free voice model from Hugging Face. After that it works offline. No text is sent for this.</li>
        <li><b>Optional AI writing.</b> If you add your own Anthropic API key and click “Write with Claude” or “Improve steps with Claude”, the steps (and screenshots, if you allow it) are sent to Anthropic to write the text. This only happens when you click it.</li>
      </ul>
      <h2>Payments</h2>
      <p>Purchases are handled by Lemon Squeezy, which processes your payment details and email address under its own privacy policy. We receive your email and order details so we can send your license and support you.</p>
      <h2>This website</h2>
      <p>This website does not use advertising trackers. If we add analytics, we will list them here.</p>
      <h2>Your rights and contact</h2>
      <p>To ask about your data or delete your purchase record, email <a href={`mailto:${CONFIG.contactEmail}`}>{CONFIG.contactEmail}</a>.</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Terms</h1>
      <p className="lead">The short version: use StepCrumb for your work, don't resell it, and we'll keep it working.</p>
      <h2>License</h2>
      <p>The free plan may be used by anyone. A paid license is for one person and may be activated on up to 3 browsers. Founding (lifetime) licenses include future updates for as long as StepCrumb is offered.</p>
      <h2>Refunds</h2>
      <p>If StepCrumb isn't right for you, email <a href={`mailto:${CONFIG.contactEmail}`}>{CONFIG.contactEmail}</a> within 14 days of purchase for a full refund. Refunded keys stop working.</p>
      <h2>Your content</h2>
      <p>Everything you create with StepCrumb is yours. Because it is stored on your computer, please keep your own backups (StepCrumb can export guides as files).</p>
      <h2>No warranty</h2>
      <p>StepCrumb is provided as is. We work hard to make it reliable, but we can't guarantee it will work with every website.</p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONFIG.contactEmail}`}>{CONFIG.contactEmail}</a>
      </p>
    </>
  )
}

export function Legal({ page }: { page: 'privacy' | 'terms' }) {
  return (
    <div>
      <header className="mx-auto max-w-[860px] px-5 py-6 sm:px-8">
        <Logo />
      </header>
      <main className="legal mx-auto max-w-[760px] px-5 pb-20 pt-6 sm:px-8">
        {page === 'privacy' ? <Privacy /> : <Terms />}
        <p className="mt-12 text-[13px] text-soft">Last updated {UPDATED}.</p>
      </main>
      <Footer />
    </div>
  )
}
