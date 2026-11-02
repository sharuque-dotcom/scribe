import { LICENSE_CONFIG } from '../shared/license'
import type { ToastData } from './ui'

// Opens Polar's checkout (Lifetime, Monthly or Yearly) in a new tab.
export const openCheckout = () => window.open(LICENSE_CONFIG.checkoutUrl, '_blank', 'noopener')

// Shown when a free user picks a Pro feature.
export const lockedToast = (what: string): ToastData => ({
  text: `Pro feature: ${what}.`,
  action: { label: 'Upgrade to Pro', run: openCheckout },
})
