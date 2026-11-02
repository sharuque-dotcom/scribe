import { useEffect, useState } from 'react'
import { isPro, loadLicense, onLicenseChange, planName, recheckLicense, type License } from '../shared/license'
import { can as canFor, type Feature } from '../shared/plans'

// The current plan. Re-checks the key if a day has passed (the background also
// does this on browser start and daily) and updates when it changes elsewhere.
export function usePlan() {
  const [license, setLicense] = useState<License | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    const load = async () => {
      const l = await recheckLicense()
      if (live) {
        setLicense(l)
        setReady(true)
      }
    }
    void load()
    const off = onLicenseChange(() => void loadLicense().then((l) => live && setLicense(l)))
    return () => {
      live = false
      off()
    }
  }, [])
  const pro = isPro(license)
  return {
    license,
    pro,
    ready,
    plan: planName(license),
    // Free vs Pro decisions all go through here (see src/shared/plans.ts).
    can: (feature: Feature) => canFor(feature, pro),
    // Had Pro before, and Polar no longer accepts the key (cancelled or lapsed).
    lapsed: !!license && !pro,
  }
}
