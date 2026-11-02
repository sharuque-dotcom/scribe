import { CONFIG } from './config'
import { ChromeIcon, Logo } from './sections/Top'
import { ActivateDemo } from './sections/ActivateDemo'
import { Footer } from './sections/Bottom'

// Where Polar sends buyers after checkout (Polar → checkout link → Success URL).
export function Thanks() {
  const steps: [string, React.ReactNode][] = [
    [
      'Find your license key',
      <>
        It’s on Polar’s confirmation page and in the email from Polar. It starts with <code className="rounded bg-ink/5 px-1.5 py-0.5 text-[14px]">STEPCRUMB</code>.
      </>,
    ],
    ['Install StepCrumb', <>Add it to Chrome or Edge, then pin it so the icon stays in your toolbar.</>],
    [
      'Paste the key',
      <>
        Click the StepCrumb icon, choose <b>Enter license key</b>, paste it and press <b>Activate</b>. Pro unlocks right away, on up to 2 computers.
      </>,
    ],
  ]
  return (
    <div>
      <header className="mx-auto max-w-[860px] px-5 py-6 sm:px-8">
        <Logo />
      </header>
      <main className="mx-auto max-w-[640px] px-5 pt-10 text-center sm:px-8">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700" aria-hidden>
          ✓
        </div>
        <h1 className="display text-[44px] sm:text-[56px]">You’re Pro. Thank you!</h1>
        <p className="mx-auto mt-4 max-w-md text-[18px] text-soft">Three quick steps and every Pro feature is yours.</p>

      </main>
      <div className="mx-auto mt-10 max-w-[1080px] px-3 sm:px-8">
        <ActivateDemo />
      </div>
      <main className="mx-auto max-w-[960px] px-5 pb-24 pt-12 text-center sm:px-8">
        <ol className="grid gap-4 text-left sm:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[15px] font-semibold text-paper">{i + 1}</span>
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-[15px] text-soft">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={CONFIG.chromeStoreUrl} className="btn-dark px-7 py-3.5 text-[16px]">
            <ChromeIcon /> Add to Chrome
          </a>
          <a href={CONFIG.portalUrl} target="_blank" rel="noopener" className="btn-ghost px-7 py-3.5 text-[16px]">
            Manage purchase
          </a>
        </div>

        <p className="mt-10 text-[14px] text-soft">
          Can’t find the key? Check your spam folder, or sign in to the{' '}
          <a className="underline" href={CONFIG.portalUrl} target="_blank" rel="noopener">
            Polar portal
          </a>{' '}
          with your purchase email to see it. Still stuck? Email{' '}
          <a className="underline" href={`mailto:${CONFIG.contactEmail}`}>
            {CONFIG.contactEmail}
          </a>
          .
        </p>
      </main>
      <Footer />
    </div>
  )
}
