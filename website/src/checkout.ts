import { CONFIG } from './config'

// Opens Polar's checkout as an overlay on this page, so buyers never leave the
// site. After paying, Polar sends them to the success URL (/thanks.html).
// If the overlay can't load (script blocked, or this domain isn't allowed under
// Polar → Settings → Embedding), the normal checkout page opens in this tab.
let opening = false

export async function openCheckout(e?: { preventDefault(): void }) {
  e?.preventDefault()
  if (opening) return
  opening = true
  const fallback = () => window.location.assign(CONFIG.checkoutUrl)
  const timer = window.setTimeout(fallback, 10_000)
  try {
    const { PolarEmbedCheckout } = await import('@polar-sh/checkout/embed')
    const checkout = await PolarEmbedCheckout.create(CONFIG.checkoutUrl, { theme: 'light' })
    window.clearTimeout(timer)
    checkout.addEventListener('success', (ev) => {
      if (!ev.detail.redirect) window.location.assign('/thanks.html')
    })
    checkout.addEventListener('close', () => (opening = false))
  } catch {
    window.clearTimeout(timer)
    fallback()
  } finally {
    // Allow another click once the overlay is up (or the page is leaving).
    window.setTimeout(() => (opening = false), 1500)
  }
}
