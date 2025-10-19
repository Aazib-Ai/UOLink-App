export interface AuraTierDefinition {
  id: string
  name: string
  shortName: string
  min: number
  max?: number
  badgeClass: string
  borderClass: string
  description: string
}

export interface AuraTierResult {
  aura: number
  tier: AuraTierDefinition
  nextTier: AuraTierDefinition | null
  progressToNext: number
  progressPercent: number
  auraToNext: number
  isMaxTier: boolean
}

export const AURA_TIERS: AuraTierDefinition[] = [
  {
    id: 'newbie',
    name: 'Newbie',
    shortName: 'NEW',
    min: 0,
    max: 99,
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
    borderClass: 'ring-2 ring-slate-200 ring-offset-2 ring-offset-white',
    description: 'Just getting started. Share solid notes to build your aura.',
  },
  {
    id: 'vibing',
    name: 'Vibing',
    shortName: 'VIBE',
    min: 100,
    max: 499,
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    borderClass: 'ring-[3px] ring-emerald-300 ring-offset-2 ring-offset-white shadow-[0_0_12px_rgba(16,185,129,0.28)]',
    description: 'The community feels your energy. Keep the momentum going.',
  },
  {
    id: 'legend',
    name: 'Certified Legend',
    shortName: 'LEGEND',
    min: 500,
    max: 999,
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-600',
    borderClass: 'ring-[3px] ring-indigo-300 ring-offset-2 ring-offset-white shadow-[0_0_16px_rgba(99,102,241,0.32)]',
    description: 'Your notes are classroom staples. Everyone knows your name.',
  },
  {
    id: 'main-character',
    name: 'Main Character',
    shortName: 'MC',
    min: 1000,
    max: 2499,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    borderClass: 'ring-[3px] ring-amber-300 ring-offset-2 ring-offset-white shadow-[0_0_20px_rgba(251,191,36,0.38)]',
    description: 'Every lecture revolves around your uploads. Truly iconic.',
  },
  {
    id: 'goat',
    name: 'The GOAT',
    shortName: 'GOAT',
    min: 2500,
    badgeClass: 'border-purple-300 bg-purple-50 text-purple-700',
    borderClass: 'ring-4 ring-purple-400 ring-offset-2 ring-offset-white shadow-[0_0_26px_rgba(168,85,247,0.5)] animate-pulse',
    description: 'Legend status unlocked. Your notes run the campus.',
  },
]

export const formatAura = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0
  return Math.round(safeValue).toLocaleString()
}

export const getAuraTier = (value: number): AuraTierResult => {
  const aura = Number.isFinite(value) ? Math.floor(value) : 0
  const clampedAura = Number.isFinite(aura) ? aura : 0

  const tier =
    AURA_TIERS.find(
      (definition) =>
        clampedAura >= definition.min && (definition.max === undefined || clampedAura <= definition.max)
    ) ?? AURA_TIERS[0]

  const currentIndex = AURA_TIERS.findIndex((definition) => definition.id === tier.id)
  const nextTier = currentIndex >= 0 && currentIndex + 1 < AURA_TIERS.length ? AURA_TIERS[currentIndex + 1] : null

  let progressToNext = 1
  let auraToNext = 0

  if (nextTier) {
    const range = nextTier.min - tier.min
    progressToNext = range > 0 ? Math.max(0, Math.min(1, (clampedAura - tier.min) / range)) : 0
    auraToNext = Math.max(0, nextTier.min - clampedAura)
  }

  return {
    aura: clampedAura,
    tier,
    nextTier,
    progressToNext,
    progressPercent: Math.round(progressToNext * 100),
    auraToNext,
    isMaxTier: !nextTier,
  }
}

