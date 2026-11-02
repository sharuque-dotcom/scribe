import { usePlan } from '../usePlan'

// "Free · Upgrade" or the paid plan's name. Opens Settings, where the key is entered.
export function PlanBadge({ onOpen }: { onOpen: () => void }) {
  const { pro, plan, ready } = usePlan()
  if (!ready) return null
  return pro ? (
    <button onClick={onOpen} className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 hover:bg-green-200" title="Your plan">
      {plan}
    </button>
  ) : (
    <button onClick={onOpen} className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100" title="Enter a license key or upgrade">
      Free · Upgrade
    </button>
  )
}
