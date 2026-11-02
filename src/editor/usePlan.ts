import { useEffect, useState } from 'react'
import { isPro, loadLicense, needsRecheck, onLicenseChange, planName, revalidateLicense, type License } from '../shared/license'

// Whether this browser has a paid plan. Re-checks the key in the background
// every few days and updates when it's activated in another tab.
export function usePlan() {
  const [license, setLicense] = useState<License | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    const load = async () => {
      let l = await loadLicense()
      if (l && needsRecheck(l)) l = await revalidateLicense(l)
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
  return { license, pro: isPro(license), ready, plan: isPro(license) ? planName(license) : 'Free' }
}
