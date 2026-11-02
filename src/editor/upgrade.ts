import { LICENSE_CONFIG } from '../shared/license'
import type { ToastData } from './ui'

// Shown when a free user picks a paid feature.
export const lockedToast = (what: string): ToastData => ({
  text: `${what} is included with a StepCrumb license.`,
  action: { label: 'Get a license', run: () => window.open(LICENSE_CONFIG.buyUrl, '_blank', 'noopener') },
})
